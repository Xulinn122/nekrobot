import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import fs from "fs";
import ytdl from "ytdl-core";

// OpenAI (se for usar)
// import { Configuration, OpenAIApi } from "openai";

// Utils
import { diasRestantes, verificarAcesso, aplicarCodigo, adicionarCodigo, removerCodigo } from "./utils/acesso.js";

// === SEUS TOKENS ===
const dono = 6938030217;
const DONO_ID = "6938030217";
const telegramToken = "8192481680:AAH-dz9G81fOGRDR71GehGQcVnaNWzym2PM";
//const openaiKey = "SUA_CHAVE_OPENAI";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === BOT CONFIG ===
const bot = new TelegramBot(telegramToken, { polling: true });

export default bot;

// Map pra armazenar quem já verificou
const verifiedUsers = new Map(); // chave: chatId_userId -> true

// Teclado padrão de verificação
function getVerificationKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🔗 Entrar no Channel", url: "https://t.me/nekro_eye" },
        { text: "💬 Suporte", url: "https://t.me/XulinnIsNotBlack" }
      ]
    ]
  };
}

// Função para verificar se o usuário já clicou no botão
function isVerified(chatId, userId) {
  return verifiedUsers.has(`${chatId}_${userId}`);
}

// Função pra proteger comandos
async function requireVerification(msg, commandCallback) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isVerified(chatId, userId)) {
    const text = `
⚠️ Olá, você precisa acessar nosso canal antes de usar os comandos!

Clique no botão abaixo para entrar no canal oficial do bot.
Após entrar, volte aqui e use o comando novamente.
`;

    await bot.sendMessage(chatId, text, { reply_markup: getVerificationKeyboard(), parse_mode: 'Markdown' });
    return false;
  }

  commandCallback(); // usuário verificado, executa comando
  return true;
}

// =================== code ======================= \\

bot.onText(/^~(.+)/, (msg, match) => {
  const userId = msg.from.id.toString();
  const codigo = match[1].trim();

  const res = aplicarCodigo(userId, codigo);
  bot.sendMessage(msg.chat.id, res.mensagem);
});


bot.onText(/\/acesso/, (msg) => {
  const userId = msg.from.id.toString();
  const dias = diasRestantes(userId);

  if (dias <= 0) {
    return bot.sendMessage(msg.chat.id, '🚫 Você não tem acesso ativo. Use `~seucodigo` para ativar.');
  }

  bot.sendMessage(msg.chat.id, `✅ Você tem acesso liberado por mais *${dias} dia(s)*.`, {
    parse_mode: 'Markdown'
  });
});


