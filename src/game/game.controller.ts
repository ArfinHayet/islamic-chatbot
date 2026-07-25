import { Controller, Post, Get, Body } from '@nestjs/common';
import { GameService } from './game.service';
import { GenerateScenarioDto } from './dto/generate-scenario.dto';
import { ScenarioResponse } from './dto/scenario-response.dto';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post('scenario')
  async getScenario(@Body() dto: GenerateScenarioDto): Promise<ScenarioResponse> {
    return this.gameService.getScenario(dto);
  }

  @Get('health')
  health(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
