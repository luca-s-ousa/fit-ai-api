import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";
export class UpsertUserTrainData {
    async execute(dto) {
        const user = await prisma.user.findUnique({
            where: { id: dto.userId },
        });
        if (!user) {
            throw new NotFoundError("User not found");
        }
        const bodyFatStoredValue = Math.round(dto.bodyFatPercentage);
        const updated = await prisma.user.update({
            where: { id: dto.userId },
            data: {
                weightInGrams: dto.weightInGrams,
                heightInCentimeters: dto.heightInCentimeters,
                age: dto.age,
                bodyFatPercentage: bodyFatStoredValue,
            },
        });
        return {
            userId: updated.id,
            userName: updated.name,
            weightInGrams: updated.weightInGrams,
            heightInCentimeters: updated.heightInCentimeters,
            age: updated.age,
            bodyFatPercentage: updated.bodyFatPercentage,
        };
    }
}
