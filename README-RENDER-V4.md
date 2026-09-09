# Render V4 — correção do build

O build V3 falhava no comando `npx tsc`.

## Causa

O Dockerfile definia `NODE_ENV=production` antes de executar `npm ci` dentro do projeto BgUtils.

Com `NODE_ENV=production`, o npm omitiu `devDependencies`. O TypeScript é necessário apenas para compilar o servidor, então o executável `tsc` não foi instalado. Por isso `npx` tentou baixar o pacote errado chamado `tsc`.

## Correções

- `NODE_ENV=production` agora só é definido depois da compilação.
- `npm ci --include=dev` instala explicitamente as dependências de desenvolvimento do BgUtils.
- usa `./node_modules/.bin/tsc`, evitando que `npx` baixe um pacote incorreto.
- atualiza `bgutil-ytdlp-pot-provider` de 1.3.2 para 2.0.0.
- clona a tag 2.0.0 correspondente.
- remove devDependencies do BgUtils após compilar com `npm prune --omit=dev`.

## Render

Substitua no GitHub pelo menos:

- Dockerfile
- server.js
- package.json

Depois:

Render > Manual Deploy > Clear build cache & deploy

Quando terminar, teste:

https://SEU-SERVICO.onrender.com/diagnostics

