import { Controller, Post, Get, Body, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { IpDailyLimitGuard } from '../common/guards/ip-daily-limit.guard';
import { ChatService, ChatResponse } from './chat.service';
import { ChatDto } from './dto/chat.dto';
import { GeoService } from '../common/services/geo.service';
import { MessageLogService } from './services/message-log.service';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly geoService: GeoService,
    private readonly messageLogService: MessageLogService,
  ) {}

  @Post()
  async chat(@Body() dto: ChatDto, @Req() req: Request): Promise<ChatResponse> {
    const ip = req.ip ?? '';
    const location = await this.geoService.getLocationFromIp(ip);
    const result = await this.chatService.chat(dto.userId, dto.message, location);
    await this.messageLogService.log({
      userId: dto.userId,
      ipAddress: ip,
      message: dto.message,
      response: result.reply,
      source: result.source,
    });
    return result;
  }

  @Post('stream')
  @UseGuards(IpDailyLimitGuard)
  async chatStream(@Body() dto: ChatDto, @Req() req: Request, @Res() res: Response): Promise<void> {
    const ip = req.ip ?? '';
    const location = await this.geoService.getLocationFromIp(ip);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const chunks: string[] = [];
    let source = 'model';
    try {
      for await (const event of this.chatService.chatStream(dto.userId, dto.message, location)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (event.type === 'chunk') chunks.push(event.text);
        if (event.type === 'done') source = event.source;
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`);
    } finally {
      res.end();
      await this.messageLogService.log({
        userId: dto.userId,
        ipAddress: ip,
        message: dto.message,
        response: chunks.join('') || null,
        source,
      });
    }
  }

  @Get('health')
  health(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
