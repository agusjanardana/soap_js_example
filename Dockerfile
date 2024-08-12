# Stage 1
FROM node:lts-alpine as as-node-builder

WORKDIR /src

RUN apk add build-base \
    linux-headers \
    bash \
    libuv-dev \
    openssl-dev \
    lua5.1-dev \
    zlib-dev \
    git \
    python3

RUN git clone --recursive https://github.com/aerospike/aerospike-client-nodejs aerospike
RUN cd /src/aerospike \
    && /src/aerospike/scripts/build-c-client.sh \
    && npm install /src/aerospike --unsafe-perm --build-from-source

# Stage 2: Deploy Aerospike Node.js Runtime only
FROM node:lts-alpine
WORKDIR /src

RUN apk add --no-cache \
      zlib \
      openssl

COPY --from=as-node-builder /src/aerospike ./aerospike

RUN npm install /src/aerospike
RUN ls -la /src
RUN ls -la
RUN npm install dotenv express nodemon cookie-parser crypto debug morgan soap bcryptjs

COPY .env /src/.env 
COPY ./services /src/services
COPY app.js /src/app.js 
COPY package.json /src/package.json 
COPY package-lock.json /src/package-lock.json

EXPOSE 8800

CMD ["npm", "start"]