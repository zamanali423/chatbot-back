import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AssistantDocument = Assistant & Document;

@Schema({ timestamps: true })
export class Assistant {
  @Prop({ required: true })
  assistantId: string; // OpenAI assistant ID

  @Prop({ required: true })
  name: string;

  @Prop()
  createdAt: Date;

  @Prop({ required: true })
  websiteUrl: string; // URL of the website

  @Prop()
  instructions: string;

  @Prop({ default: [] })
  fileIds: string[]; // IDs of files used in the conversation
}

export const AssistantSchema = SchemaFactory.createForClass(Assistant);
