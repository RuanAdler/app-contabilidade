'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Empresa, BancoEmpresa, SolicitacaoExtrato, ProgressoChecklist, EtapaChecklist, GrupoChecklist } from '@/lib/types';

type Aba = 'extratos' | 'checklist';
type StatusExtrato = 'pendente' | 'solicitado' | 'recebido' | 'importado';
type StatusMes = 'vazio' | 'pendente' | 'parcial' | 'concluido';

const GRUPO_LABEL: Record<GrupoChecklist, string> = {
  ativo: 'Ativo',
  passivo: 'Passivo',
  patrimonio_liquido: 'Patrimônio Líquido',
};

const SUBGRUPO_LABEL: Record<string, string> = {
  circulante: 'Circulante',
  nao_circulante: 'Não circulante',
};

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

export default function EmpresaDetail() {
  const [usuario, setUsuario] = useState<any>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [bancos, setBancos] = useState<BancoEmpresa[]>([]);
  const [extratosAno, setExtratosAno] = useState<SolicitacaoExtrato[]>([]);
  const [checklist, setChecklist] = useState<ProgressoChecklist[]>([]);
  const [etapas, setEtapas] = useState<EtapaChecklist[]>([]);
  const hoje = new Date();
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const [mes, setMes] = useState(String(hoje.getMonth() + 1).padStart(2, '0'));
  const competencia = `${ano}-${mes}`;
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>('extratos');
  const [sidebarAberta, setSidebarAberta] = useState(true);
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
      const [{ data: etapasData }, { data: progressoData }] = await Promise.all([
        supabase.from('etapas_checklist').select('*').order('ordem'),
        supabase
          .from('progresso_checklist')
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('competencia', competencia),
      ]);
      setEtapas(etapasData || []);
      setChecklist(progressoData || []);
    };
    carregar();
  }, [empresaId, competencia]);

  const statusDoBanco = (bancoId: string, comp: string = competencia): StatusExtrato => {
    const e = extratosAno.find((x) => x.banco_id === bancoId && x.competencia === comp);
    return (e?.status as StatusExtrato) || 'pendente';
  };

  const statusDoMes = (numMes: string): StatusMes => {
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
    if (existente) {
      await supabase
        .from('solicitacoes_extrato')
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq('id', existente.id);
      setExtratosAno((prev) =>
        prev.map((e) => (e.id === existente.id ? { ...e, status: novoStatus } : e))
      );
    } else {
      const { data: novo } = await supabase
        .from('solicitacoes_extrato')
        .insert({ banco_id: bancoId, competencia, status: novoStatus })
        .select()
        .single();
      if (novo) setExtratosAno((prev) => [...prev, novo]);
    }
  };

  const handleRegistrarSolicitacao = async (bancoId: string) => {
    const existente = extratosAno.find(
      (e) => e.banco_id === bancoId && e.competencia === competencia
    );
    const agora = new Date().toISOString();
    let registro: SolicitacaoExtrato | null = null;
    if (existente) {
      const novaQtd = (existente.qtd_solicitacoes || 0) + 1;
      const novoStatus: StatusExtrato =
        existente.status === 'recebido' || existente.status === 'importado'
          ? existente.status
          : 'solicitado';
      const { data } = await supabase
        .from('solicitacoes_extrato')
        .update({
          qtd_solicitacoes: novaQtd,
          ultima_solicitacao_em: agora,
          status: novoStatus,
          updated_at: agora,
        })
        .eq('id', existente.id)
        .select()
        .single();
      registro = data;
      if (data) {
        setExtratosAno((prev) =>
          prev.map((e) => (e.id === existente.id ? data : e))
        );
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

    // Regra automática: 3+ solicitações + 2 dias parado em pendente/solicitado
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

  const bancosRecebidos = bancos.filter((b) => {
    const s = statusDoBanco(b.id);
    return s === 'recebido' || s === 'importado';
  });
  const bancosPendentes = bancos.filter((b) => {
    const s = statusDoBanco(b.id);
    return s !== 'recebido' && s !== 'importado';
  });

  let resumoTexto = '';
  let resumoClasse = '';
  let resumoTitulo = '';
  if (bancos.length === 0) {
    resumoTitulo = 'Sem bancos cadastrados';
    resumoTexto = 'Cadastre os bancos da empresa para começar a controlar os extratos.';
    resumoClasse = 'bg-slate-50 border-slate-200 text-slate-700';
  } else if (bancosPendentes.length === 0) {
    resumoTitulo = 'Envio concluído';
    resumoTexto = `Todos os ${bancos.length} extratos foram recebidos para ${competencia}.`;
    resumoClasse = 'bg-emerald-50 border-emerald-200 text-emerald-800';
  } else if (bancosRecebidos.length === 0) {
    resumoTitulo = 'Nenhum extrato recebido';
    resumoTexto = `Aguardando extratos de ${bancos.length} ${bancos.length === 1 ? 'banco' : 'bancos'}.`;
    resumoClasse = 'bg-amber-50 border-amber-200 text-amber-900';
  } else {
    resumoTitulo = `Faltam ${bancosPendentes.length} de ${bancos.length}`;
    resumoTexto = `Falta extrato de: ${bancosPendentes.map((b) => b.nome_banco).join(', ')}.`;
    resumoClasse = 'bg-amber-50 border-amber-200 text-amber-900';
  }

  const itensMenu: { id: Aba; label: string; icone: React.ReactNode }[] = [
    {
      id: 'extratos',
      label: 'Extratos bancários',
      icone: (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
        </svg>
      ),
    },
    {
      id: 'checklist',
      label: 'Checklist do balanço',
      icone: (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar usuario={usuario} />

      <div className="flex flex-1">
        <aside
          className={`bg-white border-r border-slate-200 transition-all duration-200 flex flex-col ${
            sidebarAberta ? 'w-56' : 'w-14'
          }`}
        >
          <div className="h-12 flex items-center justify-end px-2 border-b border-slate-200">
            <button
              onClick={() => setSidebarAberta(!sidebarAberta)}
              className="h-8 w-8 inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
              title={sidebarAberta ? 'Ocultar menu' : 'Mostrar menu'}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {sidebarAberta ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                )}
              </svg>
            </button>
          </div>

          <nav className="flex-1 py-2">
            {itensMenu.map((item) => {
              const ativo = aba === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setAba(item.id)}
                  title={!sidebarAberta ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition border-l-2 ${
                    ativo
                      ? 'border-slate-900 bg-slate-50 text-slate-900 font-medium'
                      : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  } ${!sidebarAberta && 'justify-center px-0'}`}
                >
                  {item.icone}
                  {sidebarAberta && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 px-6 py-8 min-w-0">
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

          {aba === 'extratos' && (
            <div className="space-y-4">
              <div className={`border rounded-md px-5 py-4 ${resumoClasse}`}>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                  Situação geral · {competencia}
                </p>
                <p className="mt-1 text-base font-semibold">{resumoTitulo}</p>
                <p className="mt-0.5 text-sm">{resumoTexto}</p>
                {bancos.length > 0 && (
                  <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-current transition-all"
                      style={{
                        width: `${Math.round((bancosRecebidos.length / bancos.length) * 100)}%`,
                        opacity: 0.6,
                      }}
                    />
                  </div>
                )}
              </div>

              <section className="bg-white border border-slate-200 rounded-md shadow-sm">
                <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                      Extratos bancários
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Atualize o status de cada banco para a competência selecionada.
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
                      {adicionandoBanco ? 'Adicionando...' : 'Adicionar banco'}
                    </button>
                  </form>
                </header>

                {bancos.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-slate-500">Nenhum banco cadastrado para esta empresa.</p>
                    <p className="text-xs text-slate-400 mt-1">Use o campo acima para adicionar o primeiro banco.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">
                          Banco
                        </th>
                        <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">
                          Status
                        </th>
                        <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">
                          Solicitações
                        </th>
                        <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">
                          Alterar
                        </th>
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
                              <span
                                className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${STATUS_BADGE_CLASS[status]}`}
                              >
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
                                  + Registrar
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
            </div>
          )}

          {aba === 'checklist' && (
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
          )}
        </main>
      </div>
    </div>
  );
}
