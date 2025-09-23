// src/openai/openai.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OpenAiService } from './openai.service';
import { OpenAiController } from './openai.controller';
import { Chat, ChatSchema } from './schemas/chat.schema';
import { ScrapedData, ScrapedDataSchema } from '../scraper/schemas/scraped-data.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: ScrapedData.name, schema: ScrapedDataSchema }, // ✅ fix: same array
    ]),
  ],
  providers: [OpenAiService],
  controllers: [OpenAiController],
  exports: [MongooseModule],
})
export class OpenAiModule {}
