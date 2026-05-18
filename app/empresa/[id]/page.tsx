'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Empresa, BancoEmpresa, SolicitacaoExtrato, ProgressoChecklist, EtapaChecklist, GrupoChecklist, ObservacaoEmpresa, TarefaEmpresa } from '@/lib/types';

type StatusExtrato = 'pendente' | 'solicitado' | 'recebido' | 'importado';

const STATUS_LABELS: Record<StatusExtrato, string> = {
  pendente: 'Pendente',
  solicitado: 'Solicitado',
  recebido: 'Recebido',
  importado: 'Importado',
};

const STATUS_BADGE_CLASS: Record<StatusExtrato, string> = {
  pendente: 'bg-slate-100 text-slate-700 border-slate-300',
  solicitado: 'bg-amber-50 text-amber-800 border-amber-300',
  recebido: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  importado: 'bg-slate-900 text-white border-slate-900',
};

const GRUPO_LABEL: Record<GrupoChecklist, string> = {
  ativo: 'Ativo',
  passivo: 'Passivo',
  patrimonio_liquido: 'Patrimônio Líquido',
};

const SUBGRUPO_LABEL: Record<string, string> = {
  circulante: 'Circulante',
  nao_circulante: 'Não circulante',
};

export default function EmpresaDetail() {
  const [usuario, setUsuario] = useState<any>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [bancos, setBancos] = useState<BancoEmpresa[]>([]);
  const [extratosAno, setExtratosAno] = useState<SolicitacaoExtrato[]>([]);
  const [checklist, setChecklist] = useState<ProgressoChecklist[]>([]);
  const [etapas, setEtapas] = useState<EtapaChecklist[]>([]);
  const [observacao, setObservacao] = useState<ObservacaoEmpresa | null>(null);
  const [obsTexto, setObsTexto] = useState('');
  const [salvandoObs, setSalvandoObs] = useState(false);
  const [tarefas, setTarefas] = useState<TarefaEmpresa[]>([]);
  const [novaTarefa, setNovaTarefa] = useState({ titulo: '', descricao: '', prazo: '' });
  const [salvandoTarefa, setSalvandoTarefa] = useState(false);
  const hoje = new Date();
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const [mes, setMes] = useState(String(hoje.getMonth() + 1).padStart(2, '0'));
  const competencia = `${ano}-${mes}`;
  const [loading, setLoading] = useState(true);
  const [novoBanco, setNovoBanco] = useState('');
  const [adicionandoBanco, setAdicionandoBanco] = useState(false);
  const router = useRouter();
  const params = useParams();
  const empresaId = params.id as string;

  const meses = [
    { num: '01', label: 'Jan' },
    { num: '02', label: 'Fev' },
    { num: '03', label: 'Mar' },
    { num: '04', label: 'Abr' },
    { num: '05', label: 'Mai' },
    { num: '06', label: 'Jun' },
    { num: '07', label: 'Jul' },
    { num: '08', label: 'Ago' },
    { num: '09', label: 'Set' },
    { num: '10', label: 'Out' },
    { num: '11', label: 'Nov' },
    { num: '12', label: 'Dez' },
  ];

  const anos = Array.from({ length: 5 }, (_, i) => String(hoje.getFullYear() - 2 + i));

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      setUsuario(session.user);

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', empresaId)
        .single();

      setEmpresa(empresaData);

      const { data: bancosData } = await supabase
        .from('bancos_empresa')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome_banco');

      setBancos(bancosData || []);
      setLoading(false);
    };

    loadData();
  }, [router, empresaId]);

  useEffect(() => {
    const carregar = async () => {
      if (bancos.length === 0) {
        setExtratosAno([]);
        return;
      }
      const { data } = await supabase
        .from('solicitacoes_extrato')
        .select('*')
        .in('banco_id', bancos.map((b) => b.id))
        .like('competencia', `${ano}-%`);
      setExtratosAno(data || []);
    };
    carregar();
  }, [ano, bancos]);

  useEffect(() => {
    const carregar = async () => {
      const [{ data: etapasData }, { data: progressoData }, { data: obsData }, { data: tarefasData }] = await Promise.all([
        supabase.from('etapas_checklist').select('*').order('ordem'),
        supabase.from('progresso_checklist').select('*').eq('empresa_id', empresaId).eq('competencia', competencia),
        supabase.from('observacoes_empresa').select('*').eq('empresa_id', empresaId).eq('competencia', competencia).maybeSingle(),
        supabase.from('tarefas_empresa').select('*').eq('empresa_id', empresaId).eq('competencia', competencia).order('feita').order('prazo', { nullsFirst: false }),
      ]);
      setEtapas(etapasData || []);
      setChecklist(progressoData || []);
      setObservacao(obsData || null);
      setObsTexto(obsData?.texto || '');
      setTarefas(tarefasData || []);
    };
    carregar();
  }, [empresaId, competencia]);

  const statusDoBanco = (bancoId: string, comp: string = competencia): StatusExtrato => {
    const e = extratosAno.find((x) => x.banco_id === bancoId && x.competencia === comp);
    return (e?.status as StatusExtrato) || 'pendente';
  };

  const statusDoMes = (numMes: string): 'vazio' | 'pendente' | 'parcial' | 'concluido' => {
    if (bancos.length === 0) return 'vazio';
    const comp = `${ano}-${numMes}`;
    let recebidos = 0;
    for (const b of bancos) {
      const s = statusDoBanco(b.id, comp);
      if (s === 'recebido' || s === 'importado') recebidos++;
    }
    if (recebidos === 0) return 'pendente';
    if (recebidos === bancos.length) return 'concluido';
    return 'parcial';
  };

  const handleStatusChange = async (bancoId: string, novoStatus: StatusExtrato) => {
    const existente = extratosAno.find(
      (e) => e.banco_id === bancoId && e.competencia === competencia
    );
    const agora = new Date().toISOString();
    if (existente) {
      const { data } = await supabase
        .from('solicitacoes_extrato')
        .update({ status: novoStatus, updated_at: agora })
        .eq('id', existente.id)
        .select()
        .single();
      if (data) setExtratosAno((prev) => prev.map((e) => (e.id === existente.id ? data : e)));
    } else {
      const { data } = await supabase
        .from('solicitacoes_extrato')
        .insert({ banco_id: bancoId, competencia, status: novoStatus })
        .select()
        .single();
      if (data) setExtratosAno((prev) => [...prev, data]);
    }
  };

  const handleRegistrarSolicitacao = async (bancoId: string) => {
    const existente = extratosAno.find(
      (e) => e.banco_id === bancoId && e.competencia === competencia
    );
    const agora = new Date().toISOString();
    let registro: SolicitacaoExtrato | null = null;
    if (existente) {
      if (existente.status === 'recebido' || existente.status === 'importado') return;
      const novaQtd = (existente.qtd_solicitacoes || 0) + 1;
      const { data } = await supabase
        .from('solicitacoes_extrato')
        .update({
          qtd_solicitacoes: novaQtd,
          ultima_solicitacao_em: agora,
          status: 'solicitado',
          updated_at: agora,
        })
        .eq('id', existente.id)
        .select()
        .single();
      registro = data;
      if (data) {
        setExtratosAno((prev) => prev.map((e) => (e.id === existente.id ? data : e)));
      }
    } else {
      const { data } = await supabase
        .from('solicitacoes_extrato')
        .insert({
          banco_id: bancoId,
          competencia,
          status: 'solicitado',
          qtd_solicitacoes: 1,
          ultima_solicitacao_em: agora,
        })
        .select()
        .single();
      registro = data;
      if (data) setExtratosAno((prev) => [...prev, data]);
    }

    // Regra automática: 3+ solicitações + 2 dias parado sem retorno
    if (
      registro &&
      empresa &&
      !empresa.nao_envia_extratos &&
      registro.qtd_solicitacoes >= 3 &&
      (registro.status === 'pendente' || registro.status === 'solicitado')
    ) {
      const primeiraSolicitacao = new Date(registro.created_at).getTime();
      const diasDecorridos = (Date.now() - primeiraSolicitacao) / (1000 * 60 * 60 * 24);
      if (diasDecorridos >= 2) {
        await marcarComoNaoEnvia(true);
      }
    }
  };

  const marcarComoNaoEnvia = async (marcar: boolean) => {
    const update = marcar
      ? { nao_envia_extratos: true, marcado_em: new Date().toISOString() }
      : { nao_envia_extratos: false, marcado_em: null };
    await supabase.from('empresas').update(update).eq('id', empresaId);
    setEmpresa((prev) => (prev ? { ...prev, ...update } : prev));
  };

  const handleAddBanco = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = novoBanco.trim();
    if (!nome) return;
    setAdicionandoBanco(true);
    const { data: novo } = await supabase
      .from('bancos_empresa')
      .insert({ empresa_id: empresaId, nome_banco: nome })
      .select()
      .single();
    if (novo) {
      setBancos((prev) => [...prev, novo].sort((a, b) => a.nome_banco.localeCompare(b.nome_banco)));
    }
    setNovoBanco('');
    setAdicionandoBanco(false);
  };

  const handleRemoveBanco = async (bancoId: string, nome: string) => {
    if (!confirm(`Excluir o banco "${nome}"? Todos os registros de extrato deste banco serão removidos.`)) return;
    await supabase.from('bancos_empresa').delete().eq('id', bancoId);
    setBancos((prev) => prev.filter((b) => b.id !== bancoId));
    setExtratosAno((prev) => prev.filter((e) => e.banco_id !== bancoId));
  };

  const handleChecklistChange = async (etapaId: string, feito: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    const agora = new Date().toISOString();
    const existente = checklist.find((c) => c.etapa_id === etapaId);

    if (existente) {
      const { data } = await supabase
        .from('progresso_checklist')
        .update({
          feito_em: feito ? agora : null,
          feito_por: feito ? (user?.email || null) : null,
        })
        .eq('id', existente.id)
        .select()
        .single();
      if (data) {
        setChecklist((prev) => prev.map((c) => (c.id === existente.id ? data : c)));
      }
    } else {
      const { data } = await supabase
        .from('progresso_checklist')
        .insert({
          empresa_id: empresaId,
          etapa_id: etapaId,
          competencia,
          feito_em: feito ? agora : null,
          feito_por: feito ? (user?.email || null) : null,
        })
        .select()
        .single();
      if (data) setChecklist((prev) => [...prev, data]);
    }
  };

  const salvarObservacao = async () => {
    if (obsTexto === (observacao?.texto || '')) return;
    setSalvandoObs(true);
    const { data: { user } } = await supabase.auth.getUser();
    const agora = new Date().toISOString();
    if (observacao) {
      const { data } = await supabase
        .from('observacoes_empresa')
        .update({ texto: obsTexto, updated_at: agora, updated_by: user?.email || null })
        .eq('id', observacao.id)
        .select()
        .single();
      if (data) setObservacao(data);
    } else {
      const { data } = await supabase
        .from('observacoes_empresa')
        .insert({ empresa_id: empresaId, competencia, texto: obsTexto, updated_by: user?.email || null })
        .select()
        .single();
      if (data) setObservacao(data);
    }
    setSalvandoObs(false);
  };

  const handleAddTarefa = async (e: React.FormEvent) => {
    e.preventDefault();
    const titulo = novaTarefa.titulo.trim();
    if (!titulo) return;
    setSalvandoTarefa(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('tarefas_empresa')
      .insert({
        empresa_id: empresaId,
        competencia,
        titulo,
        descricao: novaTarefa.descricao.trim() || null,
        prazo: novaTarefa.prazo || null,
        created_by: user?.email || null,
      })
      .select()
      .single();
    setSalvandoTarefa(false);
    if (data) {
      setTarefas((prev) => [...prev, data]);
      setNovaTarefa({ titulo: '', descricao: '', prazo: '' });
    }
  };

  const handleToggleTarefa = async (tarefa: TarefaEmpresa) => {
    const { data: { user } } = await supabase.auth.getUser();
    const feita = !tarefa.feita;
    const agora = feita ? new Date().toISOString() : null;
    const { data } = await supabase
      .from('tarefas_empresa')
      .update({
        feita,
        feita_em: agora,
        feita_por: feita ? (user?.email || null) : null,
      })
      .eq('id', tarefa.id)
      .select()
      .single();
    if (data) setTarefas((prev) => prev.map((t) => (t.id === tarefa.id ? data : t)));
  };

  const handleRemoveTarefa = async (id: string) => {
    if (!confirm('Remover esta tarefa?')) return;
    await supabase.from('tarefas_empresa').delete().eq('id', id);
    setTarefas((prev) => prev.filter((t) => t.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Empresa não encontrada.</p>
      </div>
    );
  }

  const concluidos = checklist.filter((c) => c.feito_em).length;
  const totalChecklist = etapas.length;
  const percentual = totalChecklist > 0 ? Math.round((concluidos / totalChecklist) * 100) : 0;

  const hojeStr = new Date().toISOString().slice(0, 10);
  const tarefasAtrasadas = tarefas.filter((t) => !t.feita && t.prazo && t.prazo < hojeStr);
  const tarefasPendentes = tarefas.filter((t) => !t.feita).length;
  const tarefasFeitas = tarefas.filter((t) => t.feita).length;

  let statusBalanco: 'nao_iniciado' | 'em_andamento' | 'concluido' | 'atrasado';
  let statusLabel = '';
  let statusClasse = '';
  if (tarefasAtrasadas.length > 0) {
    statusBalanco = 'atrasado';
    statusLabel = 'Atrasado';
    statusClasse = 'bg-red-50 text-red-800 border-red-300';
  } else if (percentual === 0) {
    statusBalanco = 'nao_iniciado';
    statusLabel = 'Não iniciado';
    statusClasse = 'bg-slate-100 text-slate-700 border-slate-300';
  } else if (percentual === 100) {
    statusBalanco = 'concluido';
    statusLabel = 'Concluído';
    statusClasse = 'bg-emerald-50 text-emerald-800 border-emerald-300';
  } else {
    statusBalanco = 'em_andamento';
    statusLabel = 'Em andamento';
    statusClasse = 'bg-amber-50 text-amber-800 border-amber-300';
  }

  const etapasAgrupadas: Record<GrupoChecklist, Record<string, EtapaChecklist[]>> = {
    ativo: { circulante: [], nao_circulante: [] },
    passivo: { circulante: [], nao_circulante: [] },
    patrimonio_liquido: { _: [] },
  };
  for (const e of etapas) {
    const sub = e.subgrupo || '_';
    if (!etapasAgrupadas[e.grupo][sub]) etapasAgrupadas[e.grupo][sub] = [];
    etapasAgrupadas[e.grupo][sub].push(e);
  }

  const progressoPorEtapa: Record<string, ProgressoChecklist> = {};
  checklist.forEach((c) => { progressoPorEtapa[c.etapa_id] = c; });



  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar usuario={usuario} />

      <div className="flex flex-1">
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 min-w-0">
          <button
            onClick={() => router.back()}
            className="mb-6 text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar à lista
          </button>

          <div className="mb-8 border-b border-slate-200 pb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  Empresa
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">{empresa.nome}</h1>
                <p className="mt-1 text-sm text-slate-500">{empresa.email_contato || 'Sem e-mail cadastrado'}</p>
              </div>
              <button
                onClick={() => marcarComoNaoEnvia(!empresa.nao_envia_extratos)}
                className={`text-xs font-medium px-3 py-1.5 rounded border transition ${
                  empresa.nao_envia_extratos
                    ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-amber-50 hover:border-amber-300'
                }`}
              >
                {empresa.nao_envia_extratos ? 'Remover marcação' : 'Marcar como não envia extratos'}
              </button>
            </div>
            {empresa.nao_envia_extratos && (
              <div className="mt-4 border border-amber-300 bg-amber-50 text-amber-900 rounded-md px-4 py-3 text-sm">
                <p className="font-semibold">Empresa não envia extratos regularmente</p>
                <p className="text-xs mt-0.5">
                  Marcada em {empresa.marcado_em ? new Date(empresa.marcado_em).toLocaleDateString('pt-BR') : '—'}.
                  Continue cobrando, mas considere ações alternativas.
                </p>
              </div>
            )}
          </div>

          <div className="mb-6 bg-white border border-slate-200 rounded-md">
            <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Ano
                </label>
                <select
                  value={ano}
                  onChange={(e) => setAno(e.target.value)}
                  className="px-2.5 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  {anos.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Conclusão do balanço
                  </p>
                  <p className="text-xl font-semibold text-slate-900">
                    {percentual}%
                    <span className="text-xs font-normal text-slate-500 ml-2">
                      ({concluidos}/{totalChecklist})
                    </span>
                  </p>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded border uppercase tracking-wider ${statusClasse}`}
                  title={
                    statusBalanco === 'atrasado'
                      ? `${tarefasAtrasadas.length} tarefa${tarefasAtrasadas.length === 1 ? '' : 's'} atrasada${tarefasAtrasadas.length === 1 ? '' : 's'}`
                      : `${concluidos}/${totalChecklist} contas marcadas`
                  }
                >
                  {statusLabel}
                </span>
              </div>
            </div>
            <div className="px-2 py-2 flex flex-wrap gap-1">
              {meses.map((m) => {
                const ativo = mes === m.num;
                const status = statusDoMes(m.num);
                const pontoCor =
                  status === 'concluido' ? 'bg-emerald-500'
                  : status === 'parcial' ? 'bg-amber-500'
                  : status === 'pendente' ? 'bg-slate-300'
                  : '';
                return (
                  <button
                    key={m.num}
                    onClick={() => setMes(m.num)}
                    title={
                      status === 'concluido' ? 'Todos os extratos recebidos'
                      : status === 'parcial' ? 'Recebimento parcial'
                      : status === 'pendente' ? 'Nenhum extrato recebido'
                      : 'Sem bancos cadastrados'
                    }
                    className={`relative flex-1 min-w-[58px] px-3 py-2 text-xs font-medium rounded transition ${
                      ativo
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      {m.label}
                      {pontoCor && (
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${pontoCor}`} />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            {bancos.length > 0 && (
              <div className="px-3 pb-2 flex items-center gap-4 text-[10px] text-slate-500 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Concluído
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Parcial
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />
                  Pendente
                </span>
              </div>
            )}
          </div>

          <section className="bg-white border border-slate-200 rounded-md shadow-sm mb-6">
            <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                  Extratos bancários
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Cadastre bancos, atualize status e registre cobranças por banco para {competencia}.
                </p>
              </div>
              <form onSubmit={handleAddBanco} className="flex items-center gap-2">
                <input
                  type="text"
                  value={novoBanco}
                  onChange={(e) => setNovoBanco(e.target.value)}
                  placeholder="Nome do banco"
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                <button
                  type="submit"
                  disabled={adicionandoBanco || !novoBanco.trim()}
                  className="text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 px-3 py-1.5 rounded-md transition"
                >
                  {adicionandoBanco ? 'Adicionando...' : '+ Cadastrar banco'}
                </button>
              </form>
            </header>

            {bancos.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500">Nenhum banco cadastrado.</p>
                <p className="text-xs text-slate-400 mt-1">Use o campo acima para adicionar o primeiro banco.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Banco</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Status</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Cobranças</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Alterar</th>
                    <th className="px-5 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {bancos.map((banco, idx) => {
                    const status = statusDoBanco(banco.id);
                    const registro = extratosAno.find(
                      (e) => e.banco_id === banco.id && e.competencia === competencia
                    );
                    const qtd = registro?.qtd_solicitacoes || 0;
                    const ultima = registro?.ultima_solicitacao_em;
                    const recebido = status === 'recebido' || status === 'importado';
                    return (
                      <tr
                        key={banco.id}
                        className={`border-b border-slate-100 ${
                          idx === bancos.length - 1 ? 'border-b-0' : ''
                        }`}
                      >
                        <td className="px-5 py-3 text-slate-900 font-medium align-top">
                          {banco.nome_banco}
                        </td>
                        <td className="px-5 py-3 align-top">
                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${STATUS_BADGE_CLASS[status]}`}>
                            {STATUS_LABELS[status]}
                          </span>
                        </td>
                        <td className="px-5 py-3 align-top">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-medium ${qtd >= 3 ? 'text-amber-700' : 'text-slate-600'}`}>
                              {qtd === 0 ? 'Nenhuma' : `${qtd}×`}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRegistrarSolicitacao(banco.id)}
                              disabled={recebido}
                              title={recebido ? 'Extrato já recebido' : 'Registrar nova solicitação'}
                              className="text-xs font-medium px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-700 disabled:hover:border-slate-300 transition"
                            >
                              + Cobrar
                            </button>
                          </div>
                          {ultima && (
                            <p className="text-[11px] text-slate-500 mt-1">
                              Última: {new Date(ultima).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3 align-top">
                          <select
                            value={status}
                            onChange={(e) => handleStatusChange(banco.id, e.target.value as StatusExtrato)}
                            className="px-2.5 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                          >
                            <option value="pendente">Pendente</option>
                            <option value="solicitado">Solicitado</option>
                            <option value="recebido">Recebido</option>
                            <option value="importado">Importado</option>
                          </select>
                        </td>
                        <td className="px-5 py-3 text-right align-top">
                          <button
                            onClick={() => handleRemoveBanco(banco.id, banco.nome_banco)}
                            title="Excluir banco"
                            className="text-slate-400 hover:text-red-600 transition"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <div className="space-y-6">
              <section className="bg-white border border-slate-200 rounded-md shadow-sm">
              <header className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                  Checklist do balanço
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Marque cada conta conforme conferir o balanço da competência {competencia}.
                </p>
              </header>

              {etapas.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-slate-500">Nenhuma conta cadastrada.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    O coordenador pode adicionar contas em Configurações.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-slate-200">
                  {(['ativo', 'passivo', 'patrimonio_liquido'] as GrupoChecklist[]).map((grupo) => {
                    const subgrupos = etapasAgrupadas[grupo] || {};
                    const totalGrupo = Object.values(subgrupos).flat().length;
                    const feitosGrupo = Object.values(subgrupos).flat().filter(
                      (e) => progressoPorEtapa[e.id]?.feito_em
                    ).length;

                    return (
                      <div key={grupo} className="bg-white">
                        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
                            {GRUPO_LABEL[grupo]}
                          </h3>
                          <span className="text-[11px] font-medium text-slate-500">
                            {feitosGrupo}/{totalGrupo}
                          </span>
                        </div>

                        <div className="p-4 space-y-4">
                          {Object.entries(subgrupos).map(([subkey, lista]) => {
                            if (lista.length === 0) return null;
                            return (
                              <div key={subkey}>
                                {subkey !== '_' && (
                                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    {SUBGRUPO_LABEL[subkey]}
                                  </p>
                                )}
                                <ul className="space-y-1">
                                  {lista.map((etapa) => {
                                    const progresso = progressoPorEtapa[etapa.id];
                                    const feito = !!progresso?.feito_em;
                                    return (
                                      <li key={etapa.id}>
                                        <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer group">
                                          <input
                                            type="checkbox"
                                            checked={feito}
                                            onChange={(e) => handleChecklistChange(etapa.id, e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                                          />
                                          <span
                                            className={`text-sm flex-1 ${
                                              feito ? 'text-slate-400 line-through' : 'text-slate-900'
                                            }`}
                                          >
                                            {etapa.nome}
                                          </span>
                                          {feito && progresso?.feito_em && (
                                            <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition">
                                              {new Date(progresso.feito_em).toLocaleDateString('pt-BR')}
                                            </span>
                                          )}
                                        </label>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              </section>

              {/* Tarefas */}
              <section className="bg-white border border-slate-200 rounded-md shadow-sm">
                <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                      Tarefas · {competencia}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {tarefasPendentes} pendente{tarefasPendentes === 1 ? '' : 's'} · {tarefasFeitas} feita{tarefasFeitas === 1 ? '' : 's'}
                      {tarefasAtrasadas.length > 0 && (
                        <span className="text-red-700 font-semibold ml-2">
                          · {tarefasAtrasadas.length} atrasada{tarefasAtrasadas.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </p>
                  </div>
                </header>

                <form onSubmit={handleAddTarefa} className="p-4 border-b border-slate-200 grid grid-cols-1 md:grid-cols-[1fr_240px_160px_auto] gap-2 items-end bg-slate-50/50">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Título
                    </label>
                    <input
                      type="text"
                      value={novaTarefa.titulo}
                      onChange={(e) => setNovaTarefa({ ...novaTarefa, titulo: e.target.value })}
                      placeholder="Ex: Pedir nota fiscal do mês"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Descrição (opcional)
                    </label>
                    <input
                      type="text"
                      value={novaTarefa.descricao}
                      onChange={(e) => setNovaTarefa({ ...novaTarefa, descricao: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Prazo
                    </label>
                    <input
                      type="date"
                      value={novaTarefa.prazo}
                      onChange={(e) => setNovaTarefa({ ...novaTarefa, prazo: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={salvandoTarefa || !novaTarefa.titulo.trim()}
                    className="text-xs font-medium px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition whitespace-nowrap"
                  >
                    {salvandoTarefa ? 'Salvando...' : '+ Adicionar'}
                  </button>
                </form>

                {tarefas.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-slate-500">Nenhuma tarefa para este mês.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {tarefas.map((t) => {
                      const atrasada = !t.feita && t.prazo && t.prazo < hojeStr;
                      return (
                        <li
                          key={t.id}
                          className={`px-5 py-3 flex items-start gap-3 group hover:bg-slate-50 ${
                            atrasada ? 'bg-red-50/40' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={t.feita}
                            onChange={() => handleToggleTarefa(t)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium ${
                                t.feita ? 'text-slate-400 line-through' : 'text-slate-900'
                              }`}
                            >
                              {t.titulo}
                            </p>
                            {t.descricao && (
                              <p className="text-xs text-slate-500 mt-0.5">{t.descricao}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              {t.prazo && (
                                <span
                                  className={`text-[11px] font-medium ${
                                    atrasada ? 'text-red-700' : t.feita ? 'text-slate-400' : 'text-slate-600'
                                  }`}
                                >
                                  Prazo: {new Date(t.prazo + 'T00:00').toLocaleDateString('pt-BR')}
                                  {atrasada && ' (vencida)'}
                                </span>
                              )}
                              {t.feita && t.feita_em && (
                                <span className="text-[11px] text-emerald-700">
                                  Feita em {new Date(t.feita_em).toLocaleDateString('pt-BR')}
                                  {t.feita_por && ` · ${t.feita_por}`}
                                </span>
                              )}
                              {t.created_by && (
                                <span className="text-[11px] text-slate-400">
                                  criada por {t.created_by}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveTarefa(t.id)}
                            title="Remover tarefa"
                            className="text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                            </svg>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Observações */}
              <section className="bg-white border border-slate-200 rounded-md shadow-sm">
                <header className="px-5 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    Observações · {competencia}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Notas sobre esta empresa neste mês. Salva automaticamente ao sair do campo.
                  </p>
                </header>
                <div className="p-5">
                  <textarea
                    value={obsTexto}
                    onChange={(e) => setObsTexto(e.target.value)}
                    onBlur={salvarObservacao}
                    placeholder="Escreva aqui qualquer observação relevante sobre o trabalho desta empresa neste mês..."
                    rows={6}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y"
                  />
                  <div className="mt-2 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-500">
                    <span>
                      {salvandoObs
                        ? 'Salvando...'
                        : observacao
                        ? `Última atualização: ${new Date(observacao.updated_at).toLocaleString('pt-BR')}${observacao.updated_by ? ` por ${observacao.updated_by}` : ''}`
                        : 'Sem observações registradas para esta competência.'}
                    </span>
                  </div>
                </div>
              </section>
            </div>
        </main>
      </div>
    </div>
  );
}
