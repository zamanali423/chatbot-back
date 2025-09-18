// backend/src/websockets/chat.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ChatService } from './chats/chat.service';

@WebSocketGateway({ cors: true })
export class ChatGateway {
  constructor(private chatService: ChatService) {}

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('send_message')
  async handleMessage(@MessageBody() data: any) {
    const saved = await this.chatService.create(data);
    this.server.emit('receive_message', saved);
  }
}
