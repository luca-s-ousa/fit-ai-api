import { prisma } from "../lib/db.js";
export class GetWorkoutPlans {
    async execute(dto) {
        const plans = await prisma.workoutPlan.findMany({
            where: {
                userId: dto.userId,
                ...(dto.active !== undefined && { isAcive: dto.active }),
            },
            include: {
                workoutDays: {
                    include: {
                        exercises: {
                            orderBy: {
                                order: "asc",
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        return plans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            isActive: plan.isAcive,
            workoutDays: plan.workoutDays.map((day) => ({
                id: day.id,
                name: day.name,
                weekDay: day.weekDay,
                isRest: day.isRest,
                coverImageUrl: day.coverImageUrl ?? undefined,
                estimatedDurationInSeconds: day.estimatedDurationInSeconds,
                exercises: day.exercises.map((ex) => ({
                    id: ex.id,
                    name: ex.name,
                    order: ex.order,
                    workoutDayId: ex.workoutDayId,
                    sets: ex.sets,
                    reps: ex.reps,
                    restTimeInSeconds: ex.restTimeInSeconds,
                })),
            })),
        }));
    }
}
