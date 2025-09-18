// backend/src/users/website.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WebsiteDocument = Website & Document;

@Schema({ timestamps: true })
export class Website {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  domain: string; // used for embeddable widget

  @Prop({ default: [] })
  agents: string[]; // array of agent IDs
}

export const WebsiteSchema = SchemaFactory.createForClass(Website);
