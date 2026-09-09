FROM node:26-bookworm-slim

ENV NODE_ENV=production \
    PYTHONUNBUFFERED=1 \
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
       "bgutil-ytdlp-pot-provider==1.3.2" \
    && git clone --depth 1 --branch 1.3.2 \
       https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git \
       /opt/bgutil \
    && cd /opt/bgutil/server \
    && npm ci \
    && npx tsc \
    && yt-dlp --version \
    && node --version \
    && ffmpeg -version | head -n 1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js ./

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
