import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class ChatDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(1000)
  message: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}
