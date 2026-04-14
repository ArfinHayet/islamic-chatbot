import { Controller, Post, Get, Body, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { IpDailyLimitGuard } from '../common/guards/ip-daily-limit.guard';
import { ChatService, ChatResponse } from './chat.service';
import { ChatDto } from './dto/chat.dto';
import { GeoService } from '../common/services/geo.service';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly geoService: GeoService,
  ) {}

  @Post()
  async chat(@Body() dto: ChatDto, @Req() req: Request): Promise<ChatResponse> {
    const location = await this.geoService.getLocationFromIp(req.ip ?? '');
    return this.chatService.chat(dto.userId, dto.message, location);
  }

  @Post('stream')
  @UseGuards(IpDailyLimitGuard)
  async chatStream(@Body() dto: ChatDto, @Req() req: Request, @Res() res: Response): Promise<void> {
    const location = await this.geoService.getLocationFromIp(req.ip ?? '');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    try {
      for await (const event of this.chatService.chatStream(dto.userId, dto.message, location)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Get('health')
  health(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
