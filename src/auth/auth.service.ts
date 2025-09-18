import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService, // 👈 Nest can't resolve this
    private readonly jwtService: JwtService,
  ) {}

  async register(name: string, email: string, password: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({
      name,
      email,
      password: hashed,
    });

    return { id: user._id, name: user.name, email: user.email };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user._id, email: user.email };
    const token = await this.jwtService.signAsync(payload);

    return {
      access_token: token,
      user: { id: user._id, name: user.name, email: user.email },
    };
  }
}
