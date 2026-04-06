import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RagService } from './rag.service';
import { CacheEntity } from './entities/cache.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CacheEntity])],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
