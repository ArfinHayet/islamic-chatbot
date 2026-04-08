import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('hadith_entries')
export class HadithEntity {
  // Primary key in "collection:hadithNumber" format, e.g. "bukhari:1"
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id!: string;

  @Column({ type: 'varchar', length: 30 })
  collection!: string;

  @Column({ type: 'varchar', length: 100 })
  collection_name!: string;

  @Column({ type: 'int' })
  hadith_number!: number;

  @Column({ type: 'int', nullable: true })
  chapter_number!: number | null;

  @Column({ type: 'text', nullable: true })
  chapter_name!: string | null;

  @Column({ type: 'text' })
  text_ar!: string;

  @Column({ type: 'text', nullable: true })
  text_en!: string | null;

  @Column({ type: 'text', nullable: true })
  narrator_en!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  grade!: string | null;

  // Stored as text in TypeORM; actual DB column is vector(768) managed via raw SQL
  @Column({ type: 'text', nullable: true })
  embedding!: string;

  @Column({ type: 'timestamptz', nullable: true })
  seeded_at!: Date;
}
