import { Controller, Get, Post, Query } from '@nestjs/common';
import { OpenaiAssistantService } from './openai_assistant.service';

@Controller('assistants')
export class OpenaiAssistantController {
  constructor(private readonly assistantService: OpenaiAssistantService) {}

  /**
   * Create assistant using scraped data from DB
   * POST /assistants/create?instructions=...
   */
  //   @Query('instructions') instructions?: string,
  @Post('create')
  async createAssistant(@Query('url') url: string) {
    return this.assistantService.createAssistant(url);
  }

  /**
   * List all assistants
   */
  @Get()
  async getAssistant(@Query('websiteId') websiteId: string) {
    return this.assistantService.getAssistant(websiteId);
  }
}
