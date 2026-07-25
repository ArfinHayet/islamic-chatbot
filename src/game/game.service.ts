import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { ScenarioBankEntity, ScenarioOption } from './entities/scenario-bank.entity';
import { GeminiService } from '../gemini/gemini.service';
import { GenerateScenarioDto } from './dto/generate-scenario.dto';
import { ScenarioResponse } from './dto/scenario-response.dto';
import { buildScenarioPrompt, SCENARIO_RESPONSE_SCHEMA, VIRTUES, Virtue, District } from './prompts/scenario.prompt';
import { checkScenarioSafety } from './filters/content-safety.filter';
import { FALLBACK_SCENARIOS, SeedScenario } from './seed/fallback-scenarios';

interface GeneratedScenario {
  situation: string;
  options: ScenarioOption[];
}

@Injectable()
export class GameService implements OnModuleInit {
  private readonly logger = new Logger(GameService.name);

  constructor(
    @InjectRepository(ScenarioBankEntity)
    private readonly scenarioRepo: Repository<ScenarioBankEntity>,
    private readonly geminiService: GeminiService,
  ) {}

  async onModuleInit() {
    try {
      // Clear out any old scenarios with long text (> 140 chars)
      const oldScenarios = await this.scenarioRepo.find();
      const longScenarios = oldScenarios.filter((s) => (s.situation?.length ?? 0) > 140);
      if (longScenarios.length > 0) {
        await this.scenarioRepo.remove(longScenarios);
        this.logger.log(`Cleared ${longScenarios.length} old long scenarios from database.`);
      }
    } catch (err) {
      this.logger.warn(`Failed to clean old scenarios: ${(err as Error).message}`);
    }
  }

  async getScenario(dto: GenerateScenarioDto): Promise<ScenarioResponse> {
    // 1. Try to find an unseen scenario in the bank
    const bankScenario = await this.findFromBank(dto);
    if (bankScenario) {
      return this.toResponse(bankScenario);
    }

    // 2. Try to generate a new scenario via Gemini
    try {
      const generated = await this.generateAndPersist(dto);
      if (generated) {
        return this.toResponse(generated);
      }
    } catch (err) {
      this.logger.warn(`Scenario generation failed: ${(err as Error).message}`);
    }

    // 3. Fall back to hand-authored seed scenarios
    return this.getFallbackScenario(dto);
  }

  private async findFromBank(dto: GenerateScenarioDto): Promise<ScenarioBankEntity | null> {
    const queryBuilder = this.scenarioRepo.createQueryBuilder('s')
      .where('s.level = :level', { level: dto.level })
      .andWhere('s.district = :district', { district: dto.district })
      .andWhere('s.status = :status', { status: 'active' });

    if (dto.excludeIds.length > 0) {
      queryBuilder.andWhere('s.id NOT IN (:...excludeIds)', { excludeIds: dto.excludeIds });
    }

    queryBuilder.orderBy('s.timesServed', 'ASC').addOrderBy('RANDOM()');

    const scenario = await queryBuilder.getOne();

    if (scenario) {
      await this.scenarioRepo.increment({ id: scenario.id }, 'timesServed', 1);
      this.logger.log(`Bank hit for level=${dto.level} district=${dto.district} id=${scenario.id}`);
    }

    return scenario;
  }

  private async generateAndPersist(dto: GenerateScenarioDto): Promise<ScenarioBankEntity | null> {
    // Pick a random virtue to focus on, rotating so scenarios don't over-index
    const virtueFocus = VIRTUES[Math.floor(Math.random() * VIRTUES.length)] as Virtue;
    const prompt = buildScenarioPrompt(dto.level, dto.district as District, virtueFocus);

    // Try up to 2 times (initial + 1 retry)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const generated = await this.geminiService.generateStructuredJson<GeneratedScenario>(
          prompt,
          SCENARIO_RESPONSE_SCHEMA,
        );

        if (!this.validateScenarioShape(generated)) {
          this.logger.warn(`Generated scenario has invalid shape (attempt ${attempt + 1})`);
          continue;
        }

        // Content safety check
        const safety = checkScenarioSafety(generated);
        if (!safety.safe) {
          this.logger.warn(`Generated scenario failed safety check: ${safety.reason} (attempt ${attempt + 1})`);
          continue;
        }

        // Persist to bank
        const entity = this.scenarioRepo.create({
          level: dto.level,
          district: dto.district,
          locale: 'en',
          situation: generated.situation,
          options: generated.options,
          status: 'active',
          timesServed: 1,
        });

        const saved = await this.scenarioRepo.save(entity);
        this.logger.log(`Generated and persisted new scenario id=${saved.id} for level=${dto.level} district=${dto.district}`);
        return saved;
      } catch (err) {
        this.logger.warn(`Generation attempt ${attempt + 1} failed: ${(err as Error).message}`);
      }
    }

    return null;
  }

  private validateScenarioShape(data: unknown): data is GeneratedScenario {
    if (!data || typeof data !== 'object') return false;
    const scenario = data as Record<string, unknown>;

    if (typeof scenario.situation !== 'string' || !scenario.situation.trim()) return false;
    if (!Array.isArray(scenario.options) || scenario.options.length !== 3) return false;

    const validVirtues = new Set(VIRTUES);
    for (const opt of scenario.options) {
      if (typeof opt !== 'object' || !opt) return false;
      const option = opt as Record<string, unknown>;
      if (typeof option.text !== 'string' || !option.text.trim()) return false;
      if (typeof option.virtue !== 'string' || !validVirtues.has(option.virtue as Virtue)) return false;
      if (typeof option.delta !== 'number' || option.delta < 1 || option.delta > 3) return false;
      if (typeof option.reflection !== 'string' || !option.reflection.trim()) return false;
    }

    return true;
  }

  private getFallbackScenario(dto: GenerateScenarioDto): ScenarioResponse {
    let candidates = FALLBACK_SCENARIOS.filter(
      (s) => s.level === dto.level && s.district === dto.district,
    );

    // If no exact match, broaden to same level any district
    if (candidates.length === 0) {
      candidates = FALLBACK_SCENARIOS.filter((s) => s.level === dto.level);
    }

    // If still nothing, use any fallback
    if (candidates.length === 0) {
      candidates = FALLBACK_SCENARIOS;
    }

    // Pick a random one
    const picked = candidates[Math.floor(Math.random() * candidates.length)];

    return {
      id: `fallback-${dto.level}-${dto.district}-${Math.random().toString(36).slice(2, 8)}`,
      level: picked.level,
      district: picked.district,
      situation: picked.situation,
      options: picked.options,
    };
  }

  private toResponse(entity: ScenarioBankEntity): ScenarioResponse {
    return {
      id: entity.id!,
      level: entity.level!,
      district: entity.district!,
      situation: entity.situation!,
      options: (entity.options ?? []).map((opt) => ({
        text: opt.text,
        virtue: opt.virtue,
        delta: opt.delta,
        reflection: opt.reflection,
      })),
    };
  }
}
