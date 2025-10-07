import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;
  constructor(
    private readonly usersService: UsersService, // 👈 Nest can't resolve this
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  async register(name: string, email: string, password: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(password, 10);
    const otp = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
    const user = await this.usersService.create({
      name,
      email,
      password: hashed,
      otp,
      otpExpiresAt,
      otpVerified: false,
      loginProvider: 'local',
    });

    // TODO: Send OTP via email or SMS (use mailer service)
    console.log(`OTP for ${email}: ${otp}`);
    // ✅ Send OTP Email
    await this.mailService.sendOtpMail(email, otp);
    return { id: user._id, name: user.name, email: user.email };
  }

  // 2️⃣ Verify OTP
  async verifyOtp(email: string, otp: string) {
    console.log(email, otp);

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid email');

    if (user.otpVerified) throw new BadRequestException('OTP already verified');

    if (user.otp !== otp) throw new UnauthorizedException('Invalid OTP');

    // Check OTP expiry
    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new BadRequestException('OTP expired. Please request a new one.');
    }

    // Mark OTP as verified
    await this.usersService.update(user._id, {
      otpVerified: true,
      otp: '',
      otpExpiresAt: undefined,
    });

    return { message: 'OTP verified successfully. You can now log in.' };
  }

  async resendOtp(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid email');

    if (user.otpVerified)
      throw new BadRequestException('Email already verified.');

    const now = new Date();
    // Optional cooldown (e.g., prevent spam)
    if (user.otpExpiresAt && user.otpExpiresAt > now) {
      const secondsLeft = Math.ceil(
        (user.otpExpiresAt.getTime() - now.getTime()) / 1000,
      );
      if (secondsLeft > 120) {
        throw new BadRequestException(
          'Please wait before requesting a new OTP.',
        );
      }
    }

    const otp = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.usersService.updateUser(email, { otp, otpExpiresAt });

    await this.mailService.sendOtpMail(email, otp);

    return { message: 'New OTP has been sent to your email.' };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!user.otpVerified)
      throw new UnauthorizedException('Please verify OTP first');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user._id, email: user.email };
    const token = await this.jwtService.signAsync(payload);

    return {
      access_token: token,
      user: { id: user._id, name: user.name, email: user.email },
    };
  }

  // 4️⃣ Login with Google
  async googleLogin(idToken: string) {
    try {
      // Verify Google ID token
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) throw new UnauthorizedException('Invalid Google token');

      const { email, name, picture } = payload;

      // ✅ Ensure email exists
      if (!email)
        throw new UnauthorizedException('Google account has no email');
      // Check if user exists
      let user = await this.usersService.findByEmail(email);

      // If not, create a new user automatically
      if (!user) {
        user = await this.usersService.create({
          name,
          email,
          password: '',
          otpVerified: true,
          loginProvider: 'google',
          picture,
        });
      }

      // Generate JWT token
      const jwtPayload = { sub: user._id, email: user.email };
      const token = await this.jwtService.signAsync(jwtPayload);

      return {
        access_token: token,
        user: { id: user._id, name: user.name, email: user.email, picture },
      };
    } catch (err) {
      throw new UnauthorizedException('Google login failed');
    }
  }

  // Helper: generate 6-digit OTP
  private generateOtp(): string {
    return Math.random().toString().slice(2, 8);
  }
}
