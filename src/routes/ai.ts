import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText, tool, UIMessage } from "ai";
import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import z from "zod";

import { weekDay } from "../generated/prisma/enums.js";
import { auth } from "../lib/auth.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { GetUserTrainData } from "../usecases/GetUserTrainData.js";
import { GetWorkoutPlans } from "../usecases/GetWorkoutPlans.js";
import { UpsertUserTrainData } from "../usecases/UpsertUserTrainData.js";

export const aiRoutes = async (app: FastifyInstance) => {
  app.post("/ai", async (request, reply) => {
    const { messages } = request.body as { messages: UIMessage[] };

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      return reply.status(401).send({
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    }

    const result = streamText({
      model: google("gemini-2.0-flash"),
      system: "",
      tools: {
        // @ts-ignore
        getUserTrainData: tool({
          description: "Busca os dados de perfil e medidas do usuário (peso, altura, idade, % de gordura)",
          inputSchema: z.object({}),
          execute: async () => {
            const usecase = new GetUserTrainData();
            const data = await usecase.execute({ userId: session.user.id });
            return data;
          },
        }),
        // @ts-ignore
        updateUserTrainData: tool({
          description: "Atualiza os dados de perfil e medidas do usuário",
          inputSchema: z.object({
            weightInGrams: z.number().int().positive().describe("Peso em gramas"),
            heightInCentimeters: z.number().int().positive().describe("Altura em centímetros"),
            age: z.number().int().positive().describe("Idade em anos"),
            bodyFatPercentage: z.number().min(0).max(100).describe("Percentual de gordura (ex: 15 para 15%)"),
          }),
          execute: async (input: {
            weightInGrams: number;
            heightInCentimeters: number;
            age: number;
            bodyFatPercentage: number;
          }) => {
            const usecase = new UpsertUserTrainData();
            return await usecase.execute({ userId: session.user.id, ...input });
          },
        }),
        // @ts-ignore
        getWorkoutPlans: tool({
          description: "Lista os planos de treino do usuário",
          inputSchema: z.object({
            active: z.boolean().optional().describe("Se true, retorna apenas planos ativos"),
          }),
          execute: async (input: { active?: boolean }) => {
            const usecase = new GetWorkoutPlans();
            return await usecase.execute({ userId: session.user.id, active: input.active });
          },
        }),
        // @ts-ignore
        createWorkoutPlan: tool({
          description: "Cria um novo plano de treino completo",
          inputSchema: z.object({
            name: z.string().trim().min(1).describe("Nome do plano de treino"),
            workoutDays: z.array(
              z.object({
                name: z.string().trim().min(1).describe("Nome do dia de treino"),
                weekDay: z.enum(weekDay).describe("Dia da semana"),
                isRest: z.boolean().default(false).describe("Se é dia de descanso"),
                estimatedDurationInSeconds: z.number().min(1).describe("Duração estimada em segundos"),
                coverImageUrl: z.string().url().optional().describe("URL da imagem de capa"),
                exercises: z.array(
                  z.object({
                    name: z.string().trim().min(1).describe("Nome do exercício"),
                    order: z.number().min(0).describe("Ordem do exercício"),
                    sets: z.number().min(1).describe("Número de séries"),
                    reps: z.number().min(1).describe("Número de repetições"),
                    restTimeInSeconds: z.number().min(1).describe("Tempo de descanso em segundos"),
                  }),
                ).describe("Lista de exercícios"),
              }),
            ).describe("Array com exatamente 7 dias de treino (MONDAY a SUNDAY)"),
          }),
          // @ts-ignore
          execute: async (input: {
            name: string;
            workoutDays: Array<{
              name: string;
              weekDay: weekDay;
              isRest: boolean;
              estimatedDurationInSeconds: number;
              coverImageUrl?: string;
              exercises: Array<{
                name: string;
                order: number;
                sets: number;
                reps: number;
                restTimeInSeconds: number;
              }>;
            }>;
          }) => {
            const usecase = new CreateWorkoutPlan();
            const createdData = await usecase.execute({
              userId: session.user.id,
              name: input.name,
              workoutDays: input.workoutDays.map((day) => ({
                name: day.name,
                weekDay: day.weekDay,
                isRest: day.isRest,
                estimatedDurationInSeconds: day.estimatedDurationInSeconds,
                coverImageUrl: day.coverImageUrl,
                exercises: day.exercises.map((exercise) => ({
                  name: exercise.name,
                  order: exercise.order,
                  sets: exercise.sets,
                  reps: exercise.reps,
                  restTimeInSeconds: exercise.restTimeInSeconds,
                })),
              })),
            });
            return { success: true, workoutPlanId: createdData.id };
          },
        }),
      },
      stopWhen: stepCountIs(5),
      messages: await convertToModelMessages(messages),
    });

    const response = result.toUIMessageStreamResponse();
    reply.status(response.status);
    response.headers.forEach((value, key) => reply.header(key, value));
    return reply.send(response.body);
  });
};