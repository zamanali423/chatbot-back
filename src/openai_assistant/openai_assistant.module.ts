import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OpenaiAssistantService } from './openai_assistant.service';
import { OpenaiAssistantController } from './openai_assistant.controller';
import {
  ScrapedData,
  ScrapedDataSchema,
} from '../scraper/schemas/scraped-data.schema';
import { Assistant, AssistantSchema } from './schemas/assistant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScrapedData.name, schema: ScrapedDataSchema },
      { name: Assistant.name, schema: AssistantSchema }, // ✅ register AssistantModel
    ]),
  ],
  providers: [OpenaiAssistantService],
  controllers: [OpenaiAssistantController],
  exports: [OpenaiAssistantService],
})
export class OpenaiAssistantModule {}
