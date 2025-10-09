import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { OpenaiAssistantService } from './openai_assistant.service';
import { ScraperService } from '../scraper/scraper.service';

@Controller('assistants')
export class OpenaiAssistantController {
  constructor(
    private readonly assistantService: OpenaiAssistantService,
    private readonly scraperService: ScraperService,
  ) {}

  /**
   * Create assistant using scraped data from DB
   * POST /assistants/create?instructions=...
   */
  //   @Query('instructions') instructions?: string,
  @Post('create')
  async createAssistant(@Query('url') url: string) {
    return this.assistantService.createAssistant(url);
  }

  @Post('resync')
  async resync(@Query('websiteId') websiteId: string) {
    const updatedWebsite =
      await this.scraperService.updateScrapedData(websiteId);
    await this.assistantService.updateAssistant(websiteId);
    return {
      message: 'Website and assistant synced successfully',
    };
  }

  // @Post('update')
  // async updateAssistant(@Query('websiteId') websiteId: string) {
  //   if (!websiteId) {
  //     throw new BadRequestException('websiteId is required');
  //   }

  //   try {
  //     const result = await this.assistantService.updateAssistant(websiteId);
  //     return {
  //       success: true,
  //       message: 'Assistant updated successfully',
  //       assistant: result,
  //     };
  //   } catch (err) {
  //     console.error('❌ Error updating assistant:', err.message);
  //     throw new BadRequestException(
  //       err.response?.data?.error?.message || err.message,
  //     );
  //   }
  // }
  /**
   * List all assistants
   */
  @Get()
  async getAssistant(@Query('websiteId') websiteId: string) {
    return this.assistantService.getAssistant(websiteId);
  }
}
