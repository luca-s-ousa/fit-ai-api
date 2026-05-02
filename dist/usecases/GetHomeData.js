import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";
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
        if (!todayWorkoutDayRecord) {
            throw new NotFoundError("Workout day for today not found in active plan");
        }
        const todayWorkoutDay = {
            workoutPlanId: todayWorkoutDayRecord.workoutPlanId,
            id: todayWorkoutDayRecord.id,
            name: todayWorkoutDayRecord.name,
            isRest: todayWorkoutDayRecord.isRest,
            weekDay: todayWorkoutDayRecord.weekDay,
            estimatedDurationInSeconds: todayWorkoutDayRecord.estimatedDurationInSeconds,
            coverImageUrl: todayWorkoutDayRecord.coverImageUrl || undefined,
            exercisesCount: todayWorkoutDayRecord.exercises.length,
        };
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
        // 4. Calcular workoutStreak
        // Pegar todas as sessões completadas do usuário (ordenadas por data)
        const allCompletedSessions = await prisma.workoutSession.findMany({
            where: {
                workoutDay: {
                    workoutPlan: {
                        userId: userId,
                    },
                },
                completedAt: {
                    not: null,
                },
            },
            select: {
                startedAt: true,
            },
        });
        const completedDatesSet = new Set(allCompletedSessions.map((s) => dayjs.utc(s.startedAt).format("YYYY-MM-DD")));
        let streak = 0;
        let checkDate = queryDate;
        let loopCount = 0;
        // Checar hoje primeiro
        const todayStr = checkDate.format("YYYY-MM-DD");
        if (completedDatesSet.has(todayStr) || todayWorkoutDayRecord.isRest) {
            streak++;
            checkDate = checkDate.subtract(1, "day");
        }
        else {
            // Se hoje não treinou ainda (e não é descanso),
            // a sequência pode não ter quebrado caso tenha treinado ontem.
            checkDate = checkDate.subtract(1, "day");
        }
        // Continuar checando para trás
        while (loopCount < 365) {
            loopCount++;
            const dateStr = checkDate.format("YYYY-MM-DD");
            const weekdayStr = weekdaysMapping[checkDate.day()];
            const isRest = activePlan.workoutDays.find((d) => d.weekDay === weekdayStr)?.isRest ??
                false;
            if (completedDatesSet.has(dateStr) || isRest) {
                streak++;
                checkDate = checkDate.subtract(1, "day");
            }
            else {
                break;
            }
        }
        return {
            activeWorkoutPlanId: activePlan.id,
            todayWorkoutDay,
            workoutStreak: streak,
            consistencyByDay,
        };
    }
}
