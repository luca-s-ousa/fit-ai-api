/*
  Warnings:

  - Added the required column `estimatedDurationInSeconds` to the `WorkoutDay` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WorkoutDay" ADD COLUMN     "estimatedDurationInSeconds" INTEGER NOT NULL;
