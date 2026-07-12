import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('quran_tafsirs')
export class QuranTafsirEntity {
  // Primary key in "chapter:verse" format, e.g. "1:1"
  @PrimaryColumn({ type: 'varchar', length: 15 })
  id!: string;

  @Column({ type: 'int' })
  chapter_number!: number;

  @Column({ type: 'int' })
  verse_number!: number;

  @Column({ type: 'varchar', length: 15 })
  verse_key!: string;

  @Column({ type: 'text' })
  text_html!: string;

  @Column({ type: 'text', nullable: true })
  text_plain!: string | null;

  // Stored as text in TypeORM; actual DB column is vector(768) managed via raw SQL
  @Column({ type: 'text', nullable: true })
  embedding!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  seeded_at!: Date | null;
}
