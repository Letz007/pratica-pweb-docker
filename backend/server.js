import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bd from "./src/models/index.js";
import redis from "./src/config/redis.js";
import authRoutes from "./src/routes/auth.js";

dotenv.config();

const { Task } = bd;

//
// 🔹 Testa conexão com o banco
//
try {
  await bd.sequelize.authenticate();
  console.log("Conexão com o banco de dados estabelecida com sucesso.");
} catch (error) {
  console.error("Erro ao conectar ao banco de dados:", error);
  process.exit(1);
}

const app = express();
const port = 3000;

app.use(express.json());
app.use("/", authRoutes);
app.use(cors());

//
// 🔹 Rota inicial
//
app.get("/", (req, res) => {
  res.json({ message: "Hello World" });
});

//
// 🔹 GET /tasks — com cache Redis
//
app.get("/tasks", async (req, res) => {
  try {
    const cacheKey = "tasks:all";

    // 1 — Tenta usar cache
    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log("CACHE HIT");
      return res.json(JSON.parse(cached));
    }

    console.log("CACHE MISS");

    // 2 — Busca no banco
    const tasks = await Task.findAll();

    // 3 — Guarda no cache por 60s
    await redis.set(cacheKey, JSON.stringify(tasks), "EX", 60);

    return res.json(tasks);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao buscar tarefas" });
  }
});


//
// 🔹 POST /tasks — cria tarefa + limpa cache
//
app.post("/tasks", async (req, res) => {
  try {
    const { description } = req.body;

    if (!description)
      return res.status(400).json({ error: "Descrição obrigatória" });

    const task = await Task.create({ description, completed: false });

    // Limpa cache após alteração
    await redis.del("tasks:all");

    return res.status(201).json(task);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar tarefa" });
  }
});


//
// 🔹 GET /tasks/:id
//
app.get("/tasks/:id", async (req, res) => {
  const task = await Task.findByPk(req.params.id);
  if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });
  res.json(task);
});


//
// 🔹 PUT /tasks/:id — edita + limpa cache
//
app.put("/tasks/:id", async (req, res) => {
  try {
    const { description, completed } = req.body;
    const task = await Task.findByPk(req.params.id);

    if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });

    await task.update({ description, completed });

    // Limpa cache porque os dados mudaram
    await redis.del("tasks:all");

    res.json(task);

  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar tarefa" });
  }
});


//
// 🔹 DELETE /tasks/:id — remove + limpa cache
//
app.delete("/tasks/:id", async (req, res) => {
  try {
    const deleted = await Task.destroy({ where: { id: req.params.id } });

    if (!deleted) return res.status(404).json({ error: "Tarefa não encontrada" });

    // Limpa cache
    await redis.del("tasks:all");

    res.status(204).send();

  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar tarefa" });
  }
});


//
// 🔹 Inicialização do servidor
//
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Database is running on port ${process.env.DB_PORT}`);
});
