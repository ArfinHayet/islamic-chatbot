import { IsString, IsNotEmpty, MinLength, MaxLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class ChatDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(1000)
  message: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsOptional()
  captchaToken?: string;

  @IsString()
  @IsOptional()
  captchaPass?: string;
}

export class TurnstilePassDto {
  @IsString()
  @IsNotEmpty()
  captchaToken: string;
}

export class ChatTtsDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text: string;

  @IsString()
  @IsOptional()
  captchaToken?: string;

  @IsString()
  @IsOptional()
  captchaPass?: string;
}
