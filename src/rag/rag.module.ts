import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RagService } from './rag.service';
import { CacheEntity } from './entities/cache.entity';
import { QuranVerseEntity } from './entities/quran-verse.entity';
import { HadithEntity } from './entities/hadith.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CacheEntity, QuranVerseEntity, HadithEntity])],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
