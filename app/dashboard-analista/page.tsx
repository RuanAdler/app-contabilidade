'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Empresa, ProgressoChecklist, TarefaEmpresa, PedidoHelp, BancoEmpresa, SolicitacaoExtrato } from '@/lib/types';

type FiltroEnvio = 'todas' | 'regulares' | 'nao_envia';
type FiltroBalanco = 'todos' | 'nao_iniciado' | 'em_andamento' | 'concluido' | 'atrasado';
type StatusBalanco = 'nao_iniciado' | 'em_andamento' | 'concluido' | 'atrasado';
type StatusExtrato = 'pendente' | 'solicitado' | 'recebido' | 'importado';
type FiltroExtrato = 'todos' | 'pendente' | 'solicitado' | 'recebido' | 'importado';
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

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-sm text-slate-500">Carregando...</p></div>}>
      <DashboardAnalista />
    </Suspense>
  );
}

function DashboardAnalista() {
  const [usuario, setUsuario] = useState<any>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [checklistMes, setChecklistMes] = useState<ProgressoChecklist[]>([]);
  const [checklistAno, setChecklistAno] = useState<ProgressoChecklist[]>([]);
  const [tarefasMes, setTarefasMes] = useState<TarefaEmpresa[]>([]);
  const [totalEtapas, setTotalEtapas] = useState(0);
  const [busca, setBusca] = useState('');
  const [filtroEnvio, setFiltroEnvio] = useState<FiltroEnvio>('todas');
  const [filtroBalanco, setFiltroBalanco] = useState<FiltroBalanco>('todos');
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const abaInicial = (searchParams.get('aba') as Aba) || 'empresas';
  const [aba, setAbaState] = useState<Aba>(abaInicial);

  useEffect(() => {
    const fromUrl = searchParams.get('aba') as Aba | null;
    if (fromUrl && fromUrl !== aba) {
      setAbaState(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setAba = (nova: Aba) => {
    setAbaState(nova);
    const params = new URLSearchParams(searchParams.toString());
    params.set('aba', nova);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const [sidebarFixa, setSidebarFixa] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const sidebarAberta = sidebarFixa || sidebarHover;
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
  const [empresasExpandidas, setEmpresasExpandidas] = useState<Set<string>>(new Set());

  const toggleExpandirEmpresa = (id: string) => {
    setEmpresasExpandidas((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };
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
          const anoAtual = hoje.getFullYear();
          const [{ data: checklistAnoData }, { data: tarefas }, { count }] = await Promise.all([
            supabase
              .from('progresso_checklist')
              .select('*')
              .in('empresa_id', ids)
              .like('competencia', `${anoAtual}-%`),
            supabase
              .from('tarefas_empresa')
              .select('*')
              .in('empresa_id', ids)
              .eq('competencia', COMPETENCIA_ATUAL),
            supabase
              .from('etapas_checklist')
              .select('*', { count: 'exact', head: true }),
          ]);
          const todoAno = checklistAnoData || [];
          setChecklistAno(todoAno);
          setChecklistMes(todoAno.filter((c) => c.competencia === COMPETENCIA_ATUAL));
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

  // Status agregado considerando o "pior" status entre todos os bancos
  // pendente < solicitado < recebido < importado
  const RANK_STATUS: Record<StatusExtrato, number> = {
    pendente: 0,
    solicitado: 1,
    recebido: 2,
    importado: 3,
  };
  const piorStatusEmpresa = (empresaId: string): StatusExtrato | null => {
    const bs = bancosPorEmpresa[empresaId] || [];
    if (bs.length === 0) return null;
    let pior: StatusExtrato = 'importado';
    for (const b of bs) {
      const st = (extratoPorBanco[b.id]?.status || 'pendente') as StatusExtrato;
      if (RANK_STATUS[st] < RANK_STATUS[pior]) pior = st;
    }
    return pior;
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

  type StatusMes = 'nao_iniciado' | 'em_andamento' | 'concluido';
  const statusDoMes = (empresaId: string, competencia: string): StatusMes => {
    if (totalEtapas === 0) return 'nao_iniciado';
    const feitos = checklistAno.filter(
      (c) => c.empresa_id === empresaId && c.competencia === competencia && c.feito_em
    ).length;
    if (feitos === 0) return 'nao_iniciado';
    if (feitos >= totalEtapas) return 'concluido';
    return 'em_andamento';
  };

  const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const anoAtual = hoje.getFullYear();
  const mesAtualNum = hoje.getMonth() + 1;

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
        <div
          className="relative w-14 shrink-0"
          onMouseEnter={() => setSidebarHover(true)}
          onMouseLeave={() => setSidebarHover(false)}
        >
        <aside
          className={`absolute inset-y-0 left-0 bg-white border-r border-slate-200 transition-all duration-200 flex flex-col z-20 ${
            sidebarAberta ? 'w-56 shadow-lg' : 'w-14'
          }`}
        >
          <div className="h-12 flex items-center justify-end px-2 border-b border-slate-200">
            <button
              onClick={() => setSidebarFixa(!sidebarFixa)}
              className="h-8 w-8 inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
              title={sidebarFixa ? 'Liberar menu (passar mouse pra abrir)' : 'Fixar menu aberto'}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {sidebarFixa ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5h14M5 19h14M5 12h14" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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
        </div>

        <main className="flex-1 px-6 py-8 min-w-0">
          {aba === 'pendencias' && (
            <>
              <div className="mb-8 border-b border-slate-200 pb-6">
                <p className="label-tiny">
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
                  <p className="label-tiny">
                    Atrasadas
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-red-700">
                    {tarefasAtrasadas.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="label-tiny">
                    Para hoje
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-amber-700">
                    {tarefasParaHoje.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="label-tiny">
                    Próximos 7 dias
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-700">
                    {tarefasProximas.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="label-tiny">
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
                <p className="label-tiny">
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
                <p className="label-tiny">
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
                  <p className="label-tiny">Não iniciado</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-700">{contagens.nao_iniciado}</p>
                </button>
                <button
                  onClick={() => setFiltroBalanco(filtroBalanco === 'em_andamento' ? 'todos' : 'em_andamento')}
                  className={`bg-white border rounded-md p-4 text-left transition ${
                    filtroBalanco === 'em_andamento' ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <p className="label-tiny">Em andamento</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-700">{contagens.em_andamento}</p>
                </button>
                <button
                  onClick={() => setFiltroBalanco(filtroBalanco === 'concluido' ? 'todos' : 'concluido')}
                  className={`bg-white border rounded-md p-4 text-left transition ${
                    filtroBalanco === 'concluido' ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <p className="label-tiny">Concluído</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-700">{contagens.concluido}</p>
                </button>
                <button
                  onClick={() => setFiltroBalanco(filtroBalanco === 'atrasado' ? 'todos' : 'atrasado')}
                  className={`bg-white border rounded-md p-4 text-left transition ${
                    filtroBalanco === 'atrasado' ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <p className="label-tiny">Atrasado</p>
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
                            <div className="flex items-center gap-3 flex-wrap">
                              <span>{anoAtual}</span>
                              <span className="font-normal normal-case text-[10px] text-slate-400 flex items-center gap-2">
                                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />concluído</span>
                                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-amber-400" />em andamento</span>
                                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-slate-200" />não iniciado</span>
                              </span>
                            </div>
                          </th>
                          <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-600">
                            Ação
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {empresasFiltradas.map((empresa, idx) => {
                          return (
                            <tr
                              key={empresa.id}
                              className={`border-b border-slate-100 hover:bg-slate-50 ${
                                idx === empresasFiltradas.length - 1 ? 'border-b-0' : ''
                              }`}
                            >
                              <td className="px-4 py-3">
                                <p className="text-slate-900 font-medium">{empresa.nome}</p>
                                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                  {empresa.status === 'suspensa' && (
                                    <span className="inline-flex items-center px-1.5 py-0 text-[10px] font-medium rounded border bg-amber-50 text-amber-800 border-amber-300">
                                      Suspensa
                                    </span>
                                  )}
                                  {empresa.nao_envia_extratos && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0 text-[10px] font-medium rounded border bg-amber-50 text-amber-800 border-amber-300">
                                      ⚑ Não envia extratos
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: 12 }, (_, i) => {
                                    const numMes = i + 1;
                                    const competencia = `${anoAtual}-${String(numMes).padStart(2, '0')}`;
                                    const status = statusDoMes(empresa.id, competencia);
                                    const ehAtual = numMes === mesAtualNum;
                                    const ehFuturo = numMes > mesAtualNum;
                                    const cor =
                                      ehFuturo
                                        ? 'bg-slate-100 text-slate-400'
                                        : status === 'concluido'
                                        ? 'bg-emerald-500 text-white'
                                        : status === 'em_andamento'
                                        ? 'bg-amber-400 text-white'
                                        : 'bg-slate-200 text-slate-600';
                                    const feitos = checklistAno.filter(
                                      (c) => c.empresa_id === empresa.id && c.competencia === competencia && c.feito_em
                                    ).length;
                                    return (
                                      <div key={i} className="flex flex-col items-center gap-0.5">
                                        <div
                                          title={`${MESES_NOMES[i]}/${anoAtual}: ${ehFuturo ? '—' : status === 'concluido' ? 'Concluído' : status === 'em_andamento' ? `Em andamento (${feitos}/${totalEtapas})` : 'Não iniciado'}`}
                                          className={`h-5 w-5 rounded-sm flex items-center justify-center text-[10px] font-semibold tabular-nums ${cor}`}
                                        >
                                          {numMes}
                                        </div>
                                        {ehAtual && (
                                          <div className="h-0.5 w-5 rounded-full bg-slate-900" />
                                        )}
                                      </div>
                                    );
                                  })}
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
                <p className="label-tiny">
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

              {/* Cards de stats — clicáveis para filtrar */}
              {(() => {
                const elegives = empresas.filter((e) => !e.nao_envia_extratos && e.status !== 'baixada');
                const contagens = { pendente: 0, solicitado: 0, recebido: 0, importado: 0 };
                for (const emp of elegives) {
                  const pior = piorStatusEmpresa(emp.id);
                  if (pior) contagens[pior]++;
                }
                const cards: { id: FiltroExtrato; label: string; valor: number; cor: string; corAtivo: string }[] = [
                  { id: 'pendente', label: 'Pendentes', valor: contagens.pendente, cor: 'border-slate-300 hover:border-slate-400', corAtivo: 'border-slate-900 ring-1 ring-slate-900' },
                  { id: 'solicitado', label: 'Solicitados', valor: contagens.solicitado, cor: 'border-amber-200 hover:border-amber-300', corAtivo: 'border-amber-500 ring-1 ring-amber-400 bg-amber-50' },
                  { id: 'recebido', label: 'Recebidos (aguardando importação)', valor: contagens.recebido, cor: 'border-emerald-200 hover:border-emerald-300', corAtivo: 'border-emerald-500 ring-1 ring-emerald-400 bg-emerald-50' },
                  { id: 'importado', label: 'Importados', valor: contagens.importado, cor: 'border-slate-800 hover:border-slate-900', corAtivo: 'border-slate-900 ring-1 ring-slate-900 bg-slate-900 text-white' },
                ];
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {cards.map((c) => {
                      const ativo = extrFiltro === c.id;
                      const isImportadoAtivo = c.id === 'importado' && ativo;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setExtrFiltro(ativo ? 'todos' : c.id)}
                          className={`bg-white rounded-md p-3 text-left border transition ${
                            ativo ? c.corAtivo : c.cor
                          }`}
                        >
                          <p className={`text-[11px] font-semibold uppercase tracking-wider ${isImportadoAtivo ? 'text-slate-200' : 'text-slate-500'}`}>
                            {c.label}
                          </p>
                          <p className={`mt-1 text-2xl font-semibold tabular-nums ${isImportadoAtivo ? 'text-white' : 'text-slate-900'}`}>
                            {c.valor}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

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
                  <button
                    onClick={() => setExtrFiltro('todos')}
                    className={`w-full px-3 py-2 text-sm border rounded-md transition ${
                      extrFiltro === 'todos'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Ver todas
                  </button>
                </div>

                {(() => {
                  const termo = extrBusca.trim().toLowerCase();
                  const empresasFiltradasExt = empresas.filter((emp) => {
                    if (emp.nao_envia_extratos) return false;
                    if (emp.status === 'baixada') return false;
                    if (termo && !emp.nome.toLowerCase().includes(termo)) return false;
                    if (extrFiltro === 'todos') return true;
                    const pior = piorStatusEmpresa(emp.id);
                    if (!pior) return false;
                    return pior === extrFiltro;
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
                        const expandida = empresasExpandidas.has(emp.id);
                        return (
                          <li key={emp.id} className={expandida ? 'bg-slate-50/50' : 'hover:bg-slate-50'}>
                            {/* Linha compacta */}
                            <div className="px-4 py-2.5 grid grid-cols-[1fr_auto_140px_28px] gap-3 items-center">
                              {/* Nome + chips de banco */}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Link
                                    href={`/empresa/${emp.id}/extratos`}
                                    className="text-sm font-semibold text-slate-900 hover:underline truncate"
                                  >
                                    {emp.nome}
                                  </Link>
                                  {emp.status === 'suspensa' && (
                                    <span className="inline-flex items-center px-1.5 py-0 text-[10px] font-medium rounded border bg-amber-50 text-amber-800 border-amber-300">
                                      Suspensa
                                    </span>
                                  )}
                                </div>
                                {bs.length > 0 && (
                                  <div className="mt-1 flex items-center gap-1 flex-wrap">
                                    {bs.map((b) => {
                                      const e = extratoPorBanco[b.id];
                                      const st = (e?.status || 'pendente') as StatusExtrato;
                                      const cor =
                                        st === 'importado'
                                          ? 'bg-slate-900'
                                          : st === 'recebido'
                                          ? 'bg-emerald-500'
                                          : st === 'solicitado'
                                          ? 'bg-amber-400'
                                          : 'bg-slate-300';
                                      return (
                                        <span
                                          key={b.id}
                                          title={`${b.nome_banco}: ${STATUS_EXT_LABEL[st]}${e?.qtd_solicitacoes ? ` · ${e.qtd_solicitacoes}× cobrado` : ''}`}
                                          className={`inline-block h-2.5 w-2.5 rounded-sm ${cor}`}
                                        />
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Resumo curto */}
                              <div className="text-[11px] text-slate-500 whitespace-nowrap">
                                {bs.length === 0
                                  ? <span className="italic text-slate-400">Sem bancos</span>
                                  : (
                                    <>
                                      {bs.length} {bs.length === 1 ? 'banco' : 'bancos'}
                                      {pendentes.length > 0 && (
                                        <> · <span className="text-amber-700 font-medium">{pendentes.length} pend.</span></>
                                      )}
                                    </>
                                  )}
                              </div>

                              {/* Ação principal — minimalista */}
                              <div className="text-right">
                                {bs.length === 0 ? (
                                  <Link
                                    href={`/empresa/${emp.id}/extratos`}
                                    className="inline-flex items-center justify-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded border border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-800 transition w-full"
                                  >
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Cadastrar
                                  </Link>
                                ) : pendentes.length > 0 ? (
                                  <button
                                    onClick={() => handleCobrarTodosDaEmpresa(emp.id)}
                                    className="inline-flex items-center justify-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 transition w-full"
                                    title="Registra cobrança em todos os bancos pendentes"
                                  >
                                    Cobrar ({pendentes.length})
                                  </button>
                                ) : (() => {
                                  const pior = piorStatusEmpresa(emp.id);
                                  if (pior === 'importado') {
                                    return (
                                      <span className="inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-medium rounded bg-slate-900 text-white w-full">
                                        ✓ Importado
                                      </span>
                                    );
                                  }
                                  // pior === 'recebido' (todos recebidos, falta importar)
                                  return (
                                    <span className="inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-medium rounded border border-emerald-300 text-emerald-800 bg-emerald-50 w-full">
                                      ✓ Recebido
                                    </span>
                                  );
                                })()}
                              </div>

                              {/* Toggle expandir */}
                              <button
                                onClick={() => toggleExpandirEmpresa(emp.id)}
                                disabled={bs.length === 0}
                                title={expandida ? 'Ocultar bancos' : 'Ver bancos'}
                                className="h-7 w-7 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                              >
                                <svg
                                  className={`h-4 w-4 transition-transform ${expandida ? 'rotate-90' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </div>

                            {/* Bancos expandidos */}
                            {expandida && bs.length > 0 && (
                              <div className="px-4 pb-3 pt-1">
                                <div className="rounded border border-slate-200 bg-white overflow-hidden">
                                  {bs.map((b, idx) => {
                                    const e = extratoPorBanco[b.id];
                                    const st = (e?.status || 'pendente') as StatusExtrato;
                                    const recebido = st === 'recebido' || st === 'importado';
                                    const qtd = e?.qtd_solicitacoes || 0;
                                    return (
                                      <div
                                        key={b.id}
                                        className={`grid grid-cols-[1fr_140px_140px_auto] gap-3 items-center px-3 py-2 text-sm ${
                                          idx < bs.length - 1 ? 'border-b border-slate-100' : ''
                                        }`}
                                      >
                                        <span className="text-slate-700 font-medium truncate">{b.nome_banco}</span>
                                        <select
                                          value={st}
                                          onChange={(ev) => handleStatusExtrato(b.id, ev.target.value as StatusExtrato)}
                                          className="px-2 py-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                                        >
                                          <option value="pendente">Pendente</option>
                                          <option value="solicitado">Solicitado</option>
                                          <option value="recebido">Recebido</option>
                                          <option value="importado">Importado</option>
                                        </select>
                                        <span className="text-[11px] text-slate-500">
                                          {qtd > 0 ? (
                                            <>
                                              cobrado <strong className="text-slate-700">{qtd}×</strong>
                                              {e?.ultima_solicitacao_em && (
                                                <> · {new Date(e.ultima_solicitacao_em).toLocaleDateString('pt-BR')}</>
                                              )}
                                            </>
                                          ) : (
                                            <span className="italic">sem cobranças</span>
                                          )}
                                        </span>
                                        <button
                                          onClick={() => handleRegistrarCobranca(b.id)}
                                          disabled={recebido}
                                          title={recebido ? 'Já recebido' : 'Registrar cobrança'}
                                          className="text-[11px] font-medium px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-700 disabled:hover:border-slate-300 transition whitespace-nowrap"
                                        >
                                          {recebido ? '✓' : '+ Cobrar'}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
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
