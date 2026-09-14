# PRIME LEILÕES

Site institucional com catálogo, página de detalhe, cadastro e login com autenticação JWT própria usando Supabase apenas como banco Postgres.

Repositório: [marielleillha96-del/prime](https://github.com/marielleillha96-del/prime).

O domínio e o projeto Vercel serão definidos posteriormente.

## Stack

- HTML, CSS e JavaScript
- Node.js + Express
- JWT próprio
- Supabase Postgres
- Vercel para frontend + funções `api/`

## Rodando localmente

1. Instale as dependências:

```bash
npm install
```

2. Crie seu arquivo local:

```bash
cp .env.example .env
```

3. Preencha o `.env`

4. Inicie:

```bash
npm start
```

5. Acesse:

- `http://localhost:3000`

## Banco no Supabase

Execute o SQL abaixo no `SQL Editor` do Supabase:

- [supabase/001_init.sql](./supabase/001_init.sql)

Esse script cria:

- `public.app_users`
- `public.app_refresh_tokens`

Consulta rápida:

- [sql/check_profiles.sql](./sql/check_profiles.sql)

## Variáveis de ambiente

Base local:

- [`.env.example`](./.env.example)

Variáveis usadas:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_REFRESH_SECRET`
- `JWT_REFRESH_EXPIRES_IN`
- `BCRYPT_ROUNDS`
- `APP_ENV`
- `PORT`
- `APP_URL`
- `APP_DOMAIN`
- `CORS_ORIGIN`

## Publicação

Deploy no Vercel pendente. Configurar domínio, contatos e variáveis de produção antes de publicar. O arquivo `.env`, os backups e os documentos privados não são versionados.

Defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` no ambiente. Não existe senha administrativa padrão no código.

## APIs disponíveis

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
