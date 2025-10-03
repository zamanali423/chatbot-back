import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import * as Joi from 'joi';
import { ScraperModule } from './scraper/scraper.module';
import { OpenAiService } from './openai/openai.service';
import { OpenAiController } from './openai/openai.controller';
import { OpenAiModule } from './openai/openai.module';
import { OpenaiAssistantModule } from './openai_assistant/openai_assistant.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        MONGO_URI: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
      }),
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri:
          config.get<string>('MONGO_URI') ||
          'mongodb://localhost:27017/chatbot-scraping-integration',
      }),
    }),
    UsersModule,
    AuthModule,
    OpenAiModule,
    ScraperModule,
    OpenaiAssistantModule,
  ],
  controllers: [AppController, OpenAiController],
  providers: [AppService, OpenAiService],
})
export class AppModule {}
