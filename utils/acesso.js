// utils/acesso.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Corrige __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const codesPath = path.join(__dirname, "..", "codes.json");
const usersPath = path.join(__dirname, "..", "users.json");

function loadJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function verificarAcesso(userId) {
  const users = loadJSON(usersPath);
  const user = users[userId];

  if (!user) return false;
  const agora = new Date();
  return new Date(user.validade) > agora;
}

function aplicarCodigo(userId, codigo) {
  const codes = loadJSON(codesPath);
  const users = loadJSON(usersPath);

  const codigoInfo = codes[codigo];
  if (!codigoInfo) return { sucesso: false, mensagem: "❌ Código inválido." };

  const dias = codigoInfo.dias;
  const agora = new Date();
  let validade = new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000);

  // Se já tem acesso válido, soma os dias
  if (users[userId] && users[userId].validade) {
    const validadeAtual = new Date(users[userId].validade);
    if (validadeAtual > agora) {
      validade = new Date(validadeAtual.getTime() + dias * 24 * 60 * 60 * 1000);
    }
  }

  users[userId] = { validade: validade.toISOString() };
  saveJSON(usersPath, users);

  // Remove código usado
  delete codes[codigo];
  saveJSON(codesPath, codes);

  return { sucesso: true, mensagem: `✅ Acesso liberado por ${dias} dias.` };
}

function diasRestantes(userId) {
  const users = loadJSON(usersPath);
  const user = users[userId];
  if (!user) return 0;

  const agora = new Date();
  const validade = new Date(user.validade);
  const diff = validade - agora;

  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function adicionarCodigo(codigo, dias) {
  const codigos = loadJSON(codesPath);
  codigos[codigo] = {
    dias,
    criado_em: new Date().toISOString(),
  };
  saveJSON(codesPath, codigos);
  return true;
}

function removerCodigo(codigo) {
  const codigos = loadJSON(codesPath);
  if (!codigos[codigo]) return false;
  delete codigos[codigo];
  saveJSON(codesPath, codigos);
  return true;
}

export {
  verificarAcesso,
  aplicarCodigo,
  diasRestantes,
  adicionarCodigo,
  removerCodigo,
};
