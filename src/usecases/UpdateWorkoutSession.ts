import dayjs from "dayjs";
import { ForbiddenError, NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
  sessionId: string;
  completedAt: string;
}

interface OutputDto {
  id: string;
  completedAt: string;
  startedAt: string;
}

export class UpdateWorkoutSession {
  async execute(dto: InputDto): Promise<OutputDto> {
    const session = await prisma.workoutSession.findUnique({
      where: {
        id: dto.sessionId,
      },
      include: {
        workoutDay: {
          include: {
            workoutPlan: true,
          },
        },
      },
    });

    if (
      !session ||
      session.workoutDayId !== dto.workoutDayId ||
      session.workoutDay.workoutPlanId !== dto.workoutPlanId
    ) {
      throw new NotFoundError("Workout session not found");
    }

    if (session.workoutDay.workoutPlan.userId !== dto.userId) {
      throw new ForbiddenError("You are not the owner of this workout plan");
    }

    const updatedSession = await prisma.workoutSession.update({
      where: {
        id: dto.sessionId,
      },
      data: {
        completedAt: dayjs(dto.completedAt).toDate(),
      },
    });

    return {
      id: updatedSession.id,
      completedAt: updatedSession.completedAt!.toISOString(),
      startedAt: updatedSession.startedAt.toISOString(),
    };
  }
}
