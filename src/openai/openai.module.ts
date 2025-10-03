// src/openai/openai.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OpenAiService } from './openai.service';
import { OpenAiController } from './openai.controller';
import { Chat, ChatSchema } from './schemas/chat.schema';
import {
  ScrapedData,
  ScrapedDataSchema,
} from '../scraper/schemas/scraped-data.schema';
import { OpenaiAssistantModule } from '../openai_assistant/openai_assistant.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: ScrapedData.name, schema: ScrapedDataSchema }, // ✅ fix: same array
    ]),
    OpenaiAssistantModule,
  ],
  providers: [OpenAiService],
  controllers: [OpenAiController],
  exports: [MongooseModule, OpenaiAssistantModule],
})
export class OpenAiModule {}
