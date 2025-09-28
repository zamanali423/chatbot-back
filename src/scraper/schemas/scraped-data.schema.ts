import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class TeamMember {
  @Prop() name?: string;
  @Prop() email?: string;
  @Prop() phone?: string;
  @Prop() address?: string;
  @Prop() role?: string;
  @Prop({
    type: {
      facebook: [{ type: String }],
      instagram: [{ type: String }],
      linkedin: [{ type: String }],
      other: [{ type: String }],
    },
    _id: false, // prevents creating an _id for socialLinks subdoc
  })
  socialLinks?: {
    facebook?: string[];
    instagram?: string[];
    linkedin?: string[];
    other?: string[];
  };
}

const TeamMemberSchema = SchemaFactory.createForClass(TeamMember);

@Schema({ timestamps: true })
export class ScrapedData extends Document {
  @Prop() name: string;
  @Prop() email: string;
  @Prop() phone: string;

  @Prop({ type: [String] })
  socialLinks: string[];

  @Prop([String])
  links: string[];

  @Prop() about: string;

  @Prop({ type: [String] })
  headlines: string[];

  @Prop() slogan: string;

  @Prop() url: string; // ✅ store original website URL
  @Prop() userId: string;
  @Prop() category: string;

  // ✅ Use subdocument schema here
  @Prop({ type: [TeamMemberSchema], default: [] })
  team: TeamMember[];

  // Extend schema first
  @Prop({
    type: [
      {
        url: String,
        texts: [String],
      },
    ],
    default: [],
  })
  pages: { url: string; texts: string[] }[];
}

export const ScrapedDataSchema = SchemaFactory.createForClass(ScrapedData);
