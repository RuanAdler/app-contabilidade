-- Migração: checklist no formato de balanço patrimonial

-- 1. Adicionar grupo e subgrupo
ALTER TABLE etapas_checklist
  ADD COLUMN IF NOT EXISTS grupo TEXT;

ALTER TABLE etapas_checklist
  ADD COLUMN IF NOT EXISTS subgrupo TEXT;

-- 2. Limpar tudo (progresso e etapas) — o app ainda nao foi usado para checklists
DELETE FROM progresso_checklist;
DELETE FROM etapas_checklist;

-- 3. Inserir contas do balanço patrimonial
INSERT INTO etapas_checklist (ordem, nome, grupo, subgrupo) VALUES
-- ATIVO CIRCULANTE
(1,  'CAIXA',                            'ativo', 'circulante'),
(2,  'BANCOS',                           'ativo', 'circulante'),
(3,  'APLICAÇÕES',                       'ativo', 'circulante'),
(4,  'DUPLICATAS A RECEBER',             'ativo', 'circulante'),
(5,  'ADIANTAMENTO DE FORNECEDORES',     'ativo', 'circulante'),
(6,  'ADIANTAMENTO DE SOCIOS',           'ativo', 'circulante'),
-- ATIVO NÃO CIRCULANTE
(7,  'DEPOSITOS JUDICIAIS',              'ativo', 'nao_circulante'),
(8,  'IMPOSTO A RECUPERAR',              'ativo', 'nao_circulante'),
(9,  'OUTROS ATIVOS NAO CIRCULANTES',    'ativo', 'nao_circulante'),
-- PASSIVO CIRCULANTE
(10, 'EMPRESTIMOS',                      'passivo', 'circulante'),
(11, 'FORNECEDORES',                     'passivo', 'circulante'),
(12, 'IMPOSTOS E CONTRIBUIÇOES SOCIAIS', 'passivo', 'circulante'),
(13, 'OBRIGAÇOES SOCIAIS E TRABALHISTAS','passivo', 'circulante'),
(14, 'ADIANTAMENTO DE CLIENTES',         'passivo', 'circulante'),
(15, 'OUTROS PASSIVOS CIRCULANTES',      'passivo', 'circulante'),
-- PASSIVO NÃO CIRCULANTE
(16, 'APORTE',                           'passivo', 'nao_circulante'),
(17, 'EMPRESTIMOS NAO CIRCULANTES',      'passivo', 'nao_circulante'),
(18, 'OUTROS PASSIVOS NAO CIRCULANTES',  'passivo', 'nao_circulante'),
-- PATRIMÔNIO LÍQUIDO
(19, 'CAPITAL SOCIAL',                   'patrimonio_liquido', NULL),
(20, 'LUCROS ACUMULADOS',                'patrimonio_liquido', NULL);

SELECT 'Migração de checklist concluída — ' || COUNT(*) || ' contas inseridas.' AS resultado
FROM etapas_checklist;
