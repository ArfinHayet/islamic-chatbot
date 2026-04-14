import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { GeminiModule } from '../gemini/gemini.module';
import { RagModule } from '../rag/rag.module';
import { GeoService } from '../common/services/geo.service';

@Module({
  imports: [GeminiModule, RagModule],
  controllers: [ChatController],
  providers: [ChatService, GeoService],
})
export class ChatModule {}
