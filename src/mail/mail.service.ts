import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true, // true for 465, false for others
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendOtpMail(to: string, otp: string) {
    try {
      const info = await this.transporter.sendMail({
        from: `"Chatbot Integration" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Your OTP Code',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 16px;">
            <h2 style="color:#2D5BE3;">Email Verification</h2>
            <p>Dear user,</p>
            <p>Use the following OTP to verify your account:</p>
            <div style="font-size: 22px; font-weight: bold; color:#2D5BE3;">
              ${otp}
            </div>
            <p>This OTP will expire in 5 minutes.</p>
            <p>Thank you,<br/>Chatbot Integration Team</p>
          </div>
        `,
      });

      this.logger.log(`OTP email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send OTP email: ${error.message}`);
      throw error;
    }
  }
}
