import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface IpApiResponse {
  status: 'success' | 'fail';
  city: string;
  country: string;
}

export interface GeoLocation {
  city: string;
  country: string;
}

const PRIVATE_IP_PREFIXES = ['10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.',
  '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.',
  '172.29.', '172.30.', '172.31.', '192.168.'];

function isPrivateIp(ip: string): boolean {
  return (
    !ip ||
    ip === '::1' ||
    ip === '127.0.0.1' ||
    PRIVATE_IP_PREFIXES.some((prefix) => ip.startsWith(prefix))
  );
}

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  async getLocationFromIp(ip: string): Promise<GeoLocation | null> {
    if (isPrivateIp(ip)) {
      this.logger.debug(`Skipping geo lookup for private/local IP: ${ip}`);
      return null;
    }

    try {
      const response = await axios.get<IpApiResponse>(
        `https://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,country`,
        { timeout: 3000 },
      );
      if (response.data.status === 'success' && response.data.city && response.data.country) {
        return { city: response.data.city, country: response.data.country };
      }
    } catch (err) {
      this.logger.warn(`Geo lookup failed for IP ${ip}: ${(err as Error).message}`);
    }

    return null;
  }
}
