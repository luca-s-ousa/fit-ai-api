import "dotenv/config";

import Fastify from "fastify";

const fastify = Fastify({
  logger: true,
});

fastify.get("/", function (request, reply) {
  reply.send({ hello: "world" });
});

// Como estamos usando o ESM pode se usar o try catch sem async/await

try {
  await fastify.listen({ port: Number(process.env.PORT) || 8081 });
} catch (error) {
  fastify.log.error(error);
  process.exit(1);
}
