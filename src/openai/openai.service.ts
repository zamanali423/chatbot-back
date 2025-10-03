// src/openai/openai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat } from './schemas/chat.schema';
import { ScrapedData } from '../scraper/schemas/scraped-data.schema';
import { OpenaiAssistantService } from '../openai_assistant/openai_assistant.service';
import { NotFoundException } from '@nestjs/common';
import type { Response } from 'express';

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly openai: AxiosInstance;

  constructor(
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    @InjectModel(ScrapedData.name) private scrapedDataModel: Model<ScrapedData>,
    private readonly openAiAssistantService: OpenaiAssistantService,
  ) {
    this.openai = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
    });
  }

  /** Send user message and get AI response */
  async sendMessage(
    assistantId: string,
    websiteId: string,
    userMessage: string,
    res: Response,
  ) {
    try {
      // 1. Get assistant for the website
      const assistant =
        await this.openAiAssistantService.getAssistant(websiteId);
      if (!assistant) {
        throw new NotFoundException(`Assistant not found for ${websiteId}`);
      }

      console.log('websiteId', websiteId);
      console.log('assistant', assistant);
      console.log('userMessage', userMessage);

      // 2. Get or create thread for this website
      let chatThread = await this.chatModel.findOne({ websiteId });
      if (!chatThread) {
        const threadRes = await this.openai.post('/threads', {});
        chatThread = await this.chatModel.create({
          websiteId,
          threadId: threadRes.data.id,
          messages: [],
        });
      }
      console.log('chatThread', chatThread);

      // 3. Add user message to thread
      await this.openai.post(`/threads/${chatThread.threadId}/messages`, {
        role: 'user',
        content: [{ type: 'text', text: userMessage }],
        attachments: assistant.fileIds.map((fileId) => ({
          file_id: fileId,
          tools: [{ type: 'file_search' }],
        })),
      });
      console.log('user message added to thread');

      // 4. Run assistant on this thread
      const runRes = await this.openai.post(
        `/threads/${chatThread.threadId}/runs`,
        {
          assistant_id: assistant.assistantId,
        },
      );
      console.log('assistant run started', runRes.data);

      const runId = runRes.data.id;
      console.log('runId', runId);

      // 5. Poll until run completes
      let status = 'in_progress';
      let resultMessage = '';
      while (status === 'in_progress' || status === 'queued') {
        const runCheck = await this.openai.get(
          `/threads/${chatThread.threadId}/runs/${runId}`,
        );
        status = runCheck.data.status;
        if (status === 'completed') {
          // Fetch latest messages
          const messagesRes = await this.openai.get(
            `/threads/${chatThread.threadId}/messages`,
          );
          const messages = messagesRes.data.data;
          const assistantMsg = messages.find((m) => m.role === 'assistant');
          resultMessage =
            assistantMsg?.content?.[0]?.text?.value || 'No response.';
        }
        if (status === 'failed') {
          throw new Error(
            `Assistant run failed: ${runCheck.data.last_error?.message}`,
          );
        }
        if (status === 'in_progress' || status === 'queued') {
          await new Promise((res) => setTimeout(res, 1000)); // wait 1s before retry
        }
      }
      console.log('run completed', status);
      chatThread.messages.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: resultMessage },
      );
      chatThread.fileIds = [assistant.fileIds[0]];
      await chatThread.save();
      console.log('chat saved to DB');
      console.log('chatThread.messages', chatThread.messages);
      res.json({
        websiteId,
        reply: resultMessage,
        messages: chatThread.messages, // latest chat log
      });
      res.end();
    } catch (error) {
      console.log('error', error.response?.data?.error);
      throw error;
    }
  }

  /** Get saved chat history */
  async getChatHistory(websiteId: string) {
    return this.chatModel.findOne({ websiteId }).lean().exec();
  }
}
