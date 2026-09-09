FROM node:26-bookworm-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TOKEN_TTL=6

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 \
       python3-pip \
       ffmpeg \
       ca-certificates \
       git \
    && python3 -m pip install --break-system-packages --no-cache-dir -U --pre \
       "yt-dlp[default,curl-cffi]" \
       "bgutil-ytdlp-pot-provider==2.0.0" \
    && git clone --depth 1 --branch 2.0.0 \
       https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git \
       /opt/bgutil \
    && cd /opt/bgutil/server \
    && npm ci --include=dev --no-audit --no-fund \
    && ./node_modules/.bin/tsc \
    && npm prune --omit=dev --no-audit --no-fund \
    && yt-dlp --version \
    && node --version \
    && ffmpeg -version | head -n 1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./

ENV NODE_ENV=production \
    PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
