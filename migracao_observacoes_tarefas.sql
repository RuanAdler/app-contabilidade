-- Migração: observações e tarefas por empresa+competência

-- 1. Observações (uma por empresa+mês)
CREATE TABLE IF NOT EXISTS observacoes_empresa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,
  texto TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE(empresa_id, competencia)
);

CREATE INDEX IF NOT EXISTS idx_obs_empresa_competencia
  ON observacoes_empresa(empresa_id, competencia);

-- 2. Tarefas com prazo (uma lista por empresa+mês)
CREATE TABLE IF NOT EXISTS tarefas_empresa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  prazo DATE,
  feita BOOLEAN NOT NULL DEFAULT false,
  feita_em TIMESTAMP,
  feita_por TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_tarefas_empresa_competencia
  ON tarefas_empresa(empresa_id, competencia);

SELECT 'Tabelas observacoes_empresa e tarefas_empresa criadas.' AS resultado;
