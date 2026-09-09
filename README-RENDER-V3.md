# Render V3

Esta versão inclui:

- Node 26
- yt-dlp nightly (`--pre`)
- `yt-dlp[default,curl-cffi]`
- EJS
- `bgutil-ytdlp-pot-provider` 1.3.2
- servidor/script BgUtils compilado dentro da imagem
- `mweb,default` como clientes do YouTube
- endpoint `/diagnostics`

## Deploy

1. Substitua no repositório:
   - `Dockerfile`
   - `server.js`
   - `package.json`
2. Commit/push.
3. Render > Manual Deploy > Clear build cache & deploy.
4. Abra:
   `https://SEU-SERVICO.onrender.com/diagnostics`

O JSON deve mostrar as versões de yt-dlp, Node e FFmpeg.

Depois teste um vídeo que você tenha autorização para baixar.

## Importante

Se ainda ocorrer `Failed to extract any player response`, o problema provavelmente está na resposta que o YouTube entrega ao IP/datacenter do Render. Nesse caso, a solução deixa de ser simplesmente atualizar o yt-dlp e pode exigir outra origem de rede/hospedagem.
