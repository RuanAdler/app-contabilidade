'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Empresa, ProgressoChecklist, TarefaEmpresa, PedidoHelp, BancoEmpresa, SolicitacaoExtrato } from '@/lib/types';

type FiltroEnvio = 'todas' | 'regulares' | 'nao_envia';
type FiltroBalanco = 'todos' | 'nao_iniciado' | 'em_andamento' | 'concluido' | 'atrasado';
type StatusBalanco = 'nao_iniciado' | 'em_andamento' | 'concluido' | 'atrasado';
type StatusExtrato = 'pendente' | 'solicitado' | 'recebido' | 'importado';
type FiltroExtrato = 'todos' | 'pendentes' | 'parciais' | 'completos';
type Aba = 'pendencias' | 'empresas' | 'help' | 'extratos';

const STATUS_EXT_LABEL: Record<StatusExtrato, string> = {
  pendente: 'Pendente',
  solicitado: 'Solicitado',
  recebido: 'Recebido',
  importado: 'Importado',
};

const STATUS_EXT_CLASS: Record<StatusExtrato, string> = {
  pendente: 'bg-slate-100 text-slate-700 border-slate-300',
  solicitado: 'bg-amber-50 text-amber-800 border-amber-300',
  recebido: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  importado: 'bg-slate-900 text-white border-slate-900',
};

const MESES = [
  { num: '01', label: 'Jan' }, { num: '02', label: 'Fev' }, { num: '03', label: 'Mar' },
  { num: '04', label: 'Abr' }, { num: '05', label: 'Mai' }, { num: '06', label: 'Jun' },
  { num: '07', label: 'Jul' }, { num: '08', label: 'Ago' }, { num: '09', label: 'Set' },
  { num: '10', label: 'Out' }, { num: '11', label: 'Nov' }, { num: '12', label: 'Dez' },
];

const hoje = new Date();
const COMPETENCIA_ATUAL = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
const HOJE_STR = hoje.toISOString().slice(0, 10);

