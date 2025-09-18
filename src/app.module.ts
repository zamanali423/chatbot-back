import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import * as Joi from 'joi';
import { ChatGateway } from './websockets/chat.gateway';
import { Chat, ChatSchema } from './websockets/chats/schemas/chat.schema';
import { ChatService } from './websockets/chats/chat.service';
import { ScraperModule } from './scraper/scraper.module';

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
    MongooseModule.forFeature([{ name: Chat.name, schema: ChatSchema }]),
    UsersModule,
    AuthModule,
    ScraperModule,
  ],
  controllers: [AppController],
  providers: [AppService, ChatGateway, ChatService],
})
export class AppModule {}
