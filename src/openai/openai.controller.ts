// src/openai/openai.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  Res,
} from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { OpenaiAssistantService } from '../openai_assistant/openai_assistant.service';
import type { Response } from 'express';

@Controller('openai')
export class OpenAiController {
  constructor(
    private readonly openAiService: OpenAiService,
    private readonly openAiAssistantService: OpenaiAssistantService,
  ) {}

  @Post('chat-stream')
  @HttpCode(200)
  async chatStream(
    @Body('message') message: string,
    @Query('websiteId') websiteId: string,
    @Res() res: Response,
  ) {
    // res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    // res.setHeader('Transfer-Encoding', 'chunked');
    // res.setHeader('Connection', 'keep-alive');
    // res.flushHeaders();

    // ✅ Step 1: Get assistant from DB based on websiteId
    const assistant = await this.openAiAssistantService.getAssistant(websiteId);
    if (!assistant) {
      res.write('Assistant not found for this website');
      return res.end();
    }

    // ✅ Step 2: Pass assistantId to service
    await this.openAiService.sendMessage(
      assistant.assistantId,
      websiteId,
      message,
      // { id: assistant.fileIds[0] },
      res,
    );
  }

  /**
   * Get chat history for a website (local DB)
   */
  @Get('chat-history')
  async getChatHistory(@Query('websiteId') websiteId: string) {
    return this.openAiService.getChatHistory(websiteId);
  }
}
