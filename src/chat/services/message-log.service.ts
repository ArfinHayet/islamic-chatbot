import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageLogEntity } from '../entities/message-log.entity';

@Injectable()
export class MessageLogService {
  constructor(
    @InjectRepository(MessageLogEntity)
    private readonly repo: Repository<MessageLogEntity>,
  ) {}

  async log(data: {
    userId: string;
    ipAddress: string;
    message: string;
    response: string | null;
    source: string;
  }): Promise<void> {
    try {
      await this.repo.save(this.repo.create(data));
    } catch (error) {
      // Log the error to the console or a logger service
      // You can replace console.error with a proper logger if available
      console.error('Failed to log message:', {
        data,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}
