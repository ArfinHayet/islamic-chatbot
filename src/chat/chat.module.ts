import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { GeminiModule } from '../gemini/gemini.module';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [GeminiModule, RagModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