function diasAFrente(n: number) {
  const d = new Date(hoje);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
const AMANHA_STR = diasAFrente(1);
const SEMANA_STR = diasAFrente(7);

const STATUS_LABEL: Record<StatusBalanco, string> = {
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  atrasado: 'Atrasado',
};

const STATUS_CLASS: Record<StatusBalanco, string> = {
  nao_iniciado: 'bg-slate-100 text-slate-700 border-slate-300',
  em_andamento: 'bg-amber-50 text-amber-800 border-amber-300',
  concluido: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  atrasado: 'bg-red-50 text-red-800 border-red-300',
};

export default function DashboardAnalista() {
  const [usuario, setUsuario] = useState<any>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [checklistMes, setChecklistMes] = useState<ProgressoChecklist[]>([]);
  const [tarefasMes, setTarefasMes] = useState<TarefaEmpresa[]>([]);
  const [totalEtapas, setTotalEtapas] = useState(0);
  const [busca, setBusca] = useState('');
  const [filtroEnvio, setFiltroEnvio] = useState<FiltroEnvio>('todas');
  const [filtroBalanco, setFiltroBalanco] = useState<FiltroBalanco>('todos');
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>('empresas');
  const [sidebarAberta, setSidebarAberta] = useState(true);
  const [pedidosHelp, setPedidosHelp] = useState<PedidoHelp[]>([]);
  const [helpEmpresa, setHelpEmpresa] = useState('');
  const [helpEmpresaBusca, setHelpEmpresaBusca] = useState('');
  const [helpDropdownAberto, setHelpDropdownAberto] = useState(false);
  const [helpMensagem, setHelpMensagem] = useState('');
  const [enviandoHelp, setEnviandoHelp] = useState(false);

  // Extratos
  const [bancos, setBancos] = useState<BancoEmpresa[]>([]);
  const [extratos, setExtratos] = useState<SolicitacaoExtrato[]>([]);
  const [extrAno, setExtrAno] = useState(String(hoje.getFullYear()));
  const [extrMes, setExtrMes] = useState(String(hoje.getMonth() + 1).padStart(2, '0'));
  const [extrBusca, setExtrBusca] = useState('');
  const [extrFiltro, setExtrFiltro] = useState<FiltroExtrato>('todos');
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      setUsuario(session.user);

      const { data: analistaData } = await supabase
        .from('analistas')
        .select('id')
        .eq('email', session.user.email)
        .single();

      if (analistaData) {
        const { data: empresasData } = await supabase
          .from('empresas')
          .select('*')
          .eq('analista_id', analistaData.id)
          .neq('status', 'baixada')
          .order('nome');

        const lista = empresasData || [];
        setEmpresas(lista);

        const ids = lista.map((e) => e.id);
        if (ids.length > 0) {
          const [{ data: checklist }, { data: tarefas }, { count }] = await Promise.all([
            supabase
              .from('progresso_checklist')
              .select('*')
              .in('empresa_id', ids)
              .eq('competencia', COMPETENCIA_ATUAL),
            supabase
              .from('tarefas_empresa')
              .select('*')
              .in('empresa_id', ids)
              .eq('competencia', COMPETENCIA_ATUAL),
            supabase
              .from('etapas_checklist')
              .select('*', { count: 'exact', head: true }),
          ]);
          setChecklistMes(checklist || []);
          setTarefasMes(tarefas || []);
          setTotalEtapas(count || 0);
        }

        const { data: helpData } = await supabase
          .from('pedidos_help')
          .select('*')
          .eq('analista_email', session.user.email)
          .order('created_at', { ascending: false });
        setPedidosHelp(helpData || []);

        // Bancos das empresas do analista
        if (lista.length > 0) {
          const idsEmpresas = lista.map((e) => e.id);
          const { data: bancosData } = await supabase
            .from('bancos_empresa')
            .select('*')
            .in('empresa_id', idsEmpresas)
            .order('nome_banco');
          setBancos(bancosData || []);
        }
      }

      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const empresasPorId = useMemo(() => {
    const m: Record<string, Empresa> = {};
    empresas.forEach((e) => { m[e.id] = e; });
    return m;
  }, [empresas]);

  const extrCompetencia = `${extrAno}-${extrMes}`;

  useEffect(() => {
    const carregarExtratos = async () => {
      if (bancos.length === 0) {
        setExtratos([]);
        return;
      }
      const { data } = await supabase
        .from('solicitacoes_extrato')
        .select('*')
        .in('banco_id', bancos.map((b) => b.id))
        .eq('competencia', extrCompetencia);
      setExtratos(data || []);
    };
    carregarExtratos();
  }, [bancos, extrCompetencia]);

  const extratoPorBanco = useMemo(() => {
    const m: Record<string, SolicitacaoExtrato> = {};
    extratos.forEach((e) => { m[e.banco_id] = e; });
    return m;
  }, [extratos]);

  const bancosPorEmpresa = useMemo(() => {
    const m: Record<string, BancoEmpresa[]> = {};
    bancos.forEach((b) => {
      if (!m[b.empresa_id]) m[b.empresa_id] = [];
      m[b.empresa_id].push(b);
    });
    return m;
  }, [bancos]);

  const statusGeralEmpresa = (empresaId: string) => {
    const bs = bancosPorEmpresa[empresaId] || [];
    if (bs.length === 0) return { recebidos: 0, total: 0, classe: 'sem_bancos' as const };
    const recebidos = bs.filter((b) => {
      const e = extratoPorBanco[b.id];
      return e && (e.status === 'recebido' || e.status === 'importado');
    }).length;
    let classe: 'completo' | 'parcial' | 'pendente' = 'pendente';
    if (recebidos === bs.length) classe = 'completo';
    else if (recebidos > 0) classe = 'parcial';
    return { recebidos, total: bs.length, classe };
  };

  const statusBalancoDaEmpresa = (empresaId: string): StatusBalanco => {
    const temAtrasada = tarefasMes.some(
      (t) => t.empresa_id === empresaId && !t.feita && t.prazo && t.prazo < HOJE_STR
    );
    if (temAtrasada) return 'atrasado';
    if (totalEtapas === 0) return 'nao_iniciado';
    const feitos = checklistMes.filter(
      (c) => c.empresa_id === empresaId && c.feito_em
    ).length;
    if (feitos === 0) return 'nao_iniciado';
    if (feitos >= totalEtapas) return 'concluido';
    return 'em_andamento';
  };

  // Pendências
  const tarefasAtrasadas = useMemo(() =>
    tarefasMes.filter((t) => !t.feita && t.prazo && t.prazo < HOJE_STR)
      .sort((a, b) => (a.prazo || '').localeCompare(b.prazo || '')),
    [tarefasMes]
  );

  const tarefasParaHoje = useMemo(() =>
    tarefasMes.filter((t) => !t.feita && t.prazo === HOJE_STR),
    [tarefasMes]
  );

  const tarefasProximas = useMemo(() =>
    tarefasMes.filter((t) => !t.feita && t.prazo && t.prazo > HOJE_STR && t.prazo <= SEMANA_STR)
      .sort((a, b) => (a.prazo || '').localeCompare(b.prazo || '')),
    [tarefasMes]
  );

  const balancosNaoIniciados = useMemo(() => {
    return empresas.filter((e) => {
      if (e.status === 'suspensa') return false;
      return statusBalancoDaEmpresa(e.id) === 'nao_iniciado';
    });
  }, [empresas, checklistMes, tarefasMes, totalEtapas]);

  const totalPendencias = tarefasAtrasadas.length + tarefasParaHoje.length;

  const empresasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return empresas.filter((e) => {
      const passaBusca =
        !termo ||
        e.nome.toLowerCase().includes(termo) ||
        (e.email_contato || '').toLowerCase().includes(termo);
      const passaEnvio =
        filtroEnvio === 'todas' ||
        (filtroEnvio === 'regulares' && !e.nao_envia_extratos) ||
        (filtroEnvio === 'nao_envia' && e.nao_envia_extratos);
      const passaBalanco =
        filtroBalanco === 'todos' || statusBalancoDaEmpresa(e.id) === filtroBalanco;
      return passaBusca && passaEnvio && passaBalanco;
    });
  }, [empresas, busca, filtroEnvio, filtroBalanco, checklistMes, tarefasMes, totalEtapas]);

  const totalNaoEnvia = empresas.filter((e) => e.nao_envia_extratos).length;

  const contagens = useMemo(() => {
    const c = { nao_iniciado: 0, em_andamento: 0, concluido: 0, atrasado: 0 };
    for (const emp of empresas) {
      c[statusBalancoDaEmpresa(emp.id)]++;
    }
    return c;
  }, [empresas, checklistMes, tarefasMes, totalEtapas]);

  const helpsAbertos = useMemo(
    () => pedidosHelp.filter((p) => p.status !== 'resolvido'),
    [pedidosHelp]
  );
  const helpsResolvidos = useMemo(
    () => pedidosHelp.filter((p) => p.status === 'resolvido'),
    [pedidosHelp]
  );

  const helpSugestoes = useMemo(() => {
    const termo = helpEmpresaBusca.trim().toLowerCase();
    if (!termo) return empresas.slice(0, 8);
    return empresas
      .filter((e) => e.nome.toLowerCase().includes(termo))
      .slice(0, 8);
  }, [empresas, helpEmpresaBusca]);

  const handleCriarHelp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!helpEmpresa || !helpMensagem.trim()) return;
    setEnviandoHelp(true);
    const { data } = await supabase
      .from('pedidos_help')
      .insert({
        empresa_id: helpEmpresa,
        analista_email: usuario?.email,
        mensagem: helpMensagem.trim(),
      })
      .select()
      .single();
    setEnviandoHelp(false);
    if (data) {
      setPedidosHelp((prev) => [data, ...prev]);
      setHelpEmpresa('');
      setHelpEmpresaBusca('');
      setHelpMensagem('');
    }
  };

  const handleResolverPropio = async (id: string) => {
    if (!confirm('Marcar este help como resolvido por você mesmo?')) return;
    const { data } = await supabase
      .from('pedidos_help')
      .update({
        status: 'resolvido',
        resolvido_em: new Date().toISOString(),
        resolvido_por_email: usuario?.email,
        resolvido_por_tipo: 'analista',
      })
      .eq('id', id)
      .select()
      .single();
    if (data) setPedidosHelp((prev) => prev.map((p) => (p.id === id ? data : p)));
  };

  const handleStatusExtrato = async (bancoId: string, novoStatus: StatusExtrato) => {
    const existente = extratoPorBanco[bancoId];
    const agora = new Date().toISOString();
    if (existente) {
      const { data } = await supabase
        .from('solicitacoes_extrato')
        .update({ status: novoStatus, updated_at: agora })
        .eq('id', existente.id)
        .select()
        .single();
      if (data) setExtratos((prev) => prev.map((e) => (e.id === existente.id ? data : e)));
    } else {
      const { data } = await supabase
        .from('solicitacoes_extrato')
        .insert({ banco_id: bancoId, competencia: extrCompetencia, status: novoStatus })
        .select()
        .single();
      if (data) setExtratos((prev) => [...prev, data]);
    }
  };

  const registrarCobrancaBanco = async (bancoId: string) => {
    const existente = extratoPorBanco[bancoId];
    const agora = new Date().toISOString();
    if (existente) {
      if (existente.status === 'recebido' || existente.status === 'importado') return existente;
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
      if (data) setExtratos((prev) => prev.map((e) => (e.id === existente.id ? data : e)));
      return data;
    } else {
      const { data } = await supabase
        .from('solicitacoes_extrato')
        .insert({
          banco_id: bancoId,
          competencia: extrCompetencia,
          status: 'solicitado',
          qtd_solicitacoes: 1,
          ultima_solicitacao_em: agora,
        })
        .select()
        .single();
      if (data) setExtratos((prev) => [...prev, data]);
      return data;
    }
  };

  const handleRegistrarCobranca = async (bancoId: string) => {
    await registrarCobrancaBanco(bancoId);
  };

  const handleAplicarStatusEmTodos = async (empresaId: string, novoStatus: StatusExtrato) => {
    const bs = bancosPorEmpresa[empresaId] || [];
    for (const b of bs) {
      await handleStatusExtrato(b.id, novoStatus);
    }
  };

  const handleCobrarTodosDaEmpresa = async (empresaId: string) => {
    const bs = bancosPorEmpresa[empresaId] || [];
    const pendentes = bs.filter((b) => {
      const e = extratoPorBanco[b.id];
      return !e || (e.status !== 'recebido' && e.status !== 'importado');
    });
    if (pendentes.length === 0) return;
    for (const b of pendentes) {
      await registrarCobrancaBanco(b.id);
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
    if (data) setTarefasMes((prev) => prev.map((t) => (t.id === tarefa.id ? data : t)));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    );
  }

  const itensMenu: { id: Aba; label: string; icone: React.ReactNode; badge?: number }[] = [
    {
      id: 'empresas',
      label: 'Empresas',
      icone: (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      id: 'extratos',
      label: 'Extratos',
      icone: (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
        </svg>
      ),
    },
    {
      id: 'pendencias',
      label: 'Pendências',
      badge: totalPendencias > 0 ? totalPendencias : undefined,
      icone: (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      id: 'help',
      label: 'Help',
      badge: helpsAbertos.length > 0 ? helpsAbertos.length : undefined,
      icone: (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
          <circle cx="12" cy="12" r="3" strokeWidth={1.8} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5.636 5.636l3.536 3.536m5.656 0l3.536-3.536m-3.536 9.192l3.536 3.536m-9.192-3.536l-3.536 3.536" />
        </svg>
      ),
    },
  ];

  const renderTarefaCard = (t: TarefaEmpresa, classNamePrazo: string) => {
    const empresa = empresasPorId[t.empresa_id];
    return (
      <li key={t.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50">
        <input
          type="checkbox"
          checked={t.feita}
          onChange={() => handleToggleTarefa(t)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <p className="text-sm font-medium text-slate-900">{t.titulo}</p>
            {t.prazo && (
              <span className={`text-[11px] font-medium ${classNamePrazo}`}>
                {new Date(t.prazo + 'T00:00').toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
          {empresa && (
            <Link
              href={`/empresa/${empresa.id}`}
              className="text-xs text-slate-500 hover:text-slate-900 hover:underline"
            >
              {empresa.nome}
            </Link>
          )}
          {t.descricao && <p className="text-xs text-slate-500 mt-0.5">{t.descricao}</p>}
        </div>
      </li>
    );
  };

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
                  {sidebarAberta && (
                    <span className="flex-1 truncate flex items-center justify-between gap-2">
                      <span>{item.label}</span>
                      {item.badge !== undefined && (
                        <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                          {item.badge}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 px-6 py-8 min-w-0">
          {aba === 'pendencias' && (
            <>
              <div className="mb-8 border-b border-slate-200 pb-6">
                <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  Minhas pendências
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                  O que precisa da sua atenção
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Tarefas e balanços pendentes para a competência {COMPETENCIA_ATUAL}.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Atrasadas
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-red-700">
                    {tarefasAtrasadas.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Para hoje
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-amber-700">
                    {tarefasParaHoje.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Próximos 7 dias
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-700">
                    {tarefasProximas.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Balanços não iniciados
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {balancosNaoIniciados.length}
                  </p>
                </div>
              </div>

              {tarefasAtrasadas.length === 0 &&
                tarefasParaHoje.length === 0 &&
                tarefasProximas.length === 0 &&
                balancosNaoIniciados.length === 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-md px-5 py-8 text-center">
                    <p className="text-sm font-semibold text-emerald-800">Está tudo em dia.</p>
                    <p className="text-xs text-emerald-700 mt-1">
                      Nenhuma pendência para a competência atual.
                    </p>
                  </div>
                )}

              {tarefasAtrasadas.length > 0 && (
                <section className="mb-6">
                  <header className="mb-3 flex items-baseline justify-between">
                    <h2 className="text-sm font-semibold text-red-800 uppercase tracking-wider">
                      Tarefas atrasadas
                    </h2>
                    <p className="text-xs text-slate-500">{tarefasAtrasadas.length}</p>
                  </header>
                  <ul className="bg-white border border-red-200 rounded-md divide-y divide-red-100 shadow-sm">
                    {tarefasAtrasadas.map((t) =>
                      renderTarefaCard(t, 'text-red-700')
                    )}
                  </ul>
                </section>
              )}

              {tarefasParaHoje.length > 0 && (
                <section className="mb-6">
                  <header className="mb-3 flex items-baseline justify-between">
                    <h2 className="text-sm font-semibold text-amber-800 uppercase tracking-wider">
                      Para hoje · {new Date().toLocaleDateString('pt-BR')}
                    </h2>
                    <p className="text-xs text-slate-500">{tarefasParaHoje.length}</p>
                  </header>
                  <ul className="bg-white border border-amber-200 rounded-md divide-y divide-amber-100 shadow-sm">
                    {tarefasParaHoje.map((t) =>
                      renderTarefaCard(t, 'text-amber-700')
                    )}
                  </ul>
                </section>
              )}

              {tarefasProximas.length > 0 && (
                <section className="mb-6">
                  <header className="mb-3 flex items-baseline justify-between">
                    <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                      Próximos 7 dias
                    </h2>
                    <p className="text-xs text-slate-500">{tarefasProximas.length}</p>
                  </header>
                  <ul className="bg-white border border-slate-200 rounded-md divide-y divide-slate-100 shadow-sm">
                    {tarefasProximas.map((t) =>
                      renderTarefaCard(t, 'text-slate-600')
                    )}
                  </ul>
                </section>
              )}

              {balancosNaoIniciados.length > 0 && (
                <section className="mb-6">
                  <header className="mb-3 flex items-baseline justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                        Balanços não iniciados
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Empresas em que nenhuma conta do checklist foi marcada neste mês.
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">{balancosNaoIniciados.length}</p>
                  </header>
                  <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        {balancosNaoIniciados.slice(0, 30).map((emp, idx, arr) => (
                          <tr
                            key={emp.id}
                            className={`border-b border-slate-100 hover:bg-slate-50 ${
                              idx === arr.length - 1 ? 'border-b-0' : ''
                            }`}
                          >
                            <td className="px-4 py-2.5 text-slate-900 font-medium">
                              {emp.nome}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {emp.status === 'suspensa' && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border bg-amber-50 text-amber-800 border-amber-300">
                                    Suspensa
                                  </span>
                                )}
                                {emp.nao_envia_extratos && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border bg-amber-50 text-amber-800 border-amber-300">
                                    Não envia extratos
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <Link
                                href={`/empresa/${emp.id}`}
                                className="text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-400 rounded px-2.5 py-1 transition"
                              >
                                Abrir
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {balancosNaoIniciados.length > 30 && (
                      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">
                        Exibindo 30 de {balancosNaoIniciados.length}. Veja todos em Empresas.
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {aba === 'help' && (
            <>
              <div className="mb-8 border-b border-slate-200 pb-6">
                <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  Suporte
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                  Pedir ajuda à coordenação
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Descreva sua dúvida sobre uma empresa e a coordenadora vai te responder.
                </p>
              </div>

              <section className="mb-8 bg-white border border-slate-200 rounded-md shadow-sm">
                <header className="px-5 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    Novo pedido
                  </h2>
                </header>
                <form onSubmit={handleCriarHelp} className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Empresa
                    </label>
                    <div className="relative">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                      </svg>
                      <input
                        type="text"
                        value={helpEmpresaBusca}
                        onChange={(e) => {
                          setHelpEmpresaBusca(e.target.value);
                          setHelpEmpresa('');
                          setHelpDropdownAberto(true);
                        }}
                        onFocus={() => setHelpDropdownAberto(true)}
                        onBlur={() => setTimeout(() => setHelpDropdownAberto(false), 150)}
                        placeholder="Digite para pesquisar uma empresa..."
                        className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                      {helpDropdownAberto && helpSugestoes.length > 0 && (
                        <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-64 overflow-auto">
                          {helpSugestoes.map((e) => (
                            <li key={e.id}>
                              <button
                                type="button"
                                onMouseDown={(ev) => {
                                  ev.preventDefault();
                                  setHelpEmpresa(e.id);
                                  setHelpEmpresaBusca(e.nome);
                                  setHelpDropdownAberto(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition ${
                                  helpEmpresa === e.id ? 'bg-slate-100 font-medium' : ''
                                }`}
                              >
                                {e.nome}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {helpDropdownAberto && helpEmpresaBusca.trim() && helpSugestoes.length === 0 && (
                        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg px-3 py-2 text-sm text-slate-500">
                          Nenhuma empresa encontrada.
                        </div>
                      )}
                    </div>
                    {helpEmpresa && (
                      <p className="mt-1 text-[11px] text-emerald-700">
                        ✓ Empresa selecionada
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Mensagem
                    </label>
                    <textarea
                      value={helpMensagem}
                      onChange={(e) => setHelpMensagem(e.target.value)}
                      required
                      rows={4}
                      placeholder="Descreva sua dúvida ou o que precisa de ajuda..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={enviandoHelp || !helpEmpresa || !helpMensagem.trim()}
                      className="text-sm font-bold tracking-wider px-6 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition"
                    >
                      {enviandoHelp ? 'Enviando...' : 'HELP'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="mb-8">
                <header className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    Em aberto
                  </h2>
                  <p className="text-xs text-slate-500">{helpsAbertos.length}</p>
                </header>
                {helpsAbertos.length === 0 ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-md p-5 text-center">
                    <p className="text-sm text-emerald-800">Nenhum pedido em aberto.</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {helpsAbertos.map((p) => {
                      const empresa = empresasPorId[p.empresa_id];
                      return (
                        <li key={p.id} className="bg-white border border-slate-200 rounded-md p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">
                                {empresa?.nome || '—'}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Criado em {new Date(p.created_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${
                                p.status === 'visualizado'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {p.status === 'visualizado'
                                ? `Visualizado em ${p.visualizado_em ? new Date(p.visualizado_em).toLocaleDateString('pt-BR') : '—'}`
                                : 'Aguardando'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{p.mensagem}</p>
                          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                            <button
                              onClick={() => handleResolverPropio(p.id)}
                              className="text-xs font-medium px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                            >
                              Resolvi sozinho
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {helpsResolvidos.length > 0 && (
                <section>
                  <header className="mb-3">
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                      Resolvidos recentes
                    </h2>
                  </header>
                  <ul className="space-y-3">
                    {helpsResolvidos.slice(0, 10).map((p) => {
                      const empresa = empresasPorId[p.empresa_id];
                      return (
                        <li key={p.id} className="bg-white border border-slate-200 rounded-md p-4 opacity-80">
                          <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-700">
                                {empresa?.nome || '—'}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {p.resolvido_em && `Resolvido em ${new Date(p.resolvido_em).toLocaleString('pt-BR')}`}
                                {p.resolvido_por_tipo === 'analista' && ' (por você)'}
                                {p.resolvido_por_tipo === 'coordenador' && ` (pela coordenação)`}
                              </p>
                            </div>
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border bg-emerald-50 text-emerald-800 border-emerald-300">
                              Resolvido
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 whitespace-pre-wrap">{p.mensagem}</p>
                          {p.solucao && (
                            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                                Resposta da coordenação
                              </p>
                              <p className="text-sm text-emerald-900 whitespace-pre-wrap">{p.solucao}</p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </>
          )}

          {aba === 'empresas' && (
            <>
              <div className="mb-8 border-b border-slate-200 pb-6">
                <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  Carteira de Clientes
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                  Empresas sob sua responsabilidade
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {empresas.length} {empresas.length === 1 ? 'empresa' : 'empresas'}
                  {totalNaoEnvia > 0 && ` · ${totalNaoEnvia} marcada${totalNaoEnvia === 1 ? '' : 's'} como "não envia extratos"`}
                  {' · '}Competência: {COMPETENCIA_ATUAL}.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <button
                  onClick={() => setFiltroBalanco(filtroBalanco === 'nao_iniciado' ? 'todos' : 'nao_iniciado')}
                  className={`bg-white border rounded-md p-4 text-left transition ${
                    filtroBalanco === 'nao_iniciado' ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Não iniciado</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-700">{contagens.nao_iniciado}</p>
                </button>
                <button
                  onClick={() => setFiltroBalanco(filtroBalanco === 'em_andamento' ? 'todos' : 'em_andamento')}
                  className={`bg-white border rounded-md p-4 text-left transition ${
                    filtroBalanco === 'em_andamento' ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Em andamento</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-700">{contagens.em_andamento}</p>
                </button>
                <button
                  onClick={() => setFiltroBalanco(filtroBalanco === 'concluido' ? 'todos' : 'concluido')}
                  className={`bg-white border rounded-md p-4 text-left transition ${
                    filtroBalanco === 'concluido' ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Concluído</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-700">{contagens.concluido}</p>
                </button>
                <button
                  onClick={() => setFiltroBalanco(filtroBalanco === 'atrasado' ? 'todos' : 'atrasado')}
                  className={`bg-white border rounded-md p-4 text-left transition ${
                    filtroBalanco === 'atrasado' ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Atrasado</p>
                  <p className="mt-2 text-2xl font-semibold text-red-700">{contagens.atrasado}</p>
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-md shadow-sm">
                <div className="p-4 border-b border-slate-200 grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
                      />
                    </svg>
                    <input
                      type="text"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Pesquisar por nome ou e-mail da empresa..."
                      className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                    />
                  </div>
                  <select
                    value={filtroEnvio}
                    onChange={(e) => setFiltroEnvio(e.target.value as FiltroEnvio)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                  >
                    <option value="todas">Todas as empresas</option>
                    <option value="regulares">Apenas regulares</option>
                    <option value="nao_envia">Apenas "não envia extratos"</option>
                  </select>
                </div>

                {empresasFiltradas.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-sm text-slate-500">Nenhuma empresa encontrada.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-600">
                            Empresa
                          </th>
                          <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-600">
                            Situação
                          </th>
                          <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-600">
                            Ação
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {empresasFiltradas.map((empresa, idx) => {
                          const statusBal = statusBalancoDaEmpresa(empresa.id);
                          return (
                            <tr
                              key={empresa.id}
                              className={`border-b border-slate-100 hover:bg-slate-50 ${
                                idx === empresasFiltradas.length - 1 ? 'border-b-0' : ''
                              }`}
                            >
                              <td className="px-4 py-3 text-slate-900 font-medium">
                                {empresa.nome}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${STATUS_CLASS[statusBal]}`}
                                  >
                                    {STATUS_LABEL[statusBal]}
                                  </span>
                                  {empresa.status === 'suspensa' && (
                                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border bg-amber-50 text-amber-800 border-amber-300">
                                      Suspensa
                                    </span>
                                  )}
                                  {empresa.nao_envia_extratos && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border bg-amber-50 text-amber-800 border-amber-300">
                                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V3m0 0l13 4-13 5" />
                                      </svg>
                                      Não envia extratos
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Link
                                  href={`/empresa/${empresa.id}`}
                                  className="inline-block text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-400 rounded px-3 py-1.5 transition"
                                >
                                  Abrir
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {aba === 'extratos' && (
            <>
              <div className="mb-6 border-b border-slate-200 pb-6">
                <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  Controle de extratos
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                  Registrar e acompanhar extratos
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Cobre solicitações e atualize status direto na lista, sem precisar abrir cada empresa.
                </p>
              </div>

              {/* Seletor de competência */}
              <div className="mb-6 bg-white border border-slate-200 rounded-md">
                <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Ano
                    </label>
                    <select
                      value={extrAno}
                      onChange={(e) => setExtrAno(e.target.value)}
                      className="px-2.5 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                    >
                      {Array.from({ length: 5 }, (_, i) => String(hoje.getFullYear() - 2 + i)).map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-slate-500">
                    Competência: <strong className="text-slate-900">{extrCompetencia}</strong>
                  </p>
                </div>
                <div className="px-2 py-2 flex flex-wrap gap-1">
                  {MESES.map((m) => {
                    const ativo = extrMes === m.num;
                    return (
                      <button
                        key={m.num}
                        onClick={() => setExtrMes(m.num)}
                        className={`flex-1 min-w-[58px] px-3 py-2 text-xs font-medium rounded transition ${
                          ativo
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filtros */}
              <div className="bg-white border border-slate-200 rounded-md shadow-sm">
                <div className="p-4 border-b border-slate-200 grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                    </svg>
                    <input
                      type="text"
                      value={extrBusca}
                      onChange={(e) => setExtrBusca(e.target.value)}
                      placeholder="Pesquisar empresa..."
                      className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                  <select
                    value={extrFiltro}
                    onChange={(e) => setExtrFiltro(e.target.value as FiltroExtrato)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                  >
                    <option value="todos">Todos os status</option>
                    <option value="pendentes">Pendentes (0 recebidos)</option>
                    <option value="parciais">Parciais (recebimento incompleto)</option>
                    <option value="completos">Completos (todos recebidos)</option>
                  </select>
                </div>

                {(() => {
                  const termo = extrBusca.trim().toLowerCase();
                  const empresasFiltradasExt = empresas.filter((emp) => {
                    if (emp.nao_envia_extratos) return false;
                    if (emp.status === 'baixada') return false;
                    if (termo && !emp.nome.toLowerCase().includes(termo)) return false;
                    const s = statusGeralEmpresa(emp.id);
                    if (s.classe === 'sem_bancos') return extrFiltro === 'todos';
                    if (extrFiltro === 'pendentes' && s.recebidos !== 0) return false;
                    if (extrFiltro === 'parciais' && s.classe !== 'parcial') return false;
                    if (extrFiltro === 'completos' && s.classe !== 'completo') return false;
                    return true;
                  });

                  if (empresasFiltradasExt.length === 0) {
                    return (
                      <div className="p-10 text-center">
                        <p className="text-sm text-slate-500">Nenhuma empresa encontrada para o filtro.</p>
                      </div>
                    );
                  }

                  return (
                    <ul className="divide-y divide-slate-100">
                      {empresasFiltradasExt.map((emp) => {
                        const bs = bancosPorEmpresa[emp.id] || [];
                        const pendentes = bs.filter((b) => {
                          const e = extratoPorBanco[b.id];
                          return !e || (e.status !== 'recebido' && e.status !== 'importado');
                        });
                        const statusesDistintos = new Set(
                          bs.map((b) => extratoPorBanco[b.id]?.status || 'pendente')
                        );
                        const statusUnico = statusesDistintos.size === 1
                          ? (Array.from(statusesDistintos)[0] as StatusExtrato)
                          : null;
                        return (
                          <li key={emp.id} className="px-4 py-3 hover:bg-slate-50">
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_140px] gap-3 items-center">
                              {/* Coluna empresa + bancos em itálico */}
                              <div className="min-w-0">
                                <Link
                                  href={`/empresa/${emp.id}/extratos`}
                                  className="text-sm font-semibold text-slate-900 hover:underline"
                                >
                                  {emp.nome}
                                </Link>
                                {emp.status === 'suspensa' && (
                                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border bg-amber-50 text-amber-800 border-amber-300 align-middle">
                                    Suspensa
                                  </span>
                                )}
                                {bs.length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic mt-0.5">
                                    Sem bancos cadastrados
                                  </p>
                                ) : (
                                  <div className="mt-0.5 space-y-0.5">
                                    <p className="text-[11px] text-slate-500 italic truncate">
                                      <span className="text-slate-400">Bancos:</span>{' '}
                                      {bs.map((b) => b.nome_banco).join(', ')}
                                    </p>
                                    {pendentes.length > 0 ? (
                                      <p className="text-[11px] text-amber-700 italic truncate">
                                        <span className="text-amber-600">Pendentes:</span>{' '}
                                        {pendentes.map((b) => b.nome_banco).join(', ')}
                                      </p>
                                    ) : (
                                      <p className="text-[11px] text-emerald-700 italic">
                                        Todos os extratos recebidos
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Dropdown de status rápido */}
                              <div>
                                {bs.length > 0 ? (
                                  <select
                                    value={statusUnico || ''}
                                    onChange={(ev) => handleAplicarStatusEmTodos(emp.id, ev.target.value as StatusExtrato)}
                                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                                    title="Aplica o status escolhido a todos os bancos"
                                  >
                                    <option value="" disabled>
                                      {statusUnico ? STATUS_EXT_LABEL[statusUnico] : 'Vários status'}
                                    </option>
                                    <option value="pendente">Marcar todos: Pendente</option>
                                    <option value="solicitado">Marcar todos: Solicitado</option>
                                    <option value="recebido">Marcar todos: Recebido</option>
                                    <option value="importado">Marcar todos: Importado</option>
                                  </select>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">—</span>
                                )}
                              </div>

                              {/* Botão de solicitação */}
                              <div className="text-right">
                                {pendentes.length > 0 ? (
                                  <button
                                    onClick={() => handleCobrarTodosDaEmpresa(emp.id)}
                                    className="text-xs font-medium px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 transition w-full"
                                    title="Registra cobrança em todos os bancos pendentes"
                                  >
                                    + Cobrar ({pendentes.length})
                                  </button>
                                ) : bs.length > 0 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border bg-emerald-50 text-emerald-800 border-emerald-300">
                                    Concluído
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">—</span>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
