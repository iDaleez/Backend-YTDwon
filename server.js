import express from "express";
import cors from "cors";
import helmet from "helmet";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const app = express();
const PORT = process.env.PORT || 8080;

const configuredOrigins = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

const allowAnyOrigin = configuredOrigins.includes("*");

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowAnyOrigin || configuredOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("Origem não autorizada pelo CORS."));
    },
    exposedHeaders: ["Content-Disposition"],
  })
);

app.use(express.json({ limit: "32kb" }));

const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

// YouTube currently requires an external JavaScript runtime for full yt-dlp support.
// This image uses Node 22+ and yt-dlp-ejs via the "default" pip extras.
const YTDLP_COMMON_ARGS = [
  "--js-runtimes",
  "node",
];

function validateYoutubeUrl(value) {
  if (typeof value !== "string" || value.length > 2048) {
    throw new Error("URL inválida.");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("URL inválida.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Protocolo inválido.");
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("Apenas links do YouTube são aceitos.");
  }

  return parsed.toString();
}

function sanitizeFileName(value) {
  return (value || "download")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "download";
}

function runProcess(command, args, { cwd, timeoutMs = 15 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGKILL");
      settled = true;
      reject(new Error("Tempo limite de processamento excedido."));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;

      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const cleanMessage = stderr
          .split("\n")
          .filter(Boolean)
          .slice(-8)
          .join("\n");

        reject(new Error(cleanMessage || `${command} terminou com código ${code}.`));
      }
    });
  });
}

async function getVideoInfo(url) {
  const args = [
    ...YTDLP_COMMON_ARGS,
    "--no-playlist",
    "--skip-download",
    "--dump-single-json",
    "--no-warnings",
    url,
  ];

  const { stdout } = await runProcess("yt-dlp", args, {
    timeoutMs: 2 * 60 * 1000,
  });

  const data = JSON.parse(stdout);

  return {
    id: data.id,
    title: data.title || "Vídeo",
    duration: data.duration || null,
    thumbnail: data.thumbnail || null,
    uploader: data.uploader || null,
    webpage_url: data.webpage_url || url,
  };
}

async function findGeneratedFile(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());

  if (!files.length) {
    throw new Error("O arquivo final não foi encontrado.");
  }

  const ranked = [];
  for (const entry of files) {
    const fullPath = path.join(dir, entry.name);
    const stat = await fs.stat(fullPath);
    ranked.push({ fullPath, name: entry.name, size: stat.size, mtimeMs: stat.mtimeMs });
  }

  ranked.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return ranked[0];
}

function buildDownloadArgs({ url, format, quality }) {
  const outputTemplate = "%(title).160B [%(id)s].%(ext)s";
  const base = [
    ...YTDLP_COMMON_ARGS,
    "--no-playlist",
    "--no-warnings",
    "--restrict-filenames",
    "--output",
    outputTemplate,
  ];

  if (format === "mp3") {
    const bitrate =
      quality === "best" ? "0" : ["128", "192", "256", "320"].includes(quality) ? `${quality}K` : "0";

    return [
      ...base,
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      bitrate,
      url,
    ];
  }

  if (format === "mp4") {
    let selector;

    if (quality === "best") {
      selector =
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best";
    } else {
      const height = ["360", "480", "720", "1080"].includes(quality)
        ? quality
        : "1080";

      selector =
        `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/` +
        `bestvideo[height<=${height}]+bestaudio/` +
        `best[height<=${height}]`;
    }

    return [
      ...base,
      "--format",
      selector,
      "--merge-output-format",
      "mp4",
      url,
    ];
  }

  throw new Error("Formato inválido.");
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "video-downloader-backend",
    time: new Date().toISOString(),
  });
});

app.post("/api/info", async (req, res) => {
  try {
    const url = validateYoutubeUrl(req.body?.url);
    const info = await getVideoInfo(url);
    res.json(info);
  } catch (error) {
    console.error("info error:", error);
    res.status(400).json({
      error: normalizePublicError(error),
    });
  }
});

app.post("/api/download", async (req, res) => {
  let tempDir;

  try {
    const url = validateYoutubeUrl(req.body?.url);
    const format = String(req.body?.format || "").toLowerCase();
    const quality = String(req.body?.quality || "best").toLowerCase();

    if (!["mp3", "mp4"].includes(format)) {
      return res.status(400).json({ error: "Formato deve ser MP3 ou MP4." });
    }

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "video-dl-"));

    const args = buildDownloadArgs({ url, format, quality });

    await runProcess("yt-dlp", args, {
      cwd: tempDir,
      timeoutMs: 15 * 60 * 1000,
    });

    const generated = await findGeneratedFile(tempDir);
    const ext = path.extname(generated.name).replace(".", "") || format;
    const base = sanitizeFileName(path.basename(generated.name, path.extname(generated.name)));
    const downloadName = `${base}.${ext}`;

    res.setHeader("Content-Type", format === "mp3" ? "audio/mpeg" : "video/mp4");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
    );
    res.setHeader("Content-Length", String(generated.size));
    res.setHeader("Cache-Control", "no-store");

    const fileHandle = await fs.open(generated.fullPath, "r");
    const stream = fileHandle.createReadStream();

    const cleanup = async () => {
      try {
        await fileHandle.close();
      } catch {}
      try {
        if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}
    };

    stream.on("error", async (error) => {
      console.error("stream error:", error);
      await cleanup();

      if (!res.headersSent) {
        res.status(500).json({ error: "Erro ao enviar o arquivo." });
      } else {
        res.destroy(error);
      }
    });

    res.on("close", cleanup);
    stream.pipe(res);
  } catch (error) {
    console.error("download error:", error);

    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }

    if (!res.headersSent) {
      res.status(400).json({
        error: normalizePublicError(error),
      });
    }
  }
});

function normalizePublicError(error) {
  const message = String(error?.message || "Erro desconhecido.");

  if (/Sign in to confirm|bot|cookies/i.test(message)) {
    return "O YouTube recusou a requisição do servidor. O yt-dlp pode precisar ser atualizado ou de configuração adicional.";
  }

  if (/Video unavailable/i.test(message)) {
    return "Vídeo indisponível.";
  }

  if (/Private video/i.test(message)) {
    return "O vídeo é privado.";
  }

  if (/age-restricted/i.test(message)) {
    return "O vídeo possui restrição de idade e não pôde ser processado.";
  }

  if (/URL inválida|Apenas links|Formato inválido|Protocolo inválido/i.test(message)) {
    return message;
  }

  return "Não foi possível processar esse vídeo. Verifique o link e tente novamente.";
}

app.use((error, _req, res, _next) => {
  console.error("unhandled middleware error:", error);

  if (String(error?.message).includes("CORS")) {
    return res.status(403).json({ error: "Origem não autorizada." });
  }

  res.status(500).json({ error: "Erro interno do servidor." });
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
});
