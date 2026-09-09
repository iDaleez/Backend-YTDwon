# Correção para YouTube atual

Esta versão altera:

- Node 20 -> Node 22
- `yt-dlp` -> `yt-dlp[default]`, que inclui `yt-dlp-ejs`
- adiciona `--js-runtimes node` nas chamadas do yt-dlp

## No Render

Se o serviço estiver ligado a um repositório GitHub:

1. Substitua `Dockerfile`, `server.js` e `package.json` pelos arquivos desta pasta.
2. Faça commit/push.
3. No Render, aguarde o Auto Deploy ou use **Manual Deploy > Deploy latest commit**.
4. Se necessário, escolha **Clear build cache & deploy** para garantir que a imagem seja reconstruída.

Procure no Build Log por versões semelhantes a:

- `2026.xx.xx` para yt-dlp
- `v22.x.x` para Node

Depois teste `/health` e tente novamente um vídeo autorizado.
