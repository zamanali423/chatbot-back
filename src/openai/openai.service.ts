// src/openai/openai.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat } from './schemas/chat.schema';
import { ScrapedData } from '../scraper/schemas/scraped-data.schema';

@Injectable()
export class OpenAiService {
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly apiKey = process.env.OPENAI_API_KEY;

  constructor(
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    @InjectModel(ScrapedData.name) private scrapedDataModel: Model<ScrapedData>,
  ) {}

  async streamResponse(
    message: string,
    websiteId: string,
    res: any,
  ): Promise<void> {
    let fullResponse = '';
    let buffer = '';

    // Get contextual scraped data
    const scrapedData = await this.scrapedDataModel
      .findOne({ url: websiteId })
      .sort({ createdAt: -1 });

    let context = '';
    if (scrapedData) {
      const teamDetails = scrapedData.team
        ?.map(
          (member, i) => `
        --- Team Member ${i + 1} ---
        Name: ${member.name || 'N/A'}
        Role: ${member.role || 'N/A'}
        Email: ${member.email || 'N/A'}
        Phone: ${member.phone || 'N/A'}
        Address: ${member.address || 'N/A'}
        Social Links:
          Facebook: ${member.socialLinks?.facebook?.join(', ') || 'N/A'}
          Instagram: ${member.socialLinks?.instagram?.join(', ') || 'N/A'}
          LinkedIn: ${member.socialLinks?.linkedin?.join(', ') || 'N/A'}
      `,
        )
        .join('\n');
      context = `
        Name: ${scrapedData.name || 'N/A'}
        Email: ${scrapedData.email || 'N/A'}
        Phone: ${scrapedData.phone || 'N/A'}
        Social Links: ${scrapedData.socialLinks?.join(', ') || 'N/A'}
        About: ${scrapedData.about || 'N/A'}
        Headlines: ${scrapedData.headlines?.join(', ') || 'N/A'}
        Slogan: ${scrapedData.slogan || 'N/A'}
        Team:${teamDetails || 'N/A'}
        Pages:${scrapedData.pages?.map((p) => p.texts).join(', ') || 'N/A'}
      `;
    }

    const systemPrompt = `
    You are a concise assistant. Answer strictly based on the provided website data.
    Keep your response short: 3–4 sentences maximum.
    Do NOT add information outside of the provided context.
  `;

    const response = await axios.post(
      this.apiUrl,
      {
        model: 'gpt-4o-mini',
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'system', content: `Website Context:\n${context}` },
          { role: 'user', content: message },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
      },
    );

    response.data.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();

      let lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep last incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;

        if (line.trim() === 'data: [DONE]') {
          this.chatModel.create({
            websiteId,
            userMessage: message,
            aiResponse: fullResponse,
            role: 'assistant',
          });
          res.end();
          return;
        }

        if (line.startsWith('data: ')) {
          const data = line.replace(/^data:\s*/, '').trim();
          try {
            const parsed = JSON.parse(data);
            const role = parsed.choices[0].delta?.role || 'assistant';
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              res.write(`data: ${JSON.stringify({ content, role })}\n\n`);
            }
          } catch (err) {
            console.log('Skipping partial JSON line:', data);
          }
        }
      }
    });

    response.data.on('end', () => {
      console.log('Full Response:', fullResponse);
      console.log('Streaming finished.');
    });

    response.data.on('error', (err) => {
      console.error('Stream error:', err);
      res.end();
    });
  }

  async getChatHistory(websiteId: string) {
    return this.chatModel.find({ websiteId }).exec();
  }
}
