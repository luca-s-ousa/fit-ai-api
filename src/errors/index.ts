export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class WorkoutPlanNotActiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkoutPlanNotActiveError";
  }
}

export class WorkoutDayAlreadyStartedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkoutDayAlreadyStartedError";
  }
}

export class WorkoutDayIsRestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkoutDayIsRestError";
  }
}
