import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFailureReasonToMessageLogs1752326400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "message_logs"
      ADD COLUMN IF NOT EXISTS "failureReason" TEXT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "message_logs"
      DROP COLUMN IF EXISTS "failureReason"
    `);
  }
}
