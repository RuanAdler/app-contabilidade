-- Migração: adicionar campo de foto de perfil em analistas

ALTER TABLE analistas
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

SELECT 'Migração de perfil concluída.' AS resultado;
