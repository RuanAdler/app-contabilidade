-- Migração: registrar tempo gasto pelo analista em cada empresa

CREATE TABLE IF NOT EXISTS sessoes_trabalho (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,
  analista_email TEXT NOT NULL,
  inicio_em TIMESTAMP NOT NULL DEFAULT NOW(),
  fim_em TIMESTAMP,
  duracao_segundos INT,
  motivo_pausa TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessoes_analista_aberta
  ON sessoes_trabalho(analista_email) WHERE fim_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessoes_empresa_competencia
  ON sessoes_trabalho(empresa_id, competencia);

CREATE INDEX IF NOT EXISTS idx_sessoes_analista_competencia
  ON sessoes_trabalho(analista_email, competencia);

SELECT 'Tabela sessoes_trabalho criada.' AS resultado;
