import { Controller, Post, Get, Body } from '@nestjs/common';
import { ChatService, ChatResponse } from './chat.service';
import { ChatDto } from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() dto: ChatDto): Promise<ChatResponse> {
    return this.chatService.chat(dto.userId, dto.message);
  }

  @Get('health')
  health(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
