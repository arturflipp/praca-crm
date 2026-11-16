#!/usr/bin/env node
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const PORT = Number(process.env.PRACA_BRIDGE_PORT || 4176);
const HOST = "127.0.0.1";
const PROJECT_DIR = process.env.PRACA_PROJECT_DIR || "/Users/macbook/Documents/ai-agents-skills-master/pesquisa de leads avançada";
const TIMEOUT_SEC = Number(process.env.PRACA_BRIDGE_TIMEOUT_SEC || 900);
const MODEL = process.env.PRACA_BRIDGE_MODEL || "";
const MAX_BODY = 300 * 1024;
const TOKEN_FILE = path.join(homedir(), ".praca-crm-bridge-token");

const extraOrigins = String(process.env.PRACA_ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  "https://arturflipp.github.io",
  "http://localhost:4174",
  "http://127.0.0.1:4174",
  ...extraOrigins,
]);

function ensureToken() {
  if (process.env.PRACA_BRIDGE_TOKEN) return process.env.PRACA_BRIDGE_TOKEN;
  try {
    const stored = readFileSync(TOKEN_FILE, "utf8").trim();
    if (stored) return stored;
  } catch (_) {}
  const token = randomBytes(24).toString("hex");
  writeFileSync(TOKEN_FILE, token + "\n", { mode: 0o600 });
  return token;
}

const TOKEN = ensureToken();
let busy = false;

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Bridge-Token",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

function send(res, status, data, origin) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...corsHeaders(origin),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Pedido grande demais."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function extractTable(text) {
  const lines = String(text || "").split(/\r?\n/);
  let best = null;
  let current = [];
  const flush = () => {
    if (current.length >= 3) {
      const hasSeparator = current.some((line) => /^\|?[\s:-]+\|/.test(line) && line.includes("-"));
      if (hasSeparator && (!best || current.length > best.length)) best = current.slice();
    }
    current = [];
  };
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) current.push(trimmed);
    else flush();
  });
  flush();
  return best ? best.join("\n") : "";
}

function runOpencode(prompt) {
  return new Promise((resolve, reject) => {
    const args = ["run", "--format", "json", "--dir", PROJECT_DIR, "--auto"];
    if (MODEL) args.push("--model", MODEL);
    args.push(prompt);
    const child = spawn("opencode", args, {
      cwd: PROJECT_DIR,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const parts = new Map();
    let stderr = "";
    let buffer = "";
    let settled = false;
    let sessionId = "";
    let lastError = "";

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 4000).unref();
      reject(Object.assign(new Error("A pesquisa passou do tempo limite."), { status: 504 }));
    }, TIMEOUT_SEC * 1000);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let index = buffer.indexOf("\n");
      while (index >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        index = buffer.indexOf("\n");
        if (!line) continue;
        let event;
        try { event = JSON.parse(line); } catch (_) { continue; }
        if (event.sessionID) sessionId = event.sessionID;
        if (event.type === "error") {
          lastError = (event.error && (event.error.message || event.error.name)) || "Erro do OpenCode.";
          continue;
        }
        if (event.type === "text" && event.part && typeof event.part.text === "string") {
          parts.set(event.part.id, event.part.text);
        }
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-4000);
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(Object.assign(new Error("Não encontrei o comando opencode instalado."), { status: 500, cause: error }));
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const text = Array.from(parts.values()).join("\n").trim();
      if (code !== 0 && !text) {
        reject(Object.assign(new Error(lastError || stderr.trim() || "O OpenCode terminou com erro."), { status: 502 }));
        return;
      }
      const table = extractTable(text);
      resolve({ text: table || text, tableFound: Boolean(table), sessionId });
    });
  });
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  if (!isAllowedOrigin(origin)) {
    send(res, 403, { error: "Origem não permitida." }, origin);
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const token = req.headers["x-bridge-token"] || url.searchParams.get("token") || "";

  if (url.pathname === "/health" && req.method === "GET") {
    if (token !== TOKEN) {
      send(res, 401, { error: "Código da ponte incorreto." }, origin);
      return;
    }
    send(res, 200, {
      ok: true,
      project: PROJECT_DIR,
      model: MODEL || "padrão do OpenCode",
      busy,
      version: 1,
    }, origin);
    return;
  }

  if (url.pathname === "/search" && req.method === "POST") {
    if (token !== TOKEN) {
      send(res, 401, { error: "Código da ponte incorreto." }, origin);
      return;
    }
    if (busy) {
      send(res, 409, { error: "Já existe uma pesquisa rodando. Espere terminar." }, origin);
      return;
    }
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch (error) {
      send(res, error.status || 400, { error: error.message || "Pedido inválido." }, origin);
      return;
    }
    const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
    if (prompt.length < 20 || prompt.length > 60000) {
      send(res, 400, { error: "Prompt vazio ou grande demais." }, origin);
      return;
    }
    if (!existsSync(PROJECT_DIR)) {
      send(res, 500, { error: "A pasta do projeto de pesquisa não existe." }, origin);
      return;
    }
    busy = true;
    const startedAt = Date.now();
    console.log(`[${new Date().toISOString()}] pesquisa iniciada (${prompt.length} caracteres)`);
    try {
      const result = await runOpencode(prompt);
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      console.log(`[${new Date().toISOString()}] pesquisa concluída em ${seconds}s (tabela: ${result.tableFound ? "sim" : "não"})`);
      send(res, 200, { ...result, elapsedSec: seconds }, origin);
    } catch (error) {
      console.log(`[${new Date().toISOString()}] pesquisa falhou: ${error.message}`);
      send(res, error.status || 500, { error: error.message || "Falha na pesquisa." }, origin);
    } finally {
      busy = false;
    }
    return;
  }

  send(res, 404, { error: "Rota não encontrada." }, origin);
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("  Busca automática de leads — ponte local");
  console.log("  ----------------------------------------");
  console.log(`  Endereço:  http://${HOST}:${PORT}`);
  console.log(`  Projeto:   ${PROJECT_DIR}`);
  console.log(`  Modelo:    ${MODEL || "padrão do OpenCode"}`);
  console.log(`  Código:    ${TOKEN}`);
  console.log("");
  console.log("  Cole o endereço e o código na aba Prompt do CRM.");
  console.log("  Deixe este terminal aberto durante a pesquisa. Ctrl+C encerra.");
  console.log("");
});

process.on("SIGINT", () => {
  console.log("\nPonte encerrada.");
  process.exit(0);
});
