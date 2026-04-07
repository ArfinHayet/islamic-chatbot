import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [RagModule],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