bot.onText(/^\/addcode\s+(.+?)\s+(\d+)$/, (msg, match) => {
  console.log('Match recebido:', match);

  const userId = msg.from.id.toString();
  if (userId !== DONO_ID) return bot.sendMessage(msg.chat.id, '🚫 Comando restrito ao dono.');

  const codigo = match[1].trim();
  const dias = parseInt(match[2]);

  adicionarCodigo(codigo, dias);

  const texto = `✅ Código *${codigo}* adicionado com validade de ${dias} dias.`
    .replace(/([_*[\]()~`>#+=|{}.!\\-])/g, '\\$1');

  bot.sendMessage(msg.chat.id, texto, {
    parse_mode: 'MarkdownV2'
  });
});

bot.onText(/\/delcode (\S+)/, (msg, match) => {
  const userId = msg.from.id.toString();
  if (userId !== DONO_ID) return bot.sendMessage(msg.chat.id, '🚫 Comando restrito ao dono.');

  const codigo = match[1];
  const sucesso = removerCodigo(codigo);

  if (sucesso) {
    bot.sendMessage(msg.chat.id, `🗑️ Código ${codigo} removido.`, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(msg.chat.id, `⚠️ Código ${codigo} não encontrado.`, { parse_mode: 'Markdown' });
  }
console.log("Match recebido:", match);
});

// Comando /adm
bot.onText(/\/adm/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (userId !== dono) {
        return bot.sendMessage(chatId, '🚫 Acesso negado. Apenas o dono pode ver o painel.');
    }

    // Envia a foto com o botão de reiniciar
    bot.sendPhoto(chatId, 'https://files.catbox.moe/rixmzs.jpg', {
        caption: 'PAINEL ADMIN',
        reply_markup: {
            inline_keyboard: [
                [{ text: '♻️ Reiniciar Bot', callback_data: 'reiniciar_bot' }],
                [{ text: '📋 Codes', callback_data: 'Code_how' }]
            ]
        }
    });
});

// Trata clique no botão
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id;

    if (callbackQuery.data === 'reiniciar_bot') {
        if (userId !== dono) {
            return bot.answerCallbackQuery(callbackQuery.id, {
                text: '🚫 Apenas o dono pode reiniciar o bot.',
                show_alert: true
            });
        }

        // Apaga a mensagem do painel
        try {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (e) {
            console.error('❌ Erro ao apagar mensagem:', e.message);
        }

        // Envia nova mensagem com botão /start
        await bot.sendMessage(msg.chat.id, '♻️ Reiniciando o bot...', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔁 Iniciar novamente', callback_data: 'start_bot' }]
                ]
            }
        });

        await bot.answerCallbackQuery(callbackQuery.id, { text: '✅ Reinício iniciado.' });

        // Reinicia após 1s
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }

    if (callbackQuery.data === 'Code_how') {
        if (userId !== dono) {
            return bot.answerCallbackQuery(callbackQuery.id, {
                text: '🚫 Apenas o dono pode acessar está aba.',
                show_alert: true
            });
        }

        // Apaga a mensagem do painel
        try {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (e) {
            console.error('❌ Erro ao apagar mensagem:', e.message);
        }

        // Envia nova mensagem com botão /start
        await bot.sendMessage(msg.chat.id, '/addcode code 1 -para adicionar um código\n/delcode code -para deletar um código-', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔁 Voltar ao menu', callback_data: 'voltar_menu' }]
                ]}
        }); 
  if (callbackQuery.data === 'voltar_menu') {
    await bot.deleteMessage(chatId, message.message_id).catch(() => {});
    enviarMenuInicial(chatId);
  }
    }
});

//================== code

bot.onText(/\/consulta/, (msg) => {
  const userId = msg.from.id.toString();

  if (!verificarAcesso(userId)) {
    return bot.sendMessage(msg.chat.id, '⛔ Você não tem acesso liberado. Use `~seuCodigo` para ativar.');
  }

  // Aqui vai a lógica da consulta
  bot.sendMessage(msg.chat.id, '🔍 Resultado da sua consulta: ...');
});

// Função que mostra o menu inicial com imagem
function enviarMenuInicial(chatId) {
  const imgData = JSON.parse(fs.readFileSync('img.link.json', 'utf8'));
  const imageUrl = imgData.menu;

  const legendaMenu00 =`
───ׂ─ִ─ꆬ👁️‍🗨️ꆬ─ִ──ׂ──
*『𝐏𝐀𝐈𝐍𝐄𝐋 𝐑𝐀𝐏𝐈𝐃❍̸』*
───ׂ─ִ─ꆬ👁️‍🗨️ꆬ─ִ──ׂ──
├◨ׄ✿ּ  Nekro Eye, seu mais novo
├◨ׄ✿ּ  bot de qualidade!
├◨ׄ✿ּ  By - Xulinn
───ׂ─ִ─ꆬ👁️‍🗨️ꆬ─ִ──ׂ──
*『𝐏𝐀𝐈𝐍𝐄𝐋 𝐑𝐀𝐏𝐈𝐃❍̸』*
───ׂ─ִ─ꆬ👁️‍🗨️ꆬ─ִ──ׂ──`;

  return bot.sendPhoto(chatId, imageUrl, {
    caption: legendaMenu00,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '⏳ CODE ⏳', callback_data: 'howcodeuse' }
        ],
        [
          { text: '⭐ SEU ACESSO ⭐', callback_data: 'acesso' }
        ],
        [
          { text: '🔍 CONSULTAS 🔍', callback_data: 'consultas' }
        ],
        [
          { text: '🩸 SUPORTE 🩸', url: 'https://t.me/hgjulinhg' }
        ],
        [
          { text: '👁️‍🗨️ CHANNEL 👁️‍🗨️', url: 'https://whatsapp.com/channel/0029VbBeZhAJf05kInMhJT2M' }
        ]
      ]
    }
  });
}

// Comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  enviarMenuInicial(chatId);
});

// Callback dos botões
bot.on('callback_query', async (query) => {
  const { data, message, from } = query;
  const chatId = message.chat.id;

  if (data === 'howcodeuse' ) {
    await bot.deleteMessage(chatId, message.message_id).catch(() => {});
    const tipo = data === 'howcodeuse';
    await bot.sendMessage(chatId, `\n\n> Como usar?\n--------------------------------------------------\nPara usar um codigo digite:\n ~codigoAqui\n--------------------------------------------------\nPara ver quantos dias você tem digite:\n/acesso\n--------------------------------------------------`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Voltar ao menu', callback_data: 'voltar_menu' }]
        ]
      }
    });
  }


  if (data === 'consultas' ) {
    await bot.deleteMessage(chatId, message.message_id).catch(() => {});
    const tipo = data === 'consultas';
    await bot.sendMessage(chatId, `───ׂ─ִ─ꆬ👁️‍🗨️ꆬ─ִ──ׂ──
*『𝐏𝐀𝐈𝐍𝐄𝐋 𝐑𝐀𝐏𝐈𝐃❍̸』*
───ׂ─ִ─ꆬ👁️‍🗨️ꆬ─ִ──ׂ──
├◨ׄ✿ּ  Seja bem vindo ao melhor bot
├◨ׄ✿ּ  de consultas da atualidade!
├◨ׄ✿ּ  By - Xulinn
───ׂ─ִ─ꆬ👁️‍🗨️ꆬ─ִ──ׂ──
*『𝐏𝐀𝐈𝐍𝐄𝐋 𝐑𝐀𝐏𝐈𝐃❍̸』*
───ׂ─ִ─ꆬ👁️‍🗨️ꆬ─ִ──ׂ──`, {
      parse_mode: 'Markdown',
      reply_markup: {
      inline_keyboard: [
        [
          { text: 'CPF', callback_data: 'howcpf' }
        ],
        [{ text: 'FOTOS', callback_data: 'howfoto' }],
        [
          { text: 'NOME', callback_data: 'hownome' }
        ],
        [
          { text: 'CNH', callback_data: 'howcnh' }
        ],
        [{ text: 'LOGINS', callback_data: 'howlog' }],
        [{ text: '🔙 Voltar ao menu', callback_data: 'voltar_menu' }]
      ]
    }
  });
}

if (data === 'acesso') {
  await bot.deleteMessage(chatId, message.message_id).catch(() => {});

  await bot.sendMessage(chatId, 
    `⭐ *ACESSO* ⭐

--------------------------------------------------
ADICIONE 3 PESSOAS AO GRUPO OFC DO NEKRO PARA GANHAR ACESSO GRÁTIS AO BOT!
PRINTE E ENVIE PARA O SUPORTE COMO PROVA PARA RECEBER SUA KEY!

Verifique seu acesso com /acesso
`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        // Botão para abrir o seu perfil do Telegram
        [
          {
            text: '💧 Prove aqui',
            url: 'https://t.me/hgjulinhg' // Substitua aqui
          }
        ],
        [
          {
            text: '🔙 Voltar ao menu',
            callback_data: 'voltar_menu'
          }
        ]
      ]
    }
  });
}

if (data === 'howlogs') {
  await bot.deleteMessage(chatId, message.message_id).catch(() => {});

  await bot.sendMessage(chatId, 
    `🤍 LOGINS 🤍
--------------------------------------------------
LOGIN
/logs netflix.com
--------------------------------------------------
`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🔙 Voltar ao menu',
            callback_data: 'voltar_menu'
          }
        ]
      ]
    }
  });
}

if (data === 'howcpf') {
  await bot.deleteMessage(chatId, message.message_id).catch(() => {});

  await bot.sendMessage(chatId, 
    `🤍 CONSULTA DE CPF 🤍
--------------------------------------------------
CPF
/cpf1 12345678910
--------------------------------------------------
`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🔙 Voltar ao menu',
            callback_data: 'voltar_menu'
          }
        ]
      ]
    }
  });
}

if (data === 'hownome') {
  await bot.deleteMessage(chatId, message.message_id).catch(() => {});

  await bot.sendMessage(chatId, 
    `🤍 CONSULTA DE NOME 🤍
--------------------------------------------------

EM BREVE...

--------------------------------------------------
`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🔙 Voltar ao menu',
            callback_data: 'voltar_menu'
          }
        ]
      ]
    }
  });
}


if (data === 'howcnh') {
  await bot.deleteMessage(chatId, message.message_id).catch(() => {});

  await bot.sendMessage(chatId, 
    `🤍 CONSULTA DE CNH 🤍
--------------------------------------------------
CNH
/cnh1 12345678910
(por cpf!)
--------------------------------------------------
`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🔙 Voltar ao menu',
            callback_data: 'voltar_menu'
          }
        ]
      ]
    }
  });
}

if (data === 'howfoto') {
  await bot.deleteMessage(chatId, message.message_id).catch(() => {});

  await bot.sendMessage(chatId, 
    `🤍 CONSULTA DE FOTOS 🤍
--------------------------------------------------
FOTO SP
/fotosp 12345678900
--------------------------------------------------
FOTO ??
Em breve...
--------------------------------------------------`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🔙 Voltar ao menu',
            callback_data: 'voltar_menu'
          }
        ]
      ]
    }
  });
}


  if (data === 'voltar_menu') {
    await bot.deleteMessage(chatId, message.message_id).catch(() => {});
    enviarMenuInicial(chatId);
  }

  bot.answerCallbackQuery(query.id);
});

const logsCache = new Map();
const PAGE_SIZE = 10000;

// Cria teclado de botões
function buildKeyboard(format, page, totalPages, domain) {
  const buttons = [];

  buttons.push([
    { text: "📥 Baixar Decorado", callback_data: `logs:download:decor:${domain}` },
    { text: "📥 Baixar Raw", callback_data: `logs:download:raw:${domain}` },
    { text: "⤴️ Voltar", callback_data: "voltar_menu" }
  ]);

  const nav = [];
  if (page > 0) nav.push({ text: "⬅️ Prev", callback_data: `logs:nav:prev:${page}` });
  if (page + 1 < totalPages) nav.push({ text: "➡️ Next", callback_data: `logs:nav:next:${page}` });
  if (nav.length) buttons.push(nav);

  return { inline_keyboard: buttons };
}

// Comando /logs
bot.onText(/^\/logs(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const domain = match && match[1] ? match[1].trim() : null;

  if (!domain) return bot.sendMessage(chatId, "Use: /logs <dominio>\nEx.: /logs netflix.com");

  await bot.sendMessage(chatId, `🔎 Buscando logs para: *${domain}* ...`, { parse_mode: "Markdown" });

  try {
    const API_BASE = "http://priv2.primaryhost.shop:2303/logs.php";
    const resp = await axios.get(`${API_BASE}?url=${encodeURIComponent(domain)}`, { timeout: 200000 });
    const data = resp.data;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return bot.sendMessage(chatId, `✅ Nenhum resultado encontrado para *${domain}*.`, { parse_mode: "Markdown" });
    }

    // Cria pastas e arquivos
    const folderPath = path.join(__dirname, "logs_txt");
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);

    const decorPath = path.join(folderPath, `${domain}_decor.txt`);
    const decorContent = data.map((e, i) => `*${i + 1}.*\nUSER: ${e.user || ""}\nPASS: ${e.pass || ""}\n-----------------------------\n`).join("");
    fs.writeFileSync(decorPath, decorContent, "utf8");

    const rawPath = path.join(folderPath, `${domain}_raw.txt`);
    const rawContent = data.map(e => `${e.user || ""}:${e.pass || ""}`).join("\n");
    fs.writeFileSync(rawPath, rawContent, "utf8");

    logsCache.set(chatId.toString(), { domain, data, decorPath, rawPath });

    const total = data.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = 0;

    const header = `✅ *ENCONTRADOS ${total} LOGINS* para: *${domain}*\n\nEscolha o modo de exibição abaixo.`;

    await bot.sendMessage(chatId, header, {
      parse_mode: "Markdown",
      reply_markup: buildKeyboard("decor", page, totalPages, domain)
    });

  } catch (err) {
    console.error("Erro /logs:", err);
    await bot.sendMessage(chatId, "❌ Erro ao consultar logs.");
  }
});

// Callback handler
bot.on("callback_query", async (callbackQuery) => {
  const { data, message } = callbackQuery;
  const chatId = message.chat.id;
  const messageId = message.message_id;

  if (data === "voltar_menu") {
    await bot.deleteMessage(chatId, messageId).catch(() => {});
    enviarMenuInicial(chatId);
    return bot.answerCallbackQuery(callbackQuery.id);
  }

  const cached = logsCache.get(chatId.toString());
  if (!cached) return bot.answerCallbackQuery(callbackQuery.id, { text: "Dados expirados. Rode /logs novamente.", show_alert: true });

  // Download TXT
  if (data.startsWith("logs:download:")) {
    const type = data.split(":")[2];
    const file = type === "raw" ? cached.rawPath : cached.decorPath;
    await bot.sendDocument(chatId, file, { caption: `📥 Arquivo ${type === "raw" ? "Raw" : "Decorado"} de ${cached.domain}` });
    return bot.answerCallbackQuery(callbackQuery.id);
  }

  // Navegação
  if (data.startsWith("logs:nav:")) {
    const nav = data.split(":")[2];
    const curPage = parseInt(data.split(":")[3], 10) || 0;
    const totalPages = Math.max(1, Math.ceil(cached.data.length / PAGE_SIZE));
    const page = nav === "prev" ? Math.max(0, curPage - 1) : Math.min(totalPages - 1, curPage + 1);

    const slice = cached.data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    let newText = `✅ *ENCONTRADOS ${cached.data.length} LOGINS* para *${cached.domain}*\n\n`;

    slice.forEach((e, i) => {
      newText += `*${page*PAGE_SIZE + i + 1}.*\nUSER: \`${e.user || ""}\`\nPASS: \`${e.pass || ""}\`\n-----------------------------\n`;
    });

    if (!slice.length) newText += "_Sem resultados nesta página_";

    await bot.editMessageText(newText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: buildKeyboard("decor", page, totalPages, cached.domain)
    });

    return bot.answerCallbackQuery(callbackQuery.id);
  }
});

