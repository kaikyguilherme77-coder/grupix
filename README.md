# Grupix 🔗
> Diretório de grupos de WhatsApp e Telegram com sistema de destaque pago via PIX (Stripe)

---

## 📁 Estrutura do projeto

```
grupix/
├── index.html                          ← Site principal (frontend)
├── admin.html                          ← Painel administrativo
├── .gitignore
├── supabase/
│   ├── schema.sql                      ← Banco de dados completo
│   └── functions/
│       ├── create-pix-payment/
│       │   └── index.ts               ← Cria pagamento PIX via Stripe
│       └── check-pix-payment/
│           └── index.ts               ← Verifica pagamento e ativa destaque
└── README.md
```

---

## ⚡ Setup rápido

### 1. Supabase — criar banco de dados
1. Acesse https://supabase.com/dashboard
2. Selecione o projeto **grupix**
3. Vá em **SQL Editor** → Cole o conteúdo de `supabase/schema.sql` → Execute

### 2. Criar seu usuário admin
1. Acesse o site (index.html), crie uma conta normal
2. No SQL Editor do Supabase, execute:
```sql
UPDATE public.users SET is_admin = true WHERE email = 'seu@email.com';
```

### 3. Stripe — ativar PIX
1. Acesse https://dashboard.stripe.com/settings/payment_methods
2. Ative **Pix** (requer conta live brasileira)
3. Copie sua **Secret Key** em https://dashboard.stripe.com/apikeys

### 4. Deploy das Edge Functions
```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Linkar com o projeto
supabase link --project-ref qgrxbjvvzrzzpcubycol

# Configurar secrets
supabase secrets set STRIPE_SECRET_KEY=sk_live_SUA_KEY_AQUI
supabase secrets set SUPABASE_URL=https://qgrxbjvvzrzzpcubycol.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=SEU_SERVICE_ROLE_KEY

# Fazer deploy
supabase functions deploy create-pix-payment
supabase functions deploy check-pix-payment
```

> A `SUPABASE_SERVICE_ROLE_KEY` está em: Supabase Dashboard → Settings → API → **service_role**

### 5. Subir no GitHub
```bash
git init
git add .
git commit -m "feat: grupix inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/grupix.git
git push -u origin main
```

### 6. Deploy no Vercel
1. Acesse https://vercel.com → **Add New Project**
2. Importe o repositório `grupix` do GitHub
3. Clique **Deploy** — pronto!

---

## 💳 Planos criados no Stripe

| Plano | Price ID | Valor | Dias |
|-------|----------|-------|------|
| Básico | `price_1TBftAFYhBVSD4ZZqoia4e07` | R$14,90 | 7 |
| PRO   | `price_1TBftDFYhBVSD4ZZlj0yoE1S` | R$24,90 | 15 |
| VIP   | `price_1TBftHFYhBVSD4ZZC1uQVT5G` | R$39,90 | 30 |

---

## 🔄 Como o pagamento PIX funciona

```
Usuário clica "Pagar via PIX"
  → Edge Function create-pix-payment cria PaymentIntent no Stripe
  → Stripe gera QR Code PIX
  → Modal exibe QR Code para o usuário
  → A cada 10s, frontend checa check-pix-payment
  → Stripe confirma → grupo ativado automaticamente
```

---

## 🔐 Segurança

- Nunca commite a `STRIPE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` no GitHub
- Essas chaves ficam **apenas** nos Secrets do Supabase (para as Edge Functions)
- A anon key do Supabase (no código frontend) é pública por design — é segura
- O painel `/admin` só funciona para usuários com `is_admin = true` no banco

---

## 🛠 Tecnologias

- **Frontend**: HTML + CSS + JS puro (sem framework)
- **Banco**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Pagamento**: Stripe + PIX
- **Serverless**: Supabase Edge Functions (Deno)
- **Deploy**: Vercel
