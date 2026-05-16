export interface Analista {
  id: string;
  nome: string;
  email: string;
  cargo: 'analista' | 'coordenador';
  created_at: string;
}

export interface Empresa {
  id: string;
  nome: string;
  analista_id: string;
  email_contato: string;
  created_at: string;
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
  created_at: string;
  updated_at: string;
}

export interface EtapaChecklist {
  id: string;
  ordem: number;
  nome: string;
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
