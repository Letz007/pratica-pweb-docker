FROM node:18-alpine

# Instala bash e cliente do PostgreSQL
RUN apk add --no-cache bash postgresql-client

# Diretório de trabalho
WORKDIR /app

# Copia pacotes
COPY package*.json ./

# Instala dependências (inclui sequelize-cli caso esteja em dependencies)
RUN npm ci

# Copia código fonte
COPY . .

# Torna script de inicialização executável
RUN chmod +x start.sh

# Exposição da porta
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["./start.sh"]

