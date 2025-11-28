import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import bd from "../models/index.js";

const { User } = bd;

export async function signin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email e senha são obrigatórios" });

    // 1 — busca usuário
    const user = await User.findOne({ where: { email } });
    if (!user)
      return res.status(404).json({ error: "Usuário não encontrado" });

    // 2 — verifica senha
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: "Senha incorreta" });

    // 3 — gera token
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({ token });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro no login" });
  }
}
