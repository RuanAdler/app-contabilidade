-- Migração: controle de solicitações + flag de empresa que não envia extratos

-- 1. Adicionar contador de solicitações e data da última na tabela de extratos
ALTER TABLE solicitacoes_extrato
  ADD COLUMN IF NOT EXISTS qtd_solicitacoes INT NOT NULL DEFAULT 0;

ALTER TABLE solicitacoes_extrato
  ADD COLUMN IF NOT EXISTS ultima_solicitacao_em TIMESTAMP;

-- 2. Adicionar flag e data de marcação em empresas
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS nao_envia_extratos BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS marcado_em TIMESTAMP;

-- 3. Confirmação visual
SELECT 'Migração concluída.' AS resultado;
