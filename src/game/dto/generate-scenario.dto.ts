import { IsInt, Min, Max, IsString, IsIn, IsArray } from 'class-validator';

export class GenerateScenarioDto {
  @IsInt()
  @Min(1)
  @Max(3)
  level: number;

  @IsString()
  @IsIn(['home', 'marketplace', 'madrasa'])
  district: string;

  @IsArray()
  @IsString({ each: true })
  excludeIds: string[];
}
