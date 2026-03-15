-- ============================================
-- GRUPIX — Schema Supabase
-- Cole isso no SQL Editor do Supabase
-- ============================================

-- 1. TABELA: users (perfis públicos, separada do auth.users)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  username text unique,
  avatar_url text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- Trigger: ao criar conta, cria perfil automaticamente
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, username)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. TABELA: groups (grupos aprovados e publicados)
create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  category text not null,
  platform text not null check (platform in ('whatsapp', 'telegram')),
  invite_link text not null,
  image_url text,
  members integer default 0,
  views integer default 0,
  is_featured boolean default false,
  is_vip boolean default false,
  submitted_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Index para busca por categoria e nome
create index groups_category_idx on public.groups(category);
create index groups_name_idx on public.groups using gin(to_tsvector('portuguese', name || ' ' || coalesce(description, '')));


-- 3. TABELA: group_submissions (grupos enviados — aguardando aprovação)
create table public.group_submissions (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  category text not null,
  platform text not null check (platform in ('whatsapp', 'telegram')),
  invite_link text not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);


-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- USERS
alter table public.users enable row level security;

create policy "Perfil público visível para todos"
  on public.users for select using (true);

create policy "Usuário edita só o próprio perfil"
  on public.users for update using (auth.uid() = id);


-- GROUPS
alter table public.groups enable row level security;

create policy "Grupos públicos visíveis para todos"
  on public.groups for select using (true);

create policy "Só admin insere grupos"
  on public.groups for insert
  with check (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

create policy "Só admin edita grupos"
  on public.groups for update
  using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

create policy "Só admin deleta grupos"
  on public.groups for delete
  using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );


-- GROUP SUBMISSIONS
alter table public.group_submissions enable row level security;

create policy "Usuário envia grupo (autenticado)"
  on public.group_submissions for insert
  with check (auth.uid() is not null);

create policy "Usuário vê suas próprias submissões"
  on public.group_submissions for select
  using (auth.uid() = user_id);

create policy "Admin vê todas as submissões"
  on public.group_submissions for select
  using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

create policy "Admin aprova ou rejeita submissões"
  on public.group_submissions for update
  using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );


-- ============================================
-- DADOS INICIAIS (seed)
-- ============================================
insert into public.groups (name, description, category, platform, invite_link, members, is_featured) values
('Cripto Brasil Oficial', 'O maior grupo de criptomoedas do Brasil. Análises, notícias e sinais diários.', 'cripto', 'whatsapp', 'https://chat.whatsapp.com/exemplo1', 1248, true),
('Dev Full Stack BR', 'Programadores brasileiros. Vagas, dúvidas, projetos e networking.', 'tecnologia', 'telegram', 'https://t.me/exemplo2', 3421, true),
('Investidores B3', 'Day traders e investidores de longo prazo. Análise técnica e fundamentalista.', 'investimentos', 'whatsapp', 'https://chat.whatsapp.com/exemplo3', 892, false),
('Free Fire BR VIP', 'Equipes, torneios e dicas para subir no ranking.', 'jogos', 'whatsapp', 'https://chat.whatsapp.com/exemplo4', 2109, true),
('Negócios Digitais', 'Empreendedores digitais. Marketing, vendas, tráfego pago.', 'negocios', 'telegram', 'https://t.me/exemplo5', 657, false),
('Inglês Fluente', 'Aprenda inglês de verdade. Dicas diárias e conversação.', 'educacao', 'whatsapp', 'https://chat.whatsapp.com/exemplo6', 1876, true),
('DeFi & Web3 BR', 'NFTs, DeFi, Layer 2 e o futuro das finanças descentralizadas.', 'cripto', 'telegram', 'https://t.me/exemplo7', 734, false),
('Lofi & Chill Brasil', 'Compartilhe playlists e artistas novos.', 'musica', 'telegram', 'https://t.me/exemplo8', 441, false);
