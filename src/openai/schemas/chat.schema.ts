// src/openai/schemas/chat.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Chat extends Document {
  @Prop({ required: true })
  websiteId: string; // link chats to a specific website

  @Prop({ required: true })
  threadId: string; // OpenAI thread for conversation continuity

  @Prop({
    type: [
      {
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
      },
    ],
    default: [],
  })
  messages: { role: 'user' | 'assistant'; content: string }[];

  @Prop({ default: [] })
  fileIds: string[]; // OpenAI file IDs if you attach files
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
