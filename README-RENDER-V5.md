# Render V5 — cookies opcionais + impersonação

Esta versão mantém a V4 e acrescenta:

- `--impersonate chrome` usando curl_cffi;
- `--force-ipv4`;
- suporte opcional a cookies por variável secreta `YOUTUBE_COOKIES_B64`;
- logs de erro mais completos;
- `/diagnostics` mostra se cookies estão configurados.

## Deploy

1. Substitua `server.js`, `Dockerfile` e `package.json` no GitHub.
2. Render > Manual Deploy > Clear build cache & deploy.
3. Teste `/diagnostics`.

Sem cookies, `cookiesConfigured` deve aparecer como `false`.

## Adicionar cookies sem colocar segredo no GitHub

Exporte cookies do YouTube no formato Netscape `cookies.txt`.
Evite usar sua conta principal; o próprio yt-dlp alerta sobre risco de bloqueio de contas quando cookies são usados para automação.

No seu computador, converta o arquivo para Base64.

### macOS / Linux

```bash
base64 -i cookies.txt | tr -d '\n'
```

### PowerShell

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("cookies.txt"))
```

No Render:

- Environment
- Add Environment Variable
- Key: `YOUTUBE_COOKIES_B64`
- Value: cole o Base64
- Save Changes / Deploy

Depois abra `/diagnostics`.

Deve aparecer:

```json
"cookiesConfigured": true
```

Não publique o valor Base64, não coloque no GitHub e não envie em prints.
