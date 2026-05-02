import { ForbiddenError, NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";
export class GetWorkoutDay {
    async execute(dto) {
        const workoutDay = await prisma.workoutDay.findUnique({
            where: {
                id: dto.workoutDayId, workoutPlanId: dto.workoutPlanId
            },
            include: {
                workoutPlan: true,
                exercises: {
                    orderBy: {
                        order: "asc",
                    },
                },
                sessions: {
                    orderBy: {
                        startedAt: "desc",
                    },
                },
            },
        });
        if (!workoutDay || workoutDay.workoutPlanId !== dto.workoutPlanId) {
            throw new NotFoundError("Workout day not found");
        }
        if (workoutDay.workoutPlan.userId !== dto.userId) {
            throw new ForbiddenError("You are not the owner of this workout plan");
        }
        return {
            id: workoutDay.id,
            name: workoutDay.name,
            isRest: workoutDay.isRest,
            coverImageUrl: workoutDay.coverImageUrl ?? undefined,
            estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
            exercises: workoutDay.exercises.map((ex) => ({
                id: ex.id,
                name: ex.name,
                order: ex.order,
                workoutDayId: ex.workoutDayId,
                sets: ex.sets,
                reps: ex.reps,
                restTimeInSeconds: ex.restTimeInSeconds,
            })),
            weekDay: workoutDay.weekDay,
            sessions: workoutDay.sessions.map((session) => ({
                id: session.id,
                workoutDayId: session.workoutDayId,
                startedAt: session.startedAt?.toISOString() ?? undefined,
                completedAt: session.completedAt?.toISOString() ?? undefined,
            })),
        };
    }
}
