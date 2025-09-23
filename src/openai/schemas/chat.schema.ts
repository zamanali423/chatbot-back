// src/openai/schemas/chat.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Chat extends Document {
  @Prop({ required: true })
  websiteId: string;

  @Prop()
  userMessage: string;

  @Prop()
  aiResponse: string;

  @Prop()
  role: string;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
