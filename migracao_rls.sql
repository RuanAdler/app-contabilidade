-- Migração: habilitar Row Level Security em todas as tabelas
-- Política: anônimos não acessam nada; usuários autenticados podem fazer tudo

-- 1. Ativar RLS
ALTER TABLE analistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE bancos_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes_extrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE etapas_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE progresso_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE observacoes_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_help ENABLE ROW LEVEL SECURITY;
ALTER TABLE progresso_rotinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes_trabalho ENABLE ROW LEVEL SECURITY;

-- 2. Limpar políticas antigas (idempotente)
DROP POLICY IF EXISTS "Autenticados podem tudo" ON analistas;
DROP POLICY IF EXISTS "Autenticados podem tudo" ON empresas;
DROP POLICY IF EXISTS "Autenticados podem tudo" ON bancos_empresa;
DROP POLICY IF EXISTS "Autenticados podem tudo" ON solicitacoes_extrato;
DROP POLICY IF EXISTS "Autenticados podem tudo" ON etapas_checklist;
DROP POLICY IF EXISTS "Autenticados podem tudo" ON progresso_checklist;
DROP POLICY IF EXISTS "Autenticados podem tudo" ON observacoes_empresa;
DROP POLICY IF EXISTS "Autenticados podem tudo" ON tarefas_empresa;
DROP POLICY IF EXISTS "Autenticados podem tudo" ON pedidos_help;
DROP POLICY IF EXISTS "Autenticados podem tudo" ON progresso_rotinas;
DROP POLICY IF EXISTS "Autenticados podem tudo" ON sessoes_trabalho;

-- 3. Criar políticas: apenas usuários autenticados podem fazer tudo
CREATE POLICY "Autenticados podem tudo" ON analistas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem tudo" ON empresas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem tudo" ON bancos_empresa
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem tudo" ON solicitacoes_extrato
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem tudo" ON etapas_checklist
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem tudo" ON progresso_checklist
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem tudo" ON observacoes_empresa
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem tudo" ON tarefas_empresa
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem tudo" ON pedidos_help
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem tudo" ON progresso_rotinas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem tudo" ON sessoes_trabalho
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

SELECT 'RLS habilitado em todas as tabelas. Anônimos bloqueados, autenticados liberados.' AS resultado;
