import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('quran_verses')
export class QuranVerseEntity {
  // Primary key in "chapter:verse" format, e.g. "1:1"
  @PrimaryColumn({ type: 'varchar', length: 10 })
  id!: string;

  @Column({ type: 'int' })
  chapter_number!: number;

  @Column({ type: 'varchar', length: 150 })
  chapter_name!: string;

  @Column({ type: 'int' })
  verse_number!: number;

  @Column({ type: 'varchar', length: 20 })
  chapter_type!: string;

  @Column({ type: 'int' })
  total_verses!: number;

  @Column({ type: 'text' })
  text_ar!: string;

  @Column({ type: 'text', nullable: true })
  text_bn!: string;

  @Column({ type: 'text', nullable: true })
  text_en!: string;

  @Column({ type: 'text', nullable: true })
  text_es!: string;

  @Column({ type: 'text', nullable: true })
  text_fr!: string;

  @Column({ type: 'text', nullable: true })
  text_id!: string;

  @Column({ type: 'text', nullable: true })
  text_ru!: string;

  @Column({ type: 'text', nullable: true })
  text_tr!: string;

  @Column({ type: 'text', nullable: true })
  text_zh!: string;

  // Stored as text in TypeORM; actual DB column is vector(768) managed via raw SQL
  @Column({ type: 'text', nullable: true })
  embedding!: string;

  @Column({ type: 'timestamptz', nullable: true })
  seeded_at!: Date;
}
