import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText, tool, UIMessage } from "ai";
import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { weekDay } from "../generated/prisma/enums.js";
import { auth } from "../lib/auth.js";
import { ErrorSchema } from "../schemas/index.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { GetUserTrainData } from "../usecases/GetUserTrainData.js";
import { GetWorkoutPlans } from "../usecases/GetWorkoutPlans.js";
import { UpsertUserTrainData } from "../usecases/UpsertUserTrainData.js";

const SYSTEM_PROMPT = `
Você é um personal trainer virtual especialista em montagem de planos de treino. Seu objetivo é ajudar pessoas comuns — que não entendem muito de musculação — a começar a treinar de forma inteligente e segura.

## Comportamento Geral

- Tom amigável, motivador e simples. Evite jargões técnicos.
- Respostas curtas e objetivas. Não exagere nas explicações.
- SEMPRE chame a tool \`getUserTrainData\` no início de qualquer conversa, antes de qualquer outro passo.
  - Se retornar null (usuário sem dados): faça perguntas em uma ÚNICA mensagem perguntando nome, peso (em kg), altura (em cm), idade e % estimado de gordura corporal. Após receber as respostas, salve com a tool \`updateUserTrainData\` (converta o peso de kg para gramas multiplicando por 1000; o % de gordura é um INTEIRO de 0 a 100, ex: 15 para 15%).
  - Se já tiver dados: cumprimente o usuário pelo nome e pergunte como pode ajudar.

## Criação de Plano de Treino

Quando o usuário quiser criar um plano de treino, faça APENAS estas perguntas (em uma única mensagem):
1. Qual é o seu objetivo? (ex: perder peso, ganhar músculo, melhorar condicionamento)
2. Quantos dias por semana você pode treinar?
3. Tem alguma lesão ou restrição física?

Com base nas respostas, monte o plano e crie usando a tool \`createWorkoutPlan\`.

O plano DEVE ter exatamente 7 dias (MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY).
Dias sem treino: \`isRest: true\`, \`exercises: []\`, \`estimatedDurationInSeconds: 0\`.

## Divisões de Treino (Splits)

Escolha a divisão com base nos dias disponíveis:
- 2-3 dias/semana: Full Body ou ABC (A: Peito+Tríceps | B: Costas+Bíceps | C: Pernas+Ombros)
- 4 dias/semana: Upper/Lower (recomendado) ou ABCD (A: Peito+Tríceps | B: Costas+Bíceps | C: Pernas | D: Ombros+Abdômen)
- 5 dias/semana: PPLUL — Push/Pull/Legs + Upper/Lower
- 6 dias/semana: PPL 2x — Push/Pull/Legs repetido

## Princípios de Montagem

- Agrupe músculos sinérgicos: peito+tríceps, costas+bíceps
- Exercícios compostos primeiro, isoladores depois
- 4 a 8 exercícios por sessão
- 3-4 séries por exercício | 8-12 reps (hipertrofia) ou 4-6 reps (força)
- Descanso: 60-90s (hipertrofia) | 2-3 min (compostos pesados)
- Não treinar o mesmo grupo muscular em dias consecutivos
- Use nomes descritivos para cada dia (ex: "Superior A - Peito e Costas", "Descanso")

## Imagens de Capa (coverImageUrl)

SEMPRE forneça um coverImageUrl para cada dia de treino. Alterne entre as opções de cada categoria:

Dias superiores (peito, costas, ombros, bíceps, tríceps, push, pull, upper, full body, descanso):
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO3y8pQ6GBg8iqe9pP2JrHjwd1nfKtVSQskI0v
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOW3fJmqZe4yoUcwvRPQa8kmFprzNiC30hqftL

Dias inferiores (pernas, glúteos, quadríceps, posterior, panturrilha, legs, lower):
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOgCHaUgNGronCvXmSzAMs1N3KgLdE5yHT6Ykj
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO85RVu3morROwZk5NPhs1jzH7X8TyEvLUCGxY

Alterne entre as duas URLs de cada categoria para variar.
`.trim();

const AiBodySchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())),
});

export const aiRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["AI"],
      summary: "Chat with the AI personal trainer",
      body: AiBodySchema,
      response: {
        401: ErrorSchema,
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const messages = (request.body as z.infer<typeof AiBodySchema>).messages as unknown as UIMessage[];

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
      system: SYSTEM_PROMPT,
      tools: {
        // @ts-ignore
        getUserTrainData: tool({
          description: "Busca os dados de perfil e medidas do usuário autenticado (peso, altura, idade, % de gordura). Sempre chamar antes de qualquer interação.",
          inputSchema: z.object({}),
          execute: async () => {
            const usecase = new GetUserTrainData();
            return await usecase.execute({ userId: session.user.id });
          },
        }),
        // @ts-ignore
        updateUserTrainData: tool({
          description: "Cria ou atualiza os dados de perfil e medidas do usuário autenticado.",
          inputSchema: z.object({
            weightInGrams: z.number().int().positive().describe("Peso em gramas (ex: 75kg = 75000)"),
            heightInCentimeters: z.number().int().positive().describe("Altura em centímetros (ex: 175)"),
            age: z.number().int().positive().describe("Idade em anos"),
            bodyFatPercentage: z.number().int().min(0).max(100).describe("Percentual de gordura corporal, inteiro de 0 a 100 (ex: 15 para 15%)"),
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
          description: "Lista todos os planos de treino do usuário autenticado.",
          inputSchema: z.object({}),
          execute: async () => {
            const usecase = new GetWorkoutPlans();
            return await usecase.execute({ userId: session.user.id });
          },
        }),
        // @ts-ignore
        createWorkoutPlan: tool({
          description: "Cria um novo plano de treino completo com exatamente 7 dias (MONDAY a SUNDAY). Dias de descanso devem ter isRest: true, exercises: [] e estimatedDurationInSeconds: 0.",
          inputSchema: z.object({
            name: z.string().trim().min(1).describe("Nome do plano de treino"),
            workoutDays: z
              .array(
                z.object({
                  name: z.string().trim().min(1).describe("Nome descritivo do dia (ex: 'Superior A - Peito e Costas', 'Descanso')"),
                  weekDay: z.enum(weekDay).describe("Dia da semana (MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY)"),
                  isRest: z.boolean().describe("Se é dia de descanso"),
                  estimatedDurationInSeconds: z.number().min(0).describe("Duração estimada em segundos (0 para dias de descanso)"),
                  coverImageUrl: z.string().url().describe("URL da imagem de capa do dia de treino"),
                  exercises: z
                    .array(
                      z.object({
                        name: z.string().trim().min(1).describe("Nome do exercício"),
                        order: z.number().int().min(0).describe("Ordem de execução (começa em 0)"),
                        sets: z.number().int().min(1).describe("Número de séries"),
                        reps: z.number().int().min(1).describe("Número de repetições por série"),
                        restTimeInSeconds: z.number().int().min(0).describe("Tempo de descanso entre séries em segundos"),
                      }),
                    )
                    .describe("Lista de exercícios do dia (vazia para dias de descanso)"),
                }),
              )
              .length(7)
              .describe("Array com exatamente 7 dias de treino (MONDAY a SUNDAY, nessa ordem)"),
          }),
          // @ts-ignore
          execute: async (input: {
            name: string;
            workoutDays: Array<{
              name: string;
              weekDay: weekDay;
              isRest: boolean;
              estimatedDurationInSeconds: number;
              coverImageUrl: string;
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
            const created = await usecase.execute({
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
            return { success: true, workoutPlanId: created.id };
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
    },
  });
};