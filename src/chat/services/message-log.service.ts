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
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.repo.insert(this.repo.create(data));
        return;
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts;

        console.error('Failed to log message:', {
          attempt,
          maxAttempts,
          data,
          error: error instanceof Error ? error.message : error,
        });

        if (isLastAttempt) {
          throw error;
        }

        await this.delay(attempt * 100);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
