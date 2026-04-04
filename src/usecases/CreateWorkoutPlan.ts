import { NotFoundError } from "../errors/index.js";
import { weekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

// Data Transfer Object
interface DTO {
  userId: string;
  name: string;
  workoutDays: Array<{
    name: string;
    weekDay: weekDay;
    isRest: boolean;
    estimatedDurationInSeconds: number;
    exercises: Array<{
      name: string;
      order: number;
      sets: number;
      reps: number;
      restTimeInSeconds: number;
    }>;
  }>;
}

export class CreateWorkoutPlan {
  async execute(dto: DTO) {
    const existingWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        isAcive: true,
      },
    });

    // Transaction - Atomicidade
    return prisma.$transaction(async (tx) => {
      if (existingWorkoutPlan) {
        await tx.workoutPlan.update({
          where: { id: existingWorkoutPlan.id },
          data: {
            isAcive: false,
          },
        });
      }

      const workoutPlan = await tx.workoutPlan.create({
        data: {
          name: dto.name,
          userId: dto.userId,
          isAcive: true,
          workoutDays: {
            create: dto.workoutDays.map((workoutDay) => ({
              name: workoutDay.name,
              weekDay: workoutDay.weekDay,
              isRest: workoutDay.isRest,
              estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
              exercises: {
                create: workoutDay.exercises.map((exercise) => ({
                  name: exercise.name,
                  order: exercise.order,
                  sets: exercise.sets,
                  reps: exercise.reps,
                  restTimeInSeconds: exercise.restTimeInSeconds,
                })),
              },
            })),
          },
        },
      });

      const result = await tx.workoutPlan.findUnique({
        where: {
          id: workoutPlan.id,
        },
        include: {
          workoutDays: {
            include: {
              exercises: true,
            },
          },
        },
      });

      if (!result) {
        throw new NotFoundError("Workout plan not found");
      }

      return result;
    });
  }
}
