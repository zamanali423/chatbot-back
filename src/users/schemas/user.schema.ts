import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  _id: string;
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop()
  password: string;

  @Prop()
  otp?: string;

  @Prop({ default: false })
  otpVerified: boolean;

  @Prop({ default: 'local' })
  loginProvider: string;

  @Prop()
  picture?: string;

  @Prop()
  otpExpiresAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
