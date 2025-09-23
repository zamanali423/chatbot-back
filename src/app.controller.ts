import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return '🚀 Chatbot server API is running!';
  }
  
  @Get()
  getDbUrl(): string {
    return this.appService.getDbUrl();
  }
}
