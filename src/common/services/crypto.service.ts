import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly privateKey: string;
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly saltLength = 16;
  private readonly ivLength = 12; // 96-bit IV recommended for GCM

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('privateKey');
    if (!key) throw new Error('PRIVATE_KEY environment variable is required');
    this.privateKey = key;
  }

  /** Encrypts plaintext using AES-256-GCM. Returns: salt:iv:ciphertext:authTag (hex) */
  encrypt(plaintext: string): string {
    const salt = crypto.randomBytes(this.saltLength);
    const iv = crypto.randomBytes(this.ivLength);
    const key = crypto.pbkdf2Sync(this.privateKey, salt, 100_000, this.keyLength, 'sha256');
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${salt.toString('hex')}:${iv.toString('hex')}:${ciphertext.toString('hex')}:${authTag.toString('hex')}`;
  }

  /** Decrypts an encrypted string produced by encrypt() */
  decrypt(encrypted: string): string {
    const parts = encrypted.split(':');
    if (parts.length !== 4) throw new Error('Invalid encrypted data format');
    const [saltHex, ivHex, ciphertextHex, authTagHex] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = crypto.pbkdf2Sync(this.privateKey, salt, 100_000, this.keyLength, 'sha256');
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}
