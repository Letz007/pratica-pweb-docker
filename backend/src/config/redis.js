import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: process.env.REDIS_PORT || 6379,
});

redis.on("connect", () => console.log("Redis conectado"));
redis.on("error", (err) => console.error("Erro no Redis", err));

export default redis;
