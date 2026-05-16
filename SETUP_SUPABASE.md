# Setup do Supabase

## 1. Criar projeto no Supabase

1. Acesse https://supabase.com e faça login (crie conta se necessário)
2. Clique em "New project"
3. Preencha:
   - **Name:** `app-contabilidade`
   - **Database Password:** crie uma senha forte
   - **Region:** escolha a mais próxima (ex: South America - São Paulo)
4. Clique em "Create new project" e espere criar (pode levar alguns minutos)

## 2. Executar SQL para criar as tabelas

Dentro do projeto Supabase:

1. Vá em **SQL Editor** (no menu esquerdo)
2. Clique em **New Query**
3. **Cole todo o código abaixo:**

```sql
-- Criar tabela de analistas
CREATE TABLE analistas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  cargo TEXT CHECK (cargo IN ('analista', 'coordenador')) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Criar tabela de empresas
CREATE TABLE empresas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  analista_id UUID NOT NULL REFERENCES analistas(id),
  email_contato TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Criar tabela de bancos
CREATE TABLE bancos_empresa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome_banco TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Criar tabela de solicitações de extrato
CREATE TABLE solicitacoes_extrato (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  banco_id UUID NOT NULL REFERENCES bancos_empresa(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,
  status TEXT CHECK (status IN ('pendente', 'solicitado', 'recebido', 'importado')) DEFAULT 'pendente',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar tabela de etapas do checklist
CREATE TABLE etapas_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ordem INTEGER NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Inserir etapas padrão
INSERT INTO etapas_checklist (ordem, nome) VALUES
(1, 'Conferir documentação recebida'),
(2, 'Importar extratos bancários'),
(3, 'Conciliar contas a pagar'),
(4, 'Conciliar contas a receber'),
(5, 'Conferir folha de pagamento'),
(6, 'Lançar depreciação'),
(7, 'Fechar resultado (DRE)'),
(8, 'Conferir balanço patrimonial'),
(9, 'Revisar notas explicativas'),
(10, 'Gerar relatório final');

-- Criar tabela de progresso do checklist
CREATE TABLE progresso_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  etapa_id UUID NOT NULL REFERENCES etapas_checklist(id),
  competencia TEXT NOT NULL,
  feito_em TIMESTAMP,
  feito_por TEXT,
  observacao TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(empresa_id, etapa_id, competencia)
);

-- Criar índices para melhor performance
CREATE INDEX idx_empresas_analista ON empresas(analista_id);
CREATE INDEX idx_bancos_empresa ON bancos_empresa(empresa_id);
CREATE INDEX idx_solicitacoes_banco ON solicitacoes_extrato(banco_id);
CREATE INDEX idx_solicitacoes_competencia ON solicitacoes_extrato(competencia);
CREATE INDEX idx_progresso_empresa ON progresso_checklist(empresa_id);
CREATE INDEX idx_progresso_competencia ON progresso_checklist(competencia);

-- Criar user (para autenticação)
-- Vá para Authentication > Users e crie manualmente os usuários
```

4. Clique em **Run** (ou Ctrl+Enter)

## 3. Importar dados da sua planilha

Depois que as tabelas forem criadas:

1. Baixe a sua planilha em CSV (Arquivo > Download como > CSV)
2. Vá em **SQL Editor** novamente
3. Cole esse código (adapte conforme sua planilha):

```sql
-- Inserir analistas da sua planilha
-- Substitua os VALUES pelos dados reais
INSERT INTO analistas (nome, email, cargo) VALUES
('RUAN', 'ruan.racontabilidade@gmail.com', 'analista'),
('MARIA', 'maria.email@gmail.com', 'analista'),
('COORDENADOR', 'coordenador.email@gmail.com', 'coordenador');

-- Depois de inserir os analistas, insira as empresas
-- Use os IDs dos analistas do passo anterior
INSERT INTO empresas (nome, analista_id, email_contato) VALUES
('ALIANÇA BARREIRAS SERVIÇOS MEDICOS LTDA', 'ID_DO_RUAN', 'empresa@email.com'),
('ASI SERVICOS MEDICOS LTDA', 'ID_DO_RUAN', 'empresa2@email.com');
```

**Ou faça manualmente na seção Table Editor do Supabase** (mais fácil!)

## 4. Criar usuários para autenticação

1. Vá em **Authentication > Users** (menu esquerdo)
2. Clique em **Add user**
3. Preencha:
   - **Email:** (do seu analista, ex: `ruan.racontabilidade@gmail.com`)
   - **Password:** crie uma senha
4. Clique em **Create user**
5. Repita para cada analista/coordenador

## 5. Copiar as credenciais do Supabase

1. Vá em **Settings > API** (menu esquerdo)
2. Copie:
   - **Project URL**
   - **anon public** (a chave)
3. Volte ao arquivo `.env.local` do projeto e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=<cole o Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<cole a chave anon>
```

Pronto! Agora o app está conectado ao Supabase.
