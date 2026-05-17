-- Migração: sistema de pedidos de Help entre analista e coordenador

CREATE TABLE IF NOT EXISTS pedidos_help (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  analista_email TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto', 'visualizado', 'resolvido')),
  visualizado_em TIMESTAMP,
  visualizado_por TEXT,
  resolvido_em TIMESTAMP,
  resolvido_por_email TEXT,
  resolvido_por_tipo TEXT CHECK (resolvido_por_tipo IN ('analista', 'coordenador')),
  solucao TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_status ON pedidos_help(status);
CREATE INDEX IF NOT EXISTS idx_help_analista ON pedidos_help(analista_email);
CREATE INDEX IF NOT EXISTS idx_help_empresa ON pedidos_help(empresa_id);

SELECT 'Tabela pedidos_help criada.' AS resultado;
