import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('gemini_keys')
export class GeminiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Encrypted using AES-256-GCM + PRIVATE_KEY */
  @Column({ type: 'text' })
  encryptedKey!: string;

  /** active: usable | rate_limited: hit daily quota | inactive: disabled */
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: 'active' | 'rate_limited' | 'inactive';

  /** Number of times this key was rate-limited */
  @Column({ type: 'int', default: 0 })
  failureCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  /** Key is locked until this time (reset at end of day) */
  @Column({ type: 'timestamptz', nullable: true })
  rateLimitedUntil!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
