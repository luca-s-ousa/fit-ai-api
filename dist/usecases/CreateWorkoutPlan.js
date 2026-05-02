import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";
export class CreateWorkoutPlan {
    async execute(dto) {
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
                            coverImageUrl: workoutDay.coverImageUrl,
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
            return {
                id: result.id,
                name: result.name,
                workoutDays: result.workoutDays.map((day) => ({
                    name: day.name,
                    weekDay: day.weekDay,
                    isRest: day.isRest,
                    estimatedDurationInSeconds: day.estimatedDurationInSeconds,
                    coverImageUrl: day.coverImageUrl ?? undefined,
                    exercises: day.exercises.map((exercise) => ({
                        name: exercise.name,
                        order: exercise.order,
                        sets: exercise.sets,
                        reps: exercise.reps,
                        restTimeInSeconds: exercise.restTimeInSeconds,
                    })),
                })),
            };
        });
    }
}
