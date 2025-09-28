// src/openai/openai.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  Query,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { OpenAiService } from './openai.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat } from './schemas/chat.schema';

@Controller('openai')
export class OpenAiController {
  constructor(
    private readonly openAiService: OpenAiService,
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
  ) {}

  @Post('chat-stream')
  @HttpCode(200)
  async chatStream(
    @Body('message') message: string,
    @Query('websiteId') websiteId: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    await this.openAiService.streamResponse(message, websiteId, res);
  }

  @Get('chat-history')
  async getChatHistory(@Query('websiteId') websiteId: string) {
    return this.chatModel.find({ websiteId }).sort({ createdAt: 1 }).exec();
  }
}
