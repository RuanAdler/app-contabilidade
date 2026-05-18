-- Migração: observação geral por empresa (não vinculada a competência)

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS observacao_geral TEXT;

SELECT 'Coluna observacao_geral adicionada em empresas.' AS resultado;
