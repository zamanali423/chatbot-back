import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ScrapedData extends Document {
  @Prop()
  name: string;

  @Prop()
  email: string;

  @Prop()
  phone: string;

  @Prop({ type: [String] })
  socialLinks: string[];

  @Prop()
  about: string;

  @Prop({ type: [String] })
  headlines: string[];

  @Prop()
  slogan: string;

  @Prop()
  url: string; // ✅ store original website URL

  @Prop()
  userId: string;
}

export const ScrapedDataSchema = SchemaFactory.createForClass(ScrapedData);
