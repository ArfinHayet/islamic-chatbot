import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export interface ScenarioOption {
  text: string;
  virtue: string;
  delta: number;
  reflection: string;
}

@Entity('scenario_bank')
export class ScenarioBankEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string | undefined;

  @Column({ type: 'integer' })
  level: number | undefined;

  @Column({ type: 'varchar', length: 20 })
  district: string | undefined;

  @Column({ type: 'varchar', length: 5, default: 'en' })
  locale: string | undefined;

  @Column({ type: 'text' })
  situation: string | undefined;

  @Column({ type: 'jsonb' })
  options: ScenarioOption[] | undefined;

  @Column({ type: 'varchar', length: 10, default: 'active' })
  status: string | undefined;

  @Column({ type: 'integer', default: 0 })
  timesServed: number | undefined;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date | undefined;
}
