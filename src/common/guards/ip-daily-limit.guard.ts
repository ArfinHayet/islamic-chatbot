import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';

interface IpQuota {
  count: number;
  resetAt: number; // UTC timestamp of next midnight
}

const DAILY_LIMIT = 10;

function nextUtcMidnight(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

@Injectable()
export class IpDailyLimitGuard implements CanActivate {
  private readonly quotas = new Map<string, IpQuota>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = extractIp(req);
    const now = Date.now();

    let quota = this.quotas.get(ip);

    if (!quota || now >= quota.resetAt) {
      quota = { count: 0, resetAt: nextUtcMidnight() };
      this.quotas.set(ip, quota);
    }

    if (quota.count >= DAILY_LIMIT) {
      throw new HttpException(
        'Your daily quota of 10 questions has been exceeded. Please try again tomorrow.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    quota.count++;
    return true;
  }
}
