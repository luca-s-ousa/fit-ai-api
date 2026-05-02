import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { weekDay } from "../generated/prisma/enums.js";

dayjs.extend(utc);

interface WorkoutDayForStreak {
  weekDay: weekDay;
}

interface CompletedSessionForStreak {
  startedAt: Date;
}

interface CalculateWorkoutStreakInput {
  referenceDate: string;
  workoutDays: WorkoutDayForStreak[];
  completedSessions: CompletedSessionForStreak[];
}

const weekDaysByDayjsIndex: weekDay[] = [
  weekDay.SUNDAY,
  weekDay.MONDAY,
  weekDay.TUESDAY,
  weekDay.WEDNESDAY,
  weekDay.THURSDAY,
  weekDay.FRIDAY,
  weekDay.SATURDAY,
];

export const calculateWorkoutStreak = ({
  referenceDate,
  workoutDays,
  completedSessions,
}: CalculateWorkoutStreakInput) => {
  const workoutPlanDaysSet = new Set(workoutDays.map((day) => day.weekDay));

  if (workoutPlanDaysSet.size === 0) {
    return 0;
  }

  const completedDatesSet = new Set(
    completedSessions.map((session) =>
      dayjs.utc(session.startedAt).format("YYYY-MM-DD"),
    ),
  );

  let streak = 0;
  let checkDate = dayjs.utc(referenceDate).startOf("day");
  const referenceDateStr = checkDate.format("YYYY-MM-DD");
  let loopCount = 0;

  while (loopCount < 365) {
    loopCount++;

    const weekDayForDate = weekDaysByDayjsIndex[checkDate.day()];
    const dateStr = checkDate.format("YYYY-MM-DD");

    if (!workoutPlanDaysSet.has(weekDayForDate)) {
      checkDate = checkDate.subtract(1, "day");
      continue;
    }

    if (completedDatesSet.has(dateStr)) {
      streak++;
      checkDate = checkDate.subtract(1, "day");
      continue;
    }

    if (dateStr === referenceDateStr) {
      checkDate = checkDate.subtract(1, "day");
      continue;
    }

    break;
  }

  return streak;
};
