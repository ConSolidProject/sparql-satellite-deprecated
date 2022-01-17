FROM node:15
WORKDIR /satellite-sparql
COPY package.json ./satellite-sparql
RUN npm install
COPY . /satellite-sparql