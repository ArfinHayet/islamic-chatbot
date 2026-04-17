import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('message_logs')
export class MessageLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string | undefined;

  @Column({ type: 'varchar', length: 255 })
  userId: string | undefined;

  @Column({ type: 'varchar', length: 45 })
  ipAddress: string | undefined;

  @Column({ type: 'text' })
  message: string | undefined;

  @Column({ type: 'text', nullable: true })
  response: string | null | undefined;

  @Column({ type: 'varchar', length: 10, default: 'model' })
  source: string | undefined;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date | undefined;
}
