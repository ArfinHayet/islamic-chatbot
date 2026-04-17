import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMessageLogs1713312000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "message_logs" (
        "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
        "userId"      VARCHAR(255) NOT NULL,
        "ipAddress"   VARCHAR(45) NOT NULL,
        "message"     TEXT NOT NULL,
        "response"    TEXT,
        "source"      VARCHAR(10) NOT NULL DEFAULT 'model',
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_logs" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "message_logs"`);
  }
}
