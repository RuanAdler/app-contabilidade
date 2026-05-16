-- Migração: status da empresa (ativa / baixada / suspensa)

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativa';

ALTER TABLE empresas DROP CONSTRAINT IF EXISTS empresas_status_check;

ALTER TABLE empresas
  ADD CONSTRAINT empresas_status_check
  CHECK (status IN ('ativa', 'baixada', 'suspensa'));

SELECT 'Migração de status concluída.' AS resultado;