bot.onText(/^\/cnh1(?:\s+(\d+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const cnh = match && match[1] ? match[1].trim() : null;

  if (!cnh) {
    return bot.sendMessage(
      chatId,
      "❌ Use corretamente:\n`/cnh1 <numero>`\n\nExemplo: `/cnh1 26935722829`",
      { parse_mode: "Markdown" }
    );
  }

  try {
    const url = `https://mdzapis.com/api/cnh?cnh=${cnh}&apikey=Nekro`;
    const { data } = await axios.get(url, { timeout: 20000 });

    if (!data || !data.nome) {
      return bot.sendMessage(chatId, "⚠️ Nenhuma informação encontrada para essa CNH.");
    }

    const resposta = `
🪪 *Consulta de CNH*
━━━━━━━━━━━━━━
👤 *Nome:* ${data.nome}
🧑‍🦳 *Mãe:* ${data.nomeMae || "N/A"}
👨 *Pai:* ${data.nomePai || "N/A"}
📅 *Nascimento:* ${data.dataNascimento || "N/A"}
🪪 *Número CNH:* ${cnh}
🆔 *Registro:* ${data.numeroRegistro || "N/A"}

📌 *Categoria:* ${data.categoriaAtual || "N/A"}
📅 *1ª Habilitação:* ${data.dataPrimeiraHabilitacao || "N/A"}
📅 *Validade:* ${data.dataValidadeCnh || "N/A"}

📍 *Endereço:* ${data.enderecoLogradouro || ""}, ${data.enderecoNumero || ""}, 
${data.enderecoBairro || ""} - ${data.enderecoMunicipio || ""}/${data.enderecoUf || ""}
CEP: ${data.enderecoCep || "N/A"}
━━━━━━━━━━━━━━
⚠️ *Situação:* ${data.descricaoSituacaoCnh || "N/A"}
    `.trim();

    await bot.sendMessage(chatId, resposta, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Erro /cnh:", err.message);
    await bot.sendMessage(chatId, "❌ Erro ao consultar a API.");
  }
});

bot.onText(/^\/cpf1(?:\s+(\d+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const cpf = match && match[1] ? match[1].trim() : null;

  if (!cpf) {
    return bot.sendMessage(
      chatId,
      "❌ Use corretamente:\n`/cpf1 <numero>`\n\nExemplo: `/cpf1 29022093808`",
      { parse_mode: "Markdown" }
    );
  }

  try {
    const url = `https://mdzapis.com/api/cpfnacionalneww?cpf=${cpf}&apikey=Nekro`;
    const { data } = await axios.get(url, { timeout: 20000 });

    if (!data || !data.sucesso || !data.resultado || !data.resultado.length) {
      return bot.sendMessage(chatId, "⚠️ Nenhuma informação encontrada para esse CPF.");
    }

    const info = data.resultado[0];

    // Telefones formatados
    let telefones = "Não encontrados";
    if (info.telefones && info.telefones.length > 0) {
      telefones = info.telefones
        .map(
          (t, i) =>
            `📞 ${t.telefone}\n[Whatsapp](${t.whatsapp_link}) (${t.whatsapp_status})`
        )
        .join("\n\n");
    }

    // Endereço
    const endereco = info.endereco
      ? `${info.endereco.logradouro || ""}, ${info.endereco.numero || ""}, ${info.endereco.bairro || ""}\n${info.endereco.cidade || ""} - ${info.endereco.uf || ""}`
      : "Não encontrado";

    const resposta = `
🧾 *Consulta CPF*
━━━━━━━━━━━━━━
👤 *Nome:* ${info.nome}
📝 *Apelido:* ${info.apelido_social || "N/A"}
👩‍🦳 *Mãe:* ${info.nome_mae || "N/A"}
⚧ *Sexo:* ${info.sexo || "N/A"}
📅 *Nascimento:* ${info.nascimento || "N/A"}
💍 *Estado Civil:* ${info.estado_civil || "N/A"}
🎓 *Escolaridade:* ${info.escolaridade || "N/A"}

💼 *Profissão:* ${info.profissao?.descricao || "N/A"}
💰 *Renda:* ${info.renda || "N/A"}
📊 *Score:* ${info.score || "N/A"} (Risco: ${info.faixa_risco || "N/A"})

🏠 *Endereço:*
${endereco}

📱 *Telefones:*
${telefones}

⚠️ *Óbito:* ${info.obito?.status || "N/A"}
ℹ️ *Situação empresarial:* ${info.empresario?.status || "N/A"}
    `.trim();

    await bot.sendMessage(chatId, resposta, { parse_mode: "Markdown", disable_web_page_preview: true });
  } catch (err) {
    console.error("Erro /cpf:", err.message);
    await bot.sendMessage(chatId, "❌ Erro ao consultar a API.");
  }
});

bot.onText(/^\/fotosp (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const cpf = match && match[1] ? match[1].trim() : null;

  if (!cpf) {
    return bot.sendMessage(
      chatId,
      "❌ Use corretamente:\n`/cpf <numero>`\n\nExemplo: `/cpf 29022093808`",
      { parse_mode: "Markdown" }
    );
  }

  try {
    // Consulta dados principais
    const { data } = await axios.get(`https://mdzapis.com/api/cpfnacionalneww?cpf=${cpf}&apikey=Nekro`);
    if (!data.sucesso || !data.resultado || data.resultado.length === 0) {
      return bot.sendMessage(chatId, "❌ Nenhum resultado encontrado para esse CPF.");
    }

    const pessoa = data.resultado[0];

    // Consulta foto
    try {
      const fotoResp = await axios.get(`https://mdzapis.com/api/fotossp?con=${cpf}&apikey=Nekro`);
      if (fotoResp.data && fotoResp.data.resultado && fotoResp.data.resultado[0].Retrato) {
        const buffer = Buffer.from(fotoResp.data.resultado[0].Retrato, "base64");
        await bot.sendPhoto(chatId, buffer, { caption: `👤 ${pessoa.nome}\nCPF: ${pessoa.cpf}` });
      } else {
        await bot.sendMessage(chatId, "📷 Nenhuma foto encontrada para esse CPF.");
      }
    } catch (err) {
      await bot.sendMessage(chatId, "📷 Nenhuma foto encontrada para esse CPF.");
    }

    // Depois manda os outros dados (exemplo simples)
    let texto = `👤 *${pessoa.nome}*\n`;
    texto += `CPF: ${pessoa.cpf}\n`;
    texto += `Mãe: ${pessoa.nome_mae}\n`;
    texto += `Nascimento: ${pessoa.nascimento}\n`;
    texto += `Renda: ${pessoa.renda}\n`;
    texto += `Score: ${pessoa.score} (${pessoa.faixa_risco})\n`;

    await bot.sendMessage(chatId, texto, { parse_mode: "Markdown" });

  } catch (err) {
    console.error(err.message);
    bot.sendMessage(chatId, "❌ Erro ao consultar CPF. Tente novamente.");
  }
});
