FROM node:20

WORKDIR /usr/local/mrrpbot

COPY . .
RUN npm install
RUN mkdir messagecache

CMD ["node", "main.js"]