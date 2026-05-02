import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { prisma } from "../lib/db.js";
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
        let streak = 0;
        if (activePlan) {
            const weekdaysMapping = [
                "SUNDAY",
                "MONDAY",
                "TUESDAY",
                "WEDNESDAY",
                "THURSDAY",
                "FRIDAY",
                "SATURDAY",
            ];
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
            let checkDate = dayjs.utc();
            let loopCount = 0;
            const todayStr = checkDate.format("YYYY-MM-DD");
            const currentWeekDay = weekdaysMapping[checkDate.day()];
            const isRestToday = activePlan.workoutDays.find((d) => d.weekDay === currentWeekDay)
                ?.isRest ?? false;
            if (completedDatesSet.has(todayStr) || isRestToday) {
                streak++;
                checkDate = checkDate.subtract(1, "day");
            }
            else {
                checkDate = checkDate.subtract(1, "day");
            }
            while (loopCount < 365) {
                loopCount++;
                const dateStr = checkDate.format("YYYY-MM-DD");
                const weekdayStr = weekdaysMapping[checkDate.day()];
                const isRest = activePlan.workoutDays.find((d) => d.weekDay === weekdayStr)
                    ?.isRest ?? false;
                if (completedDatesSet.has(dateStr) || isRest) {
                    streak++;
                    checkDate = checkDate.subtract(1, "day");
                }
                else {
                    break;
                }
            }
        }
        return {
            workoutStreak: streak,
            consistencyByDay,
            completedWorkoutsCount,
            conclusionRate,
            totalTimeInSeconds,
        };
    }
}
