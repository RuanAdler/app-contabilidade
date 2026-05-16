'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Empresa, Analista, BancoEmpresa, SolicitacaoExtrato, ProgressoChecklist, StatusEmpresa } from '@/lib/types';

type EmpresaComAnalista = Empresa & { analista_nome: string };
type FiltroEnvio = 'todas' | 'regulares' | 'nao_envia';
type FiltroStatus = 'todos' | StatusEmpresa;
type StatusMes = 'sem_bancos' | 'concluido' | 'parcial' | 'pendente';
type Aba = 'visao' | 'controle' | 'desempenho';

const CORES_ANALISTAS = ['#0f766e', '#b45309', '#7c3aed', '#be123c', '#0369a1'];

function competenciasAnteriores(qtd: number): string[] {
  const lista: string[] = [];
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  for (let i = qtd - 1; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    lista.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  }
  return lista;
}

function labelCurtoMes(competencia: string): string {
  const [ano, mes] = competencia.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[parseInt(mes) - 1]}/${ano.slice(2)}`;
}

const hoje = new Date();
const COMPETENCIA_ATUAL = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
const NOME_MES = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

const STATUS_LABEL: Record<StatusEmpresa, string> = {
  ativa: 'Ativa',
  baixada: 'Baixada',
  suspensa: 'Suspensa',
};

const STATUS_BADGE: Record<StatusEmpresa, string> = {
  ativa: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  baixada: 'bg-slate-100 text-slate-600 border-slate-300',
  suspensa: 'bg-amber-50 text-amber-800 border-amber-300',
};

export default function DashboardCoordenador() {
  const [usuario, setUsuario] = useState<any>(null);
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaComAnalista[]>([]);
  const [bancos, setBancos] = useState<BancoEmpresa[]>([]);
  const [extratos, setExtratos] = useState<SolicitacaoExtrato[]>([]);
  const [extratos6m, setExtratos6m] = useState<SolicitacaoExtrato[]>([]);
  const [checklistMes, setChecklistMes] = useState<ProgressoChecklist[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroAnalista, setFiltroAnalista] = useState<string>('todos');
  const [filtroEnvio, setFiltroEnvio] = useState<FiltroEnvio>('todas');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>('visao');
  const [sidebarAberta, setSidebarAberta] = useState(true);
  const [analistaDetalhado, setAnalistaDetalhado] = useState<string | null>(null);

  // Modal de adicionar empresa
  const [modalAberto, setModalAberto] = useState(false);
  const [novaEmpNome, setNovaEmpNome] = useState('');
  const [novaEmpEmail, setNovaEmpEmail] = useState('');
  const [novaEmpAnalista, setNovaEmpAnalista] = useState('');
  const [salvandoNova, setSalvandoNova] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const { data: userData } = await supabase
        .from('analistas')
        .select('cargo')
        .eq('email', session.user.email)
        .single();

      if (userData?.cargo !== 'coordenador') {
        router.push('/dashboard-analista');
        return;
      }

      setUsuario(session.user);

      const { data: analistasData } = await supabase
        .from('analistas')
        .select('*')
        .eq('cargo', 'analista')
        .order('nome');

      const listaAnalistas = analistasData || [];
      setAnalistas(listaAnalistas);
      if (listaAnalistas[0]) setNovaEmpAnalista(listaAnalistas[0].id);

      const mapaAnalistas: Record<string, string> = {};
      listaAnalistas.forEach((a) => {
        mapaAnalistas[a.id] = a.nome;
      });

      const { data: empresasData } = await supabase
        .from('empresas')
        .select('*')
        .order('nome');

      const empresasEnriquecidas: EmpresaComAnalista[] = (empresasData || []).map((e) => ({
        ...e,
        analista_nome: mapaAnalistas[e.analista_id] || '—',
      }));

      setEmpresas(empresasEnriquecidas);

      const { data: bancosData } = await supabase
        .from('bancos_empresa')
        .select('*');
      const listaBancos = bancosData || [];
      setBancos(listaBancos);

      const competencias6m = competenciasAnteriores(6);

      if (listaBancos.length > 0) {
        const bancosIds = listaBancos.map((b) => b.id);
        const { data: extratosData } = await supabase
          .from('solicitacoes_extrato')
          .select('*')
          .in('banco_id', bancosIds)
          .in('competencia', competencias6m);
        const todos = extratosData || [];
        setExtratos6m(todos);
        setExtratos(todos.filter((e) => e.competencia === COMPETENCIA_ATUAL));
      }

      const { data: checklistData } = await supabase
        .from('progresso_checklist')
        .select('*')
        .eq('competencia', COMPETENCIA_ATUAL);
      setChecklistMes(checklistData || []);

      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const mapaAnalistas = useMemo(() => {
    const m: Record<string, string> = {};
    analistas.forEach((a) => { m[a.id] = a.nome; });
    return m;
  }, [analistas]);

  // Apenas ativas para visão operacional
  const empresasAtivas = useMemo(
    () => empresas.filter((e) => e.status === 'ativa'),
    [empresas]
  );

  const bancosPorEmpresa = useMemo(() => {
    const map: Record<string, BancoEmpresa[]> = {};
    bancos.forEach((b) => {
      if (!map[b.empresa_id]) map[b.empresa_id] = [];
      map[b.empresa_id].push(b);
    });
    return map;
  }, [bancos]);

  const extratoPorBanco = useMemo(() => {
    const map: Record<string, SolicitacaoExtrato> = {};
    extratos.forEach((e) => {
      map[e.banco_id] = e;
    });
    return map;
  }, [extratos]);

  const statusMesDaEmpresa = (empresaId: string): StatusMes => {
    const bs = bancosPorEmpresa[empresaId] || [];
    if (bs.length === 0) return 'sem_bancos';
    let recebidos = 0;
    for (const b of bs) {
      const e = extratoPorBanco[b.id];
      if (e && (e.status === 'recebido' || e.status === 'importado')) recebidos++;
    }
    if (recebidos === bs.length) return 'concluido';
    if (recebidos === 0) return 'pendente';
    return 'parcial';
  };

  const statsPorAnalista = useMemo(() => {
    return analistas.map((a) => {
      const empresasDoAnalista = empresasAtivas.filter((e) => e.analista_id === a.id);
      const total = empresasDoAnalista.length;
      const naoEnvia = empresasDoAnalista.filter((e) => e.nao_envia_extratos).length;
      const elegives = empresasDoAnalista.filter((e) => !e.nao_envia_extratos);
      let concluidas = 0, parciais = 0, pendentes = 0, semBancos = 0;
      for (const emp of elegives) {
        const s = statusMesDaEmpresa(emp.id);
        if (s === 'concluido') concluidas++;
        else if (s === 'parcial') parciais++;
        else if (s === 'pendente') pendentes++;
        else semBancos++;
      }
      const baseElegivel = elegives.length - semBancos;
      const percentConcluido = baseElegivel > 0 ? Math.round((concluidas / baseElegivel) * 100) : 0;
      return { analista: a, total, naoEnvia, concluidas, parciais, pendentes, semBancos, percentConcluido };
    });
  }, [analistas, empresasAtivas, bancosPorEmpresa, extratoPorBanco]);

  const empresasAtencao = useMemo(() => {
    return empresasAtivas
      .map((emp) => {
        const bs = bancosPorEmpresa[emp.id] || [];
        let maxSolicitacoes = 0, bancosAbertos = 0;
        for (const b of bs) {
          const e = extratoPorBanco[b.id];
          if (e) {
            if ((e.qtd_solicitacoes || 0) > maxSolicitacoes) maxSolicitacoes = e.qtd_solicitacoes || 0;
            if (e.status !== 'recebido' && e.status !== 'importado') bancosAbertos++;
          } else {
            bancosAbertos++;
          }
        }
        const status = statusMesDaEmpresa(emp.id);
        let motivo = '', prioridade = 0;
        if (emp.nao_envia_extratos) {
          motivo = 'Marcada como "não envia extratos"';
          prioridade = 3;
        } else if (maxSolicitacoes >= 3 && bancosAbertos > 0) {
          motivo = `${maxSolicitacoes}× solicitado sem retorno`;
          prioridade = 4;
        } else if (status === 'parcial' && bs.length > 1) {
          motivo = `Envio parcial (${bs.length - bancosAbertos}/${bs.length})`;
          prioridade = 2;
        } else if (status === 'pendente' && maxSolicitacoes >= 2) {
          motivo = `${maxSolicitacoes}× solicitado, ainda pendente`;
          prioridade = 2;
        }
        return { empresa: emp, motivo, prioridade, maxSolicitacoes };
      })
      .filter((e) => e.prioridade > 0)
      .sort((a, b) => b.prioridade - a.prioridade || a.empresa.nome.localeCompare(b.empresa.nome));
  }, [empresasAtivas, bancosPorEmpresa, extratoPorBanco]);

  // Visão operacional (Visão geral) — só ativas
  const empresasFiltradasVisao = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return empresasAtivas.filter((e) => {
      const passaAnalista = filtroAnalista === 'todos' || e.analista_id === filtroAnalista;
      const passaBusca =
        !termo ||
        e.nome.toLowerCase().includes(termo) ||
        e.analista_nome.toLowerCase().includes(termo);
      const passaEnvio =
        filtroEnvio === 'todas' ||
        (filtroEnvio === 'regulares' && !e.nao_envia_extratos) ||
        (filtroEnvio === 'nao_envia' && e.nao_envia_extratos);
      return passaAnalista && passaBusca && passaEnvio;
    });
  }, [empresasAtivas, busca, filtroAnalista, filtroEnvio]);

  // Controle de empresas — todas, com filtro de status
  const empresasFiltradasControle = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return empresas.filter((e) => {
      const passaStatus = filtroStatus === 'todos' || e.status === filtroStatus;
      const passaAnalista = filtroAnalista === 'todos' || e.analista_id === filtroAnalista;
      const passaBusca =
        !termo ||
        e.nome.toLowerCase().includes(termo) ||
        e.analista_nome.toLowerCase().includes(termo);
      return passaStatus && passaAnalista && passaBusca;
    });
  }, [empresas, busca, filtroAnalista, filtroStatus]);

  // ====== Métricas para aba Desempenho ======
  const competencias6m = useMemo(() => competenciasAnteriores(6), []);

  // % extratos recebidos por (analista, competencia) — empresas ativas e regulares apenas
  const historicoExtratos = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}; // {analistaId: {competencia: percent}}
    analistas.forEach((a) => { map[a.id] = {}; });
    for (const a of analistas) {
      const elegives = empresasAtivas.filter((e) => e.analista_id === a.id && !e.nao_envia_extratos);
      for (const comp of competencias6m) {
        let totalCom = 0;
        let recebidasTodas = 0;
        for (const emp of elegives) {
          const bs = bancosPorEmpresa[emp.id] || [];
          if (bs.length === 0) continue;
          totalCom++;
          let recebidos = 0;
          for (const b of bs) {
            const e = extratos6m.find((x) => x.banco_id === b.id && x.competencia === comp);
            if (e && (e.status === 'recebido' || e.status === 'importado')) recebidos++;
          }
          if (recebidos === bs.length) recebidasTodas++;
        }
        map[a.id][comp] = totalCom > 0 ? Math.round((recebidasTodas / totalCom) * 100) : 0;
      }
    }
    return map;
  }, [analistas, empresasAtivas, bancosPorEmpresa, extratos6m, competencias6m]);

  // % balanços concluídos no mês (todas as etapas marcadas)
  const balancosPorAnalista = useMemo(() => {
    // checklistMes: array de progresso_checklist, sem etapas_checklist
    // total de etapas é fixo (10) - mas vou contar das entries
    const totalEtapasAprox = Math.max(...empresas.map(emp => {
      return checklistMes.filter((c) => c.empresa_id === emp.id).length;
    }).filter(n => n > 0), 10);

    const map: Record<string, { concluidos: number; total: number; percentual: number }> = {};
    for (const a of analistas) {
      const empresasA = empresasAtivas.filter((e) => e.analista_id === a.id);
      let concluidos = 0;
      let comProgresso = 0;
      for (const emp of empresasA) {
        const entries = checklistMes.filter((c) => c.empresa_id === emp.id);
        if (entries.length === 0) continue;
        comProgresso++;
        const feitos = entries.filter((c) => c.feito_em).length;
        if (feitos >= entries.length && entries.length >= totalEtapasAprox / 2) concluidos++;
      }
      map[a.id] = {
        concluidos,
        total: empresasA.length,
        percentual: empresasA.length > 0 ? Math.round((concluidos / empresasA.length) * 100) : 0,
      };
    }
    return map;
  }, [analistas, empresasAtivas, checklistMes, empresas]);

  // Total de solicitações registradas no mês por analista
  const solicitacoesPorAnalista = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of analistas) {
      const empresasA = empresasAtivas.filter((e) => e.analista_id === a.id);
      let total = 0;
      for (const emp of empresasA) {
        const bs = bancosPorEmpresa[emp.id] || [];
        for (const b of bs) {
          const e = extratoPorBanco[b.id];
          if (e) total += e.qtd_solicitacoes || 0;
        }
      }
      map[a.id] = total;
    }
    return map;
  }, [analistas, empresasAtivas, bancosPorEmpresa, extratoPorBanco]);

  // Empresas em atenção por analista
  const atencaoPorAnalista = useMemo(() => {
    const map: Record<string, EmpresaComAnalista[]> = {};
    for (const a of analistas) map[a.id] = [];
    for (const item of empresasAtencao) {
      map[item.empresa.analista_id]?.push(item.empresa);
    }
    return map;
  }, [analistas, empresasAtencao]);

  // Decisões pendentes: empresas ativas marcadas como não envia, mas com status ativa
  const decisoesPendentes = useMemo(() => {
    return empresas.filter(
      (e) => e.status === 'ativa' && e.nao_envia_extratos
    );
  }, [empresas]);

  const totalAtivas = empresasAtivas.length;
  const totalBaixadas = empresas.filter((e) => e.status === 'baixada').length;
  const totalSuspensas = empresas.filter((e) => e.status === 'suspensa').length;
  const totalNaoEnvia = empresasAtivas.filter((e) => e.nao_envia_extratos).length;

  // Handlers
  const atualizarEmpresa = async (id: string, patch: Partial<Empresa>) => {
    const { data } = await supabase
      .from('empresas')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (data) {
      setEmpresas((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, ...data, analista_nome: mapaAnalistas[data.analista_id] || '—' }
            : e
        )
      );
    }
  };

  const handleMudarStatus = (id: string, novoStatus: StatusEmpresa) => {
    atualizarEmpresa(id, { status: novoStatus });
  };

  const handleMudarAnalista = (id: string, novoAnalista: string) => {
    atualizarEmpresa(id, { analista_id: novoAnalista });
  };

  const handleExcluirEmpresa = async (id: string, nome: string) => {
    if (!confirm(`EXCLUIR PERMANENTEMENTE a empresa "${nome}"?\n\nIsso vai apagar todos os bancos, extratos e checklists associados. NÃO PODE SER DESFEITO.\n\nSe a empresa apenas saiu da contabilidade, prefira mudar o status para "Baixada" — assim o histórico é preservado.`)) return;
    if (!confirm(`Confirma a exclusão definitiva de "${nome}"?`)) return;
    const { error } = await supabase.from('empresas').delete().eq('id', id);
    if (error) {
      alert('Erro ao excluir: ' + error.message);
      return;
    }
    setEmpresas((prev) => prev.filter((e) => e.id !== id));
  };

  const handleAdicionarEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = novaEmpNome.trim();
    if (!nome || !novaEmpAnalista) return;
    setSalvandoNova(true);
    const { data, error } = await supabase
      .from('empresas')
      .insert({
        nome,
        analista_id: novaEmpAnalista,
        email_contato: novaEmpEmail.trim() || null,
        status: 'ativa',
      })
      .select()
      .single();
    setSalvandoNova(false);
    if (error) {
      alert('Erro ao adicionar: ' + error.message);
      return;
    }
    if (data) {
      const enriquecida: EmpresaComAnalista = {
        ...data,
        analista_nome: mapaAnalistas[data.analista_id] || '—',
      };
      setEmpresas((prev) => [...prev, enriquecida].sort((a, b) => a.nome.localeCompare(b.nome)));
    }
    setNovaEmpNome('');
    setNovaEmpEmail('');
    setModalAberto(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    );
  }

  const itensMenu: { id: Aba; label: string; icone: React.ReactNode }[] = [
    {
      id: 'visao',
      label: 'Visão geral',
      icone: (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'controle',
      label: 'Controle de empresas',
      icone: (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      id: 'desempenho',
      label: 'Desempenho da equipe',
      icone: (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                  onClick={() => { setAba(item.id); setBusca(''); setFiltroAnalista('todos'); setAnalistaDetalhado(null); }}
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
          {aba === 'visao' && (
            <>
              <div className="mb-8 border-b border-slate-200 pb-6">
                <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  Painel de Coordenação
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                  Visão consolidada da carteira
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Competência atual: <span className="capitalize">{NOME_MES}</span> · {totalAtivas} empresas ativas · {analistas.length} analistas.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Empresas ativas
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{totalAtivas}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Analistas ativos
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{analistas.length}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Média por analista
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {analistas.length > 0 ? Math.round(totalAtivas / analistas.length) : 0}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Não envia extratos
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-amber-700">{totalNaoEnvia}</p>
                </div>
              </div>

              <section className="mb-8">
                <header className="mb-3">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    Desempenho por analista
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Extratos recebidos na competência atual (excluindo empresas marcadas como não envia).
                  </p>
                </header>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {statsPorAnalista.map((s) => (
                    <div key={s.analista.id} className="bg-white border border-slate-200 rounded-md p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{s.analista.nome}</p>
                          <p className="text-xs text-slate-500">{s.total} empresas na carteira</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-semibold text-slate-900">{s.percentConcluido}%</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">recebidos</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full transition-all ${
                            s.percentConcluido >= 80 ? 'bg-emerald-500'
                            : s.percentConcluido >= 50 ? 'bg-amber-500'
                            : 'bg-red-500'
                          }`}
                          style={{ width: `${s.percentConcluido}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-sm font-semibold text-emerald-700">{s.concluidas}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Ok</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-amber-700">{s.parciais}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Parcial</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-red-700">{s.pendentes}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Pendente</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-500">{s.naoEnvia}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">N/Env.</p>
                        </div>
                      </div>
                      {s.semBancos > 0 && (
                        <p className="mt-3 text-[11px] text-slate-400">
                          {s.semBancos} sem bancos cadastrados.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="mb-8">
                <header className="mb-3 flex items-baseline justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                      Empresas que precisam de atenção
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Empresas com múltiplas cobranças, envios parciais ou marcadas como não envia.
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    {empresasAtencao.length} {empresasAtencao.length === 1 ? 'empresa' : 'empresas'}
                  </p>
                </header>
                {empresasAtencao.length === 0 ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-md px-5 py-6 text-center">
                    <p className="text-sm font-semibold text-emerald-800">Nada urgente no momento.</p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Empresa</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Analista</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Motivo</th>
                          <th className="px-4 py-2.5 w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {empresasAtencao.slice(0, 20).map((item, idx, arr) => (
                          <tr
                            key={item.empresa.id}
                            className={`border-b border-slate-100 hover:bg-slate-50 ${
                              idx === arr.length - 1 ? 'border-b-0' : ''
                            }`}
                          >
                            <td className="px-4 py-2.5 text-slate-900 font-medium">{item.empresa.nome}</td>
                            <td className="px-4 py-2.5 text-slate-600">{item.empresa.analista_nome}</td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${
                                  item.prioridade >= 3
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-slate-50 text-slate-700 border-slate-300'
                                }`}
                              >
                                {item.motivo}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <Link
                                href={`/empresa/${item.empresa.id}`}
                                className="text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-400 rounded px-2.5 py-1 transition"
                              >
                                Abrir
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {empresasAtencao.length > 20 && (
                      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">
                        Exibindo as 20 mais críticas de {empresasAtencao.length}.
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section>
                <header className="mb-3">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    Carteira ativa
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Empresas ativas. Para ver baixadas/suspensas, vá em "Controle de empresas".
                  </p>
                </header>
                <div className="bg-white border border-slate-200 rounded-md shadow-sm">
                  <div className="p-4 border-b border-slate-200 grid grid-cols-1 md:grid-cols-[1fr_200px_220px] gap-3">
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                      </svg>
                      <input
                        type="text"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Pesquisar por empresa ou analista..."
                        className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                      />
                    </div>
                    <select
                      value={filtroAnalista}
                      onChange={(e) => setFiltroAnalista(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                    >
                      <option value="todos">Todos os analistas</option>
                      {analistas.map((a) => (
                        <option key={a.id} value={a.id}>{a.nome}</option>
                      ))}
                    </select>
                    <select
                      value={filtroEnvio}
                      onChange={(e) => setFiltroEnvio(e.target.value as FiltroEnvio)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                    >
                      <option value="todas">Todas as empresas</option>
                      <option value="regulares">Apenas regulares</option>
                      <option value="nao_envia">Apenas "não envia"</option>
                    </select>
                  </div>
                  {empresasFiltradasVisao.length === 0 ? (
                    <div className="p-10 text-center">
                      <p className="text-sm text-slate-500">Nenhuma empresa encontrada.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-600">Empresa</th>
                            <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-600">Analista</th>
                            <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-600">Situação</th>
                            <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-600">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {empresasFiltradasVisao.map((empresa, idx) => (
                            <tr
                              key={empresa.id}
                              className={`border-b border-slate-100 hover:bg-slate-50 ${
                                idx === empresasFiltradasVisao.length - 1 ? 'border-b-0' : ''
                              }`}
                            >
                              <td className="px-4 py-3 text-slate-900 font-medium">{empresa.nome}</td>
                              <td className="px-4 py-3 text-slate-600">{empresa.analista_nome}</td>
                              <td className="px-4 py-3">
                                {empresa.nao_envia_extratos ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border bg-amber-50 text-amber-800 border-amber-300">
                                    Não envia extratos
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {aba === 'desempenho' && !analistaDetalhado && (
            <>
              <div className="mb-8 border-b border-slate-200 pb-6">
                <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  Equipe
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                  Desempenho da equipe
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Compare resultados dos analistas e acompanhe evolução nos últimos 6 meses.
                </p>
              </div>

              {/* Comparativo do mês — barras lado a lado */}
              <section className="mb-8">
                <header className="mb-3">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    Comparativo · <span className="capitalize">{NOME_MES}</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Métricas-chave da competência atual lado a lado.
                  </p>
                </header>

                <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">
                          Métrica
                        </th>
                        {analistas.map((a, i) => (
                          <th
                            key={a.id}
                            className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600"
                          >
                            <span className="flex items-center gap-1.5">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ background: CORES_ANALISTAS[i % CORES_ANALISTAS.length] }}
                              />
                              {a.nome}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const linhas = [
                          {
                            label: 'Extratos recebidos',
                            valores: statsPorAnalista.map((s) => ({
                              valor: s.percentConcluido,
                              texto: `${s.percentConcluido}%`,
                              max: 100,
                            })),
                          },
                          {
                            label: 'Balanços 100% concluídos',
                            valores: analistas.map((a) => {
                              const b = balancosPorAnalista[a.id];
                              return {
                                valor: b?.percentual || 0,
                                texto: `${b?.percentual || 0}% (${b?.concluidos || 0}/${b?.total || 0})`,
                                max: 100,
                              };
                            }),
                          },
                          {
                            label: 'Solicitações registradas',
                            valores: analistas.map((a) => {
                              const v = solicitacoesPorAnalista[a.id] || 0;
                              return { valor: v, texto: `${v}×`, max: 0 };
                            }),
                          },
                          {
                            label: 'Empresas em atenção',
                            valores: analistas.map((a) => {
                              const v = atencaoPorAnalista[a.id]?.length || 0;
                              return { valor: v, texto: String(v), max: 0 };
                            }),
                          },
                        ];

                        // Para métricas sem max fixo, usar o maior valor entre os analistas como referência
                        linhas.forEach((l) => {
                          if (l.valores[0]?.max === 0) {
                            const maior = Math.max(...l.valores.map((v) => v.valor), 1);
                            l.valores.forEach((v) => { v.max = maior; });
                          }
                        });

                        return linhas.map((linha, lidx) => (
                          <tr
                            key={lidx}
                            className={`border-b border-slate-100 ${
                              lidx === linhas.length - 1 ? 'border-b-0' : ''
                            }`}
                          >
                            <td className="px-5 py-4 font-medium text-slate-700 text-xs uppercase tracking-wider w-56">
                              {linha.label}
                            </td>
                            {linha.valores.map((v, vi) => (
                              <td key={vi} className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-semibold text-slate-900 w-20">
                                    {v.texto}
                                  </span>
                                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{
                                        width: `${Math.min(100, (v.valor / v.max) * 100)}%`,
                                        background: CORES_ANALISTAS[vi % CORES_ANALISTAS.length],
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                            ))}
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Histórico 6 meses - gráfico de linha SVG */}
              <section className="mb-8">
                <header className="mb-3">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    Evolução dos últimos 6 meses
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    % de empresas com extratos completamente recebidos, por analista.
                  </p>
                </header>

                <div className="bg-white border border-slate-200 rounded-md shadow-sm p-5">
                  {(() => {
                    const W = 720, H = 240, M = { t: 16, r: 16, b: 30, l: 36 };
                    const cw = W - M.l - M.r;
                    const ch = H - M.t - M.b;
                    const xStep = competencias6m.length > 1 ? cw / (competencias6m.length - 1) : 0;

                    return (
                      <div className="overflow-x-auto">
                        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px]" preserveAspectRatio="xMidYMid meet">
                          {/* Grid horizontal */}
                          {[0, 25, 50, 75, 100].map((p) => {
                            const y = M.t + ch - (p / 100) * ch;
                            return (
                              <g key={p}>
                                <line
                                  x1={M.l} y1={y} x2={W - M.r} y2={y}
                                  stroke="#e2e8f0" strokeDasharray={p === 0 ? '0' : '2 3'}
                                />
                                <text x={M.l - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#64748b">
                                  {p}%
                                </text>
                              </g>
                            );
                          })}

                          {/* Eixo X: meses */}
                          {competencias6m.map((c, i) => {
                            const x = M.l + i * xStep;
                            return (
                              <text
                                key={c} x={x} y={H - 8}
                                textAnchor="middle" fontSize="10" fill="#64748b"
                              >
                                {labelCurtoMes(c)}
                              </text>
                            );
                          })}

                          {/* Linhas e pontos por analista */}
                          {analistas.map((a, ai) => {
                            const cor = CORES_ANALISTAS[ai % CORES_ANALISTAS.length];
                            const pontos = competencias6m.map((c, i) => {
                              const p = historicoExtratos[a.id]?.[c] ?? 0;
                              const x = M.l + i * xStep;
                              const y = M.t + ch - (p / 100) * ch;
                              return { x, y, p, c };
                            });
                            const pathD = pontos
                              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                              .join(' ');
                            return (
                              <g key={a.id}>
                                <path d={pathD} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                {pontos.map((p, i) => (
                                  <g key={i}>
                                    <circle cx={p.x} cy={p.y} r="3.5" fill="white" stroke={cor} strokeWidth="2">
                                      <title>{a.nome} · {labelCurtoMes(p.c)}: {p.p}%</title>
                                    </circle>
                                  </g>
                                ))}
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    );
                  })()}

                  <div className="mt-4 flex items-center gap-4 flex-wrap text-xs">
                    {analistas.map((a, i) => (
                      <span key={a.id} className="flex items-center gap-1.5 text-slate-600">
                        <span
                          className="inline-block h-3 w-6 rounded-full"
                          style={{ background: CORES_ANALISTAS[i % CORES_ANALISTAS.length] }}
                        />
                        {a.nome}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              {/* Cards clicáveis por analista */}
              <section>
                <header className="mb-3">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    Ver detalhes
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Clique em um analista para abrir a visão detalhada.
                  </p>
                </header>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {statsPorAnalista.map((s, i) => {
                    const cor = CORES_ANALISTAS[i % CORES_ANALISTAS.length];
                    return (
                      <button
                        key={s.analista.id}
                        onClick={() => setAnalistaDetalhado(s.analista.id)}
                        className="bg-white border border-slate-200 hover:border-slate-400 rounded-md p-5 shadow-sm hover:shadow text-left transition group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <span
                            className="inline-flex items-center justify-center h-10 w-10 rounded-full text-white font-semibold text-sm"
                            style={{ background: cor }}
                          >
                            {s.analista.nome.slice(0, 2)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{s.analista.nome}</p>
                            <p className="text-xs text-slate-500">{s.total} empresas</p>
                          </div>
                          <svg className="h-4 w-4 text-slate-400 group-hover:text-slate-900 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-center">
                          <div className="bg-slate-50 rounded px-2 py-2">
                            <p className="text-lg font-semibold text-slate-900">{s.percentConcluido}%</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Extratos</p>
                          </div>
                          <div className="bg-slate-50 rounded px-2 py-2">
                            <p className="text-lg font-semibold text-slate-900">{balancosPorAnalista[s.analista.id]?.percentual || 0}%</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Balanços</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {aba === 'desempenho' && analistaDetalhado && (() => {
            const a = analistas.find((x) => x.id === analistaDetalhado);
            if (!a) return null;
            const s = statsPorAnalista.find((x) => x.analista.id === analistaDetalhado);
            const b = balancosPorAnalista[analistaDetalhado];
            const atencoes = atencaoPorAnalista[analistaDetalhado] || [];
            const empresasA = empresasAtivas.filter((e) => e.analista_id === analistaDetalhado);
            const cor = CORES_ANALISTAS[analistas.findIndex((x) => x.id === analistaDetalhado) % CORES_ANALISTAS.length];
            const historico = competencias6m.map((c) => ({
              competencia: c,
              percentual: historicoExtratos[analistaDetalhado]?.[c] ?? 0,
            }));

            return (
              <>
                <button
                  onClick={() => setAnalistaDetalhado(null)}
                  className="mb-6 text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Voltar para a equipe
                </button>

                <div className="mb-8 border-b border-slate-200 pb-6 flex items-center gap-4">
                  <span
                    className="inline-flex items-center justify-center h-14 w-14 rounded-full text-white font-semibold text-base"
                    style={{ background: cor }}
                  >
                    {a.nome.slice(0, 2)}
                  </span>
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      Analista
                    </p>
                    <h1 className="text-2xl font-semibold text-slate-900">{a.nome}</h1>
                    <p className="text-sm text-slate-500">{a.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Carteira</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{empresasA.length}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Extratos do mês</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{s?.percentConcluido || 0}%</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Balanços</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{b?.percentual || 0}%</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Em atenção</p>
                    <p className="mt-2 text-2xl font-semibold text-amber-700">{atencoes.length}</p>
                  </div>
                </div>

                <section className="mb-8">
                  <header className="mb-3">
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                      Evolução pessoal · últimos 6 meses
                    </h2>
                  </header>
                  <div className="bg-white border border-slate-200 rounded-md shadow-sm p-5">
                    <div className="grid grid-cols-6 gap-2">
                      {historico.map((h) => (
                        <div key={h.competencia} className="text-center">
                          <div className="h-32 flex items-end justify-center">
                            <div
                              className="w-full rounded-t"
                              style={{
                                background: cor,
                                opacity: 0.85,
                                height: `${Math.max(2, h.percentual)}%`,
                              }}
                              title={`${h.percentual}%`}
                            />
                          </div>
                          <p className="text-xs font-semibold text-slate-900 mt-2">{h.percentual}%</p>
                          <p className="text-[10px] text-slate-500 uppercase">{labelCurtoMes(h.competencia)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="mb-8">
                  <header className="mb-3">
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                      Empresas em atenção ({atencoes.length})
                    </h2>
                  </header>
                  {atencoes.length === 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-md p-5 text-sm text-emerald-800 text-center">
                      Nenhuma empresa precisa de atenção. Excelente trabalho.
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
                      <table className="w-full text-sm">
                        <tbody>
                          {atencoes.map((emp, idx) => (
                            <tr
                              key={emp.id}
                              className={`border-b border-slate-100 hover:bg-slate-50 ${
                                idx === atencoes.length - 1 ? 'border-b-0' : ''
                              }`}
                            >
                              <td className="px-4 py-2.5 text-slate-900 font-medium">{emp.nome}</td>
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
                    </div>
                  )}
                </section>
              </>
            );
          })()}

          {aba === 'controle' && (
            <>
              <div className="mb-8 border-b border-slate-200 pb-6 flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Administração
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                    Controle de empresas
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Cadastre, reatribua e mude o status das empresas. Inclui ativas, baixadas e suspensas.
                  </p>
                </div>
                <button
                  onClick={() => setModalAberto(true)}
                  className="text-sm font-medium px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 transition"
                >
                  + Adicionar empresa
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Ativas</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-700">{totalAtivas}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Suspensas</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-700">{totalSuspensas}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Baixadas</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-500">{totalBaixadas}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Total</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{empresas.length}</p>
                </div>
              </div>

              {decisoesPendentes.length > 0 && (
                <section className="mb-8">
                  <div className="bg-amber-50 border border-amber-200 rounded-md px-5 py-4">
                    <h2 className="text-sm font-semibold text-amber-900 uppercase tracking-wider">
                      Decisões pendentes
                    </h2>
                    <p className="text-xs text-amber-800 mt-0.5">
                      {decisoesPendentes.length} empresa{decisoesPendentes.length === 1 ? '' : 's'} marcada{decisoesPendentes.length === 1 ? '' : 's'} como "não envia" ainda com status Ativa. Decida se mantém ativa, suspende ou baixa.
                    </p>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {decisoesPendentes.slice(0, 10).map((emp) => (
                        <div key={emp.id} className="bg-white border border-amber-200 rounded px-3 py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{emp.nome}</p>
                            <p className="text-xs text-slate-500">{emp.analista_nome}</p>
                          </div>
                          <select
                            value={emp.status}
                            onChange={(e) => handleMudarStatus(emp.id, e.target.value as StatusEmpresa)}
                            className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                          >
                            <option value="ativa">Manter ativa</option>
                            <option value="suspensa">Suspender</option>
                            <option value="baixada">Baixar</option>
                          </select>
                        </div>
                      ))}
                    </div>
                    {decisoesPendentes.length > 10 && (
                      <p className="text-xs text-amber-700 mt-2">
                        Mostrando 10 de {decisoesPendentes.length}. As demais estão na tabela abaixo.
                      </p>
                    )}
                  </div>
                </section>
              )}

              <section>
                <div className="bg-white border border-slate-200 rounded-md shadow-sm">
                  <div className="p-4 border-b border-slate-200 grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-3">
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                      </svg>
                      <input
                        type="text"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Pesquisar..."
                        className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    </div>
                    <select
                      value={filtroAnalista}
                      onChange={(e) => setFiltroAnalista(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                    >
                      <option value="todos">Todos os analistas</option>
                      {analistas.map((a) => (
                        <option key={a.id} value={a.id}>{a.nome}</option>
                      ))}
                    </select>
                    <select
                      value={filtroStatus}
                      onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                    >
                      <option value="todos">Todos os status</option>
                      <option value="ativa">Apenas ativas</option>
                      <option value="suspensa">Apenas suspensas</option>
                      <option value="baixada">Apenas baixadas</option>
                    </select>
                  </div>
                  {empresasFiltradasControle.length === 0 ? (
                    <div className="p-10 text-center">
                      <p className="text-sm text-slate-500">Nenhuma empresa encontrada.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-600">Empresa</th>
                            <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-600">Analista</th>
                            <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-600">Status</th>
                            <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-600">Flag</th>
                            <th className="px-4 py-3 w-32"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {empresasFiltradasControle.map((empresa, idx) => (
                            <tr
                              key={empresa.id}
                              className={`border-b border-slate-100 ${
                                idx === empresasFiltradasControle.length - 1 ? 'border-b-0' : ''
                              } ${empresa.status === 'baixada' ? 'bg-slate-50/50' : ''}`}
                            >
                              <td className="px-4 py-3 text-slate-900 font-medium">
                                {empresa.nome}
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  value={empresa.analista_id}
                                  onChange={(e) => handleMudarAnalista(empresa.id, e.target.value)}
                                  className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 max-w-[140px]"
                                >
                                  {analistas.map((a) => (
                                    <option key={a.id} value={a.id}>{a.nome}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${STATUS_BADGE[empresa.status]}`}
                                  >
                                    {STATUS_LABEL[empresa.status]}
                                  </span>
                                  <select
                                    value={empresa.status}
                                    onChange={(e) => handleMudarStatus(empresa.id, e.target.value as StatusEmpresa)}
                                    className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                                  >
                                    <option value="ativa">Ativa</option>
                                    <option value="suspensa">Suspensa</option>
                                    <option value="baixada">Baixada</option>
                                  </select>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {empresa.nao_envia_extratos ? (
                                  <span className="text-xs text-amber-700 font-medium">⚑ Não envia</span>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Link
                                    href={`/empresa/${empresa.id}`}
                                    className="text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-400 rounded px-2.5 py-1 transition"
                                  >
                                    Abrir
                                  </Link>
                                  <button
                                    onClick={() => handleExcluirEmpresa(empresa.id, empresa.nome)}
                                    title="Excluir permanentemente"
                                    className="text-slate-400 hover:text-red-600 transition"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                Adicionar empresa
              </h3>
              <button
                onClick={() => setModalAberto(false)}
                className="text-slate-400 hover:text-slate-700 transition"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAdicionarEmpresa} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome da empresa *
                </label>
                <input
                  type="text"
                  value={novaEmpNome}
                  onChange={(e) => setNovaEmpNome(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  E-mail de contato
                </label>
                <input
                  type="email"
                  value={novaEmpEmail}
                  onChange={(e) => setNovaEmpEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Analista responsável *
                </label>
                <select
                  value={novaEmpAnalista}
                  onChange={(e) => setNovaEmpAnalista(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                >
                  {analistas.map((a) => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="text-sm font-medium px-4 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoNova || !novaEmpNome.trim()}
                  className="text-sm font-medium px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  {salvandoNova ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
