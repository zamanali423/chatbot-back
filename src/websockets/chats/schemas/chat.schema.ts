// backend/src/chats/chat.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ChatDocument = Chat & Document;

@Schema({ timestamps: true })
export class Chat {
  @Prop({ required: true })
  websiteId: string; // For multi-website support

  @Prop({ required: true })
  sender: string; // 'user' | 'agent'

  @Prop({ required: true })
  message: string;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
