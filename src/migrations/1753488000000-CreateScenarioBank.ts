import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateScenarioBank1753488000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "scenario_bank" (
        "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
        "level"       INTEGER NOT NULL,
        "district"    VARCHAR(20) NOT NULL,
        "locale"      VARCHAR(5) NOT NULL DEFAULT 'en',
        "situation"   TEXT NOT NULL,
        "options"     JSONB NOT NULL,
        "status"      VARCHAR(10) NOT NULL DEFAULT 'active',
        "timesServed" INTEGER NOT NULL DEFAULT 0,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_scenario_bank" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_scenario_bank_level_district"
        ON "scenario_bank" ("level", "district", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scenario_bank_level_district"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "scenario_bank"`);
  }
}
