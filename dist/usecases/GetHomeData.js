import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";
import { calculateWorkoutStreak } from "../lib/workout-streak.js";
dayjs.extend(utc);
export class GetHomeData {
    async execute({ userId, date }) {
        const queryDate = dayjs.utc(date);
        // 1. Encontrar plano de treino ativo
        const activePlan = await prisma.workoutPlan.findFirst({
            where: {
                userId,
                isAcive: true,
            },
            include: {
                workoutDays: {
                    include: {
                        exercises: true,
                    },
                },
            },
        });
        if (!activePlan) {
            throw new NotFoundError("Active workout plan not found");
        }
        // 2. Extrair o dia de hoje
        const weekdaysMapping = [
            "SUNDAY",
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY",
            "SATURDAY",
        ];
        const currentWeekDay = weekdaysMapping[queryDate.day()];
        const todayWorkoutDayRecord = activePlan.workoutDays.find((d) => d.weekDay === currentWeekDay);
        const todayWorkoutDay = todayWorkoutDayRecord
            ? {
                workoutPlanId: todayWorkoutDayRecord.workoutPlanId,
                id: todayWorkoutDayRecord.id,
                name: todayWorkoutDayRecord.name,
                isRest: todayWorkoutDayRecord.isRest,
                weekDay: todayWorkoutDayRecord.weekDay,
                estimatedDurationInSeconds: todayWorkoutDayRecord.estimatedDurationInSeconds,
                coverImageUrl: todayWorkoutDayRecord.coverImageUrl || undefined,
                exercisesCount: todayWorkoutDayRecord.exercises.length,
            }
            : undefined;
        // 3. Montar consistencyByDay
        const weekStart = queryDate.startOf("week");
        const weekEnd = queryDate.endOf("week");
        const sessionsThisWeek = await prisma.workoutSession.findMany({
            where: {
                workoutDay: {
                    workoutPlan: {
                        userId: userId,
                    },
                },
                startedAt: {
                    gte: weekStart.toDate(),
                    lte: weekEnd.toDate(),
                },
            },
        });
        const consistencyByDay = {};
        for (let i = 0; i < 7; i++) {
            const d = weekStart.add(i, "day").format("YYYY-MM-DD");
            consistencyByDay[d] = {
                workoutDayCompleted: false,
                workoutDayStarted: false,
            };
        }
        for (const session of sessionsThisWeek) {
            const d = dayjs.utc(session.startedAt).format("YYYY-MM-DD");
            if (consistencyByDay[d]) {
                consistencyByDay[d].workoutDayStarted = true;
                if (session.completedAt) {
                    consistencyByDay[d].workoutDayCompleted = true;
                }
            }
        }
        const completedSessions = await prisma.workoutSession.findMany({
            where: {
                workoutDay: {
                    workoutPlanId: activePlan.id,
                },
                completedAt: {
                    not: null,
                },
            },
            select: {
                startedAt: true,
            },
        });
        const workoutStreak = calculateWorkoutStreak({
            referenceDate: date,
            workoutDays: activePlan.workoutDays,
            completedSessions,
        });
        return {
            activeWorkoutPlanId: activePlan.id,
            todayWorkoutDay,
            workoutStreak,
            consistencyByDay,
        };
    }
}
