import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('islamic_cache')
export class CacheEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text' })
  answer: string;

  // Stored as text in TypeORM; actual DB column is vector(768) managed via raw SQL
  @Column({ type: 'text' })
  embedding: string;

  @CreateDateColumn()
  createdAt: Date;
}
