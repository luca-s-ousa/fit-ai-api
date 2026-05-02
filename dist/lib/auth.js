import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
// Criar rotas de autenticacao no Swagger
import { openAPI } from "better-auth/plugins";
import { prisma } from "./db.js";
const getRequiredEnv = (name) => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
};
export const auth = betterAuth({
    baseURL: getRequiredEnv("BETTER_AUTH_URL"),
    trustedOrigins: ["http://localhost:3000", "http://localhost:8081"],
    socialProviders: {
        google: {
            clientId: getRequiredEnv("GOOGLE_CLIENT_ID"),
            clientSecret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
        },
    },
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    plugins: [openAPI()],
});
