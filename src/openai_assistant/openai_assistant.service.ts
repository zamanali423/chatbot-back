import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios, { AxiosInstance } from 'axios';
import { promises as fsPromises, createReadStream } from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import { ScrapedData } from '../scraper/schemas/scraped-data.schema';
import { Assistant } from './schemas/assistant.schema';

@Injectable()
export class OpenaiAssistantService {
  private readonly logger = new Logger(OpenaiAssistantService.name);
  private readonly openai: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(ScrapedData.name)
    private scrapedDataModel: Model<ScrapedData>,
    @InjectModel(Assistant.name) private assistantModel: Model<Assistant>,
  ) {
    this.openai = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        Authorization: `Bearer ${this.configService.get<string>('OPENAI_API_KEY')}`,
      },
    });
    console.log('OpenAI instance created', this.openai);
  }

  private sanitizeUrl(url: string): string {
    return url.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  private async saveScrapedDataToFile(data: ScrapedData): Promise<string> {
    const dirPath = path.join(process.cwd(), 'scraped_files');
    await fsPromises.mkdir(dirPath, { recursive: true });
    const safeName = this.sanitizeUrl(data.url);
    const filePath = path.join(dirPath, `${safeName}.txt`);

    const fileContent = `
Website-URL: ${data.url}
About: ${data.about || ''}
Headlines: ${data.headlines || ''}
Slogan: ${data.slogan || ''}
Links: ${data.links || ''}
Team:
    ${(data.team || [])
      .map(
        (member) => `
      - Name: ${member.name || ''}
        Email: ${member.email || ''}
        Phone: ${member.phone || ''}
        Role: ${member.role || ''}
        Social: ${JSON.stringify(member.socialLinks || {})}
        Address: ${member.address || ''}
    `,
      )
      .join('\n')}

Pages:
${(data.pages || []).map((p) => `Page: ${p.url}\nTexts: ${p.texts.join(' | ')}`).join('\n\n')}
    `;
    await fsPromises.writeFile(filePath, fileContent.trim(), 'utf-8');
    this.logger.log(`Scraped data saved for ${data.url} -> ${filePath}`);
    return filePath;
  }

  private async uploadFile(filePath: string) {
    const form = new FormData();
    form.append('purpose', 'assistants');
    form.append('file', createReadStream(filePath));

    const response = await this.openai.post('/files', form, {
      headers: {
        Authorization: `Bearer ${this.configService.get<string>('OPENAI_API_KEY')}`,
        ...form.getHeaders(),
        'OpenAI-Beta': 'assistants=v2',
      },
    });
    console.log('File uploaded', response.data);
    return response.data;
  }

  /**
   * Create assistant and save its info in MongoDB
   */
  async createAssistant(url: string) {
    try {
      // Fetch scraped data
      const scrapedData = await this.scrapedDataModel.findOne({ url }).lean();
      if (!scrapedData)
        throw new NotFoundException(`Scraped data not found for URL: ${url}`);

      const websiteName = scrapedData.url || 'Website';

      // Save scraped data to file
      const filePath = await this.saveScrapedDataToFile(scrapedData);

      // Upload file
      const uploadedFile = await this.uploadFile(filePath);
      console.log(`File uploaded for ${websiteName}: ${uploadedFile.id}`);

      // Create assistant in OpenAI
      const response = await this.openai.post(
        '/assistants',
        {
          name: `Assistant_${websiteName}`,
          instructions: `You are a helpful assistant specialized for ${websiteName}. Use the uploaded file for context.`,
          model: 'gpt-4o-mini',
          tools: [{ type: 'code_interpreter' }, { type: 'file_search' }],
        },
        {
          headers: {
            Authorization: `Bearer ${this.configService.get<string>('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2',
          },
        },
      );

      const assistantData = {
        assistantId: response.data.id,
        name: response.data.name,
        createdAt: response.data.created_at * 1000,
        websiteUrl: url,
        instructions: `You are a helpful assistant specialized for ${websiteName}. Use the uploaded file for context.`,
        fileIds: [uploadedFile.id],
      };

      // ✅ Save assistant in DB
      const assistant = await this.assistantModel.create(assistantData);
      await this.scrapedDataModel.updateOne({ url }, { status: 'Live' });
      console.log('Assistant created', assistant);
      return assistant;
    } catch (error) {
      console.log('Error creating assistant', error.response?.data?.error);
      //   this.logger.error(
      //     `Failed to create assistant: ${error.response?.data?.error?.message || error.message}`,
      //   );
      //   throw error;
    }
  }

  async updateAssistant(websiteId: string) {
    const assistant = await this.getAssistant(websiteId);
    if (!assistant) {
      throw new NotFoundException(`Assistant not found for ${websiteId}`);
    }
    const updatedAssistant = await this.openai.patch(
      `/assistants/${assistant.assistantId}`,
      {
        name: `Assistant_${assistant.websiteUrl}`,
        instructions: `You are a helpful assistant specialized for ${assistant.websiteUrl}. Use the uploaded file for context.`,
        model: 'gpt-4o-mini',
        tools: [{ type: 'code_interpreter' }, { type: 'file_search' }],
      },
      {
        headers: {
          Authorization: `Bearer ${this.configService.get<string>(
            'OPENAI_API_KEY',
          )}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
      },
    );
    console.log('Assistant updated', updatedAssistant);
    return updatedAssistant?.data;
  }

  /**
   * Optional: List all assistants from DB
   */
  async listAssistants() {
    return this.assistantModel.find().sort({ createdAt: -1 }).lean();
  }
  async getAssistant(websiteId: string) {
    const assistant = await this.assistantModel
      .findOne({ websiteUrl: websiteId })
      .exec();
    if (!assistant) {
      throw new NotFoundException(`Assistant not found for ${websiteId}`);
    }
    return assistant;
  }
}
