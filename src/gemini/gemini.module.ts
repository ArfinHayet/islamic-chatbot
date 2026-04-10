import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { McpModule } from '../mcp/mcp.module';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [McpModule, RagModule],
  providers: [GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}
