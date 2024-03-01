FROM node:alpine3.19

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8800

CMD ["npm", "start"]
