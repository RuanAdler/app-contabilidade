-- Migração: adicionar cargo 'desenvolvedor' ao constraint da tabela analistas

ALTER TABLE analistas DROP CONSTRAINT IF EXISTS analistas_cargo_check;

ALTER TABLE analistas
  ADD CONSTRAINT analistas_cargo_check
  CHECK (cargo IN ('analista', 'coordenador', 'desenvolvedor'));

SELECT 'Cargo desenvolvedor liberado na tabela analistas.' AS resultado;
