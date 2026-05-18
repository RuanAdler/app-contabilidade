export interface Analista {
  id: string;
  nome: string;
  email: string;
  cargo: 'analista' | 'coordenador';
  avatar_url: string | null;
  created_at: string;
}

export type StatusEmpresa = 'ativa' | 'baixada' | 'suspensa';

export interface Empresa {
  id: string;
  nome: string;
  analista_id: string;
  email_contato: string;
  created_at: string;
  nao_envia_extratos: boolean;
  marcado_em: string | null;
  status: StatusEmpresa;
  observacao_geral: string | null;
}

export interface BancoEmpresa {
  id: string;
  empresa_id: string;
  nome_banco: string;
  created_at: string;
}

export interface SolicitacaoExtrato {
  id: string;
  banco_id: string;
  competencia: string;
  status: 'pendente' | 'solicitado' | 'recebido' | 'importado';
  qtd_solicitacoes: number;
  ultima_solicitacao_em: string | null;
  created_at: string;
  updated_at: string;
}

export type GrupoChecklist = 'ativo' | 'passivo' | 'patrimonio_liquido';
export type SubgrupoChecklist = 'circulante' | 'nao_circulante' | null;

export interface EtapaChecklist {
  id: string;
  ordem: number;
  nome: string;
  grupo: GrupoChecklist;
  subgrupo: SubgrupoChecklist;
  created_at: string;
}

export interface ProgressoChecklist {
  id: string;
  empresa_id: string;
  etapa_id: string;
  competencia: string;
  feito_em: string | null;
  feito_por: string | null;
  observacao: string | null;
  created_at: string;
}

export interface ObservacaoEmpresa {
  id: string;
  empresa_id: string;
  competencia: string;
  texto: string;
  updated_at: string;
  updated_by: string | null;
}

export type StatusHelp = 'aberto' | 'visualizado' | 'resolvido';
export type TipoResolvedor = 'analista' | 'coordenador';

export interface PedidoHelp {
  id: string;
  empresa_id: string;
  analista_email: string;
  mensagem: string;
  status: StatusHelp;
  visualizado_em: string | null;
  visualizado_por: string | null;
  resolvido_em: string | null;
  resolvido_por_email: string | null;
  resolvido_por_tipo: TipoResolvedor | null;
  solucao: string | null;
  created_at: string;
}

export interface SessaoTrabalho {
  id: string;
  empresa_id: string;
  competencia: string;
  analista_email: string;
  inicio_em: string;
  fim_em: string | null;
  duracao_segundos: number | null;
  motivo_pausa: string | null;
  created_at: string;
}

export interface TarefaEmpresa {
  id: string;
  empresa_id: string;
  competencia: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  feita: boolean;
  feita_em: string | null;
  feita_por: string | null;
  created_at: string;
  created_by: string | null;
}
