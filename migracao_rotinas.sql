-- Migração: rotinas mensais fixas por empresa

CREATE TABLE IF NOT EXISTS progresso_rotinas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,
  tipo_rotina TEXT NOT NULL,
  feito_em TIMESTAMP,
  feito_por TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(empresa_id, competencia, tipo_rotina)
);

CREATE INDEX IF NOT EXISTS idx_rotinas_empresa_competencia
  ON progresso_rotinas(empresa_id, competencia);

SELECT 'Tabela progresso_rotinas criada.' AS resultado;
