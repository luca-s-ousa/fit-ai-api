import dayjs from "dayjs";
import {
  ForbiddenError,
  NotFoundError,
  WorkoutDayAlreadyStartedError,
  WorkoutPlanNotActiveError,
} from "../errors/index.js";
import { prisma } from "../lib/db.js";

// Data Transfer Object
interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
}

interface OutputDto {
  userWorkoutSessionId: string;
}

export class StartWorkoutSession {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutDay = await prisma.workoutDay.findUnique({
      where: {
        id: dto.workoutDayId,
      },
      include: {
        workoutPlan: true,
        sessions: {
          where: {
            completedAt: null,
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

    if (!workoutDay.workoutPlan.isAcive) {
      throw new WorkoutPlanNotActiveError("Workout plan is not active");
    }

    if (workoutDay.sessions.length > 0) {
      throw new WorkoutDayAlreadyStartedError(
        "There is already an ongoing session for this workout day",
      );
    }

    const session = await prisma.workoutSession.create({
      data: {
        workoutDayId: workoutDay.id,
        startedAt: dayjs().toDate(),
      },
    });

    return {
      userWorkoutSessionId: session.id,
    };
  }
}
