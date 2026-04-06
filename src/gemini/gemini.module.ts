import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { McpModule } from '../mcp/mcp.module';

@Module({
  imports: [McpModule],
  providers: [GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}
