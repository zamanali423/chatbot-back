// backend/src/chats/chat.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat, ChatDocument } from './schemas/chat.schema';

@Injectable()
export class ChatService {
  constructor(@InjectModel(Chat.name) private chatModel: Model<ChatDocument>) {}

  async create(chat: Partial<Chat>) {
    const newChat = new this.chatModel(chat);
    return newChat.save();
  }

  async findByWebsite(websiteId: string) {
    return this.chatModel.find({ websiteId }).sort({ createdAt: 1 }).exec();
  }
}
