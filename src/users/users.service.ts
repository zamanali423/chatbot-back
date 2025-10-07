import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).select('-password').exec();
  }

  async updateById(
    id: string,
    updateData: Partial<User>,
  ): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async updateUser(
    email: string,
    updateData: Partial<User>,
  ): Promise<User | null> {
    return this.userModel.findOneAndUpdate({ email }, updateData, {
      new: true,
    });
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = new this.userModel(user);
    return newUser.save();
  }

  // ✅ Add this method
  async update(id: string, updateData: Partial<User>): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
