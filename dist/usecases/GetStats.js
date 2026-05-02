import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { prisma } from "../lib/db.js";
import { calculateWorkoutStreak } from "../lib/workout-streak.js";
dayjs.extend(utc);
export class GetStats {
    async execute({ userId, from, to }) {
        const fromDate = dayjs.utc(from).startOf("day");
        const toDate = dayjs.utc(to).endOf("day");
        const sessions = await prisma.workoutSession.findMany({
            where: {
                workoutDay: {
                    workoutPlan: {
                        userId: userId,
                    },
                },
                startedAt: {
                    gte: fromDate.toDate(),
                    lte: toDate.toDate(),
                },
            },
            include: {
                workoutDay: true,
            },
        });
        const consistencyByDay = {};
        let completedWorkoutsCount = 0;
        let totalTimeInSeconds = 0;
        for (const session of sessions) {
            const d = dayjs.utc(session.startedAt).format("YYYY-MM-DD");
            if (!consistencyByDay[d]) {
                consistencyByDay[d] = {
                    workoutDayStarted: false,
                    workoutDayCompleted: false,
                };
            }
            consistencyByDay[d].workoutDayStarted = true;
            if (session.completedAt) {
                consistencyByDay[d].workoutDayCompleted = true;
            }
        }
        for (const session of sessions) {
            if (session.completedAt) {
                completedWorkoutsCount++;
                const duration = dayjs(session.completedAt).diff(dayjs(session.startedAt), "second");
                totalTimeInSeconds += duration;
            }
        }
        const conclusionRate = sessions.length > 0 ? completedWorkoutsCount / sessions.length : 0;
        const activePlan = await prisma.workoutPlan.findFirst({
            where: {
                userId,
                isAcive: true,
            },
            include: {
                workoutDays: true,
            },
        });
        let workoutStreak = 0;
        if (activePlan) {
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
            workoutStreak = calculateWorkoutStreak({
                referenceDate: dayjs.utc().format("YYYY-MM-DD"),
                workoutDays: activePlan.workoutDays,
                completedSessions,
            });
        }
        return {
            workoutStreak,
            consistencyByDay,
            completedWorkoutsCount,
            conclusionRate,
            totalTimeInSeconds,
        };
    }
}
