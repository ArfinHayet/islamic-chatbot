import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GeminiModule } from '../gemini/gemini.module';
import { ScenarioBankEntity } from './entities/scenario-bank.entity';

@Module({
  imports: [GeminiModule, TypeOrmModule.forFeature([ScenarioBankEntity])],
  controllers: [GameController],
  providers: [GameService],
})
export class GameModule {}
