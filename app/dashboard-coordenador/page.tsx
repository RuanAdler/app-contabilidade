'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Empresa, Analista, BancoEmpresa, SolicitacaoExtrato, ProgressoChecklist, StatusEmpresa, PedidoHelp, SessaoTrabalho, TarefaEmpresa } from '@/lib/types';

function formatarDuracao(segundos: number): string {
  if (!segundos || segundos < 0) return '0min';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

type EmpresaComAnalista = Empresa & { analista_nome: string };
type FiltroStatus = 'todos' | StatusEmpresa;
type StatusMes = 'sem_bancos' | 'concluido' | 'parcial' | 'pendente';
type Aba = 'visao' | 'controle' | 'desempenho' | 'help' | 'relatorios';

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
  const [checklist6m, setChecklist6m] = useState<ProgressoChecklist[]>([]);
  const [totalEtapas, setTotalEtapas] = useState(0);
  const [busca, setBusca] = useState('');
  const [filtroAnalista, setFiltroAnalista] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>('visao');
  const [sidebarFixa, setSidebarFixa] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const sidebarAberta = sidebarFixa || sidebarHover;
  const [analistaDetalhado, setAnalistaDetalhado] = useState<string | null>(null);
  const [pedidosHelp, setPedidosHelp] = useState<PedidoHelp[]>([]);
  const [solucaoRascunho, setSolucaoRascunho] = useState<Record<string, string>>({});
  const [sessoesMes, setSessoesMes] = useState<SessaoTrabalho[]>([]);
  const [tickAgora, setTickAgora] = useState(Date.now());
  const [tarefasMes, setTarefasMes] = useState<TarefaEmpresa[]>([]);
  const [mostrarMaisAtencao, setMostrarMaisAtencao] = useState(false);

  // Filtros dos relatórios
  const [relExtrCompetencia, setRelExtrCompetencia] = useState(COMPETENCIA_ATUAL);
  const [relExtrAnalista, setRelExtrAnalista] = useState('todos');
  const [relExtrStatus, setRelExtrStatus] = useState('todos');
  const [relExtrEnvio, setRelExtrEnvio] = useState('todas');
  const [relAnaAnalista, setRelAnaAnalista] = useState('');
  const [relAnaCompetencia, setRelAnaCompetencia] = useState(COMPETENCIA_ATUAL);

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

      const competencias6mLista = competenciasAnteriores(6);
      const { data: checklistData } = await supabase
        .from('progresso_checklist')
        .select('*')
        .in('competencia', competencias6mLista);
      setChecklist6m(checklistData || []);

      const { count: countEtapas } = await supabase
        .from('etapas_checklist')
        .select('*', { count: 'exact', head: true });
      setTotalEtapas(countEtapas || 0);

      const { data: helpData } = await supabase
        .from('pedidos_help')
        .select('*')
        .order('created_at', { ascending: false });
      setPedidosHelp(helpData || []);

      const { data: sessoesData } = await supabase
        .from('sessoes_trabalho')
        .select('*')
        .eq('competencia', COMPETENCIA_ATUAL);
      setSessoesMes(sessoesData || []);

      const { data: tarefasData } = await supabase
        .from('tarefas_empresa')
        .select('*')
        .eq('competencia', COMPETENCIA_ATUAL);
      setTarefasMes(tarefasData || []);

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

  // Percentual do checklist de uma empresa em uma competência
  const percentualBalanco = (empresaId: string, competencia: string): number => {
    if (totalEtapas === 0) return 0;
    const feitos = checklist6m.filter(
      (c) => c.empresa_id === empresaId && c.competencia === competencia && c.feito_em
    ).length;
    return Math.round((feitos / totalEtapas) * 100);
  };

  // Status do balanço (checklist) de uma empresa
  type StatusBalanco = 'sem_dados' | 'nao_iniciado' | 'em_andamento' | 'concluido';
  const statusBalancoDaEmpresa = (empresaId: string, competencia: string = COMPETENCIA_ATUAL): StatusBalanco => {
    if (totalEtapas === 0) return 'sem_dados';
    const pct = percentualBalanco(empresaId, competencia);
    if (pct === 0) return 'nao_iniciado';
    if (pct === 100) return 'concluido';
    return 'em_andamento';
  };

  const statsPorAnalista = useMemo(() => {
    return analistas.map((a) => {
      const empresasDoAnalista = empresasAtivas.filter((e) => e.analista_id === a.id);
      const total = empresasDoAnalista.length;
      const naoEnvia = empresasDoAnalista.filter((e) => e.nao_envia_extratos).length;
      let concluidas = 0, emAndamento = 0, naoIniciadas = 0;
      for (const emp of empresasDoAnalista) {
        const s = statusBalancoDaEmpresa(emp.id, COMPETENCIA_ATUAL);
        if (s === 'concluido') concluidas++;
        else if (s === 'em_andamento') emAndamento++;
        else naoIniciadas++;
      }
      const percentConcluido = total > 0 ? Math.round((concluidas / total) * 100) : 0;
      return {
        analista: a, total, naoEnvia,
        concluidas, parciais: emAndamento, pendentes: naoIniciadas, semBancos: 0,
        percentConcluido,
      };
    });
  }, [analistas, empresasAtivas, checklist6m, totalEtapas]);

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

  // % balanços concluídos por (analista, competencia)
  const historicoBalancos = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    analistas.forEach((a) => { map[a.id] = {}; });
    if (totalEtapas === 0) return map;
    for (const a of analistas) {
      const empresasA = empresasAtivas.filter((e) => e.analista_id === a.id);
      for (const comp of competencias6m) {
        let concluidos = 0;
        for (const emp of empresasA) {
          const feitos = checklist6m.filter(
            (c) => c.empresa_id === emp.id && c.competencia === comp && c.feito_em
          ).length;
          if (feitos === totalEtapas) concluidos++;
        }
        map[a.id][comp] = empresasA.length > 0 ? Math.round((concluidos / empresasA.length) * 100) : 0;
      }
    }
    return map;
  }, [analistas, empresasAtivas, checklist6m, competencias6m, totalEtapas]);

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

  // ====== Sessões de trabalho ======
  useEffect(() => {
    const algumaAberta = sessoesMes.some((s) => !s.fim_em);
    if (!algumaAberta) return;
    const interval = setInterval(() => setTickAgora(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [sessoesMes]);

  const tempoEmpresaMes = (empresaId: string): number => {
    const sessoesEmp = sessoesMes.filter((s) => s.empresa_id === empresaId);
    let total = 0;
    for (const s of sessoesEmp) {
      if (s.fim_em) {
        total += s.duracao_segundos || 0;
      } else {
        total += Math.max(0, Math.floor((tickAgora - new Date(s.inicio_em).getTime()) / 1000));
      }
    }
    return total;
  };

  const tempoAnalistaMes = (analistaEmail: string): number => {
    const sessoesAna = sessoesMes.filter((s) => s.analista_email === analistaEmail);
    let total = 0;
    for (const s of sessoesAna) {
      if (s.fim_em) {
        total += s.duracao_segundos || 0;
      } else {
        total += Math.max(0, Math.floor((tickAgora - new Date(s.inicio_em).getTime()) / 1000));
      }
    }
    return total;
  };

  const tempoTotalEquipe = useMemo(
    () => analistas.reduce((sum, a) => sum + tempoAnalistaMes(a.email), 0),
    [analistas, sessoesMes, tickAgora]
  );

  // Quem está trabalhando agora (sessão ativa)
  const trabalhandoAgora = useMemo(() => {
    const ativos = sessoesMes.filter((s) => !s.fim_em);
    const map: Record<string, { analista: Analista | undefined; empresa: EmpresaComAnalista | undefined; inicio: string }> = {};
    for (const s of ativos) {
      const analista = analistas.find((a) => a.email === s.analista_email);
      const empresa = empresas.find((e) => e.id === s.empresa_id);
      map[s.analista_email] = { analista, empresa, inicio: s.inicio_em };
    }
    return Object.values(map);
  }, [sessoesMes, analistas, empresas]);

  // Tarefas atrasadas da equipe (na competência atual)
  const tarefasAtrasadasEquipe = useMemo(() => {
    const hojeStr = new Date().toISOString().slice(0, 10);
    return tarefasMes
      .filter((t) => !t.feita && t.prazo && t.prazo < hojeStr)
      .map((t) => ({
        tarefa: t,
        empresa: empresas.find((e) => e.id === t.empresa_id),
      }))
      .filter((x) => x.empresa && x.empresa.status === 'ativa');
  }, [tarefasMes, empresas]);

  const topEmpresasTempo = useMemo(() => {
    return empresasAtivas
      .map((emp) => ({ empresa: emp, segundos: tempoEmpresaMes(emp.id) }))
      .filter((x) => x.segundos > 0)
      .sort((a, b) => b.segundos - a.segundos)
      .slice(0, 10);
  }, [empresasAtivas, sessoesMes, tickAgora]);

  // ====== Helps ======
  const HORAS_24 = 24 * 60 * 60 * 1000;
  const HORAS_48 = 48 * 60 * 60 * 1000;
  const agoraMs = Date.now();

  const helpsAbertos = useMemo(
    () => pedidosHelp.filter((p) => p.status === 'aberto'),
    [pedidosHelp]
  );
  const helpsVisualizados = useMemo(
    () => pedidosHelp.filter((p) => p.status === 'visualizado'),
    [pedidosHelp]
  );
  const helpsResolvidos = useMemo(
    () => pedidosHelp.filter((p) => p.status === 'resolvido'),
    [pedidosHelp]
  );

  const helpsUrgentes = useMemo(() => {
    return helpsAbertos.filter(
      (p) => agoraMs - new Date(p.created_at).getTime() >= HORAS_24
    ).length + helpsVisualizados.filter(
      (p) => p.visualizado_em && agoraMs - new Date(p.visualizado_em).getTime() >= HORAS_48
    ).length;
  }, [helpsAbertos, helpsVisualizados, agoraMs]);

  const idadeHelp = (p: PedidoHelp): { urgente: boolean; texto: string } => {
    if (p.status === 'aberto') {
      const ms = agoraMs - new Date(p.created_at).getTime();
      const horas = Math.floor(ms / (60 * 60 * 1000));
      return {
        urgente: ms >= HORAS_24,
        texto: horas < 1 ? 'Recém-criado' : horas < 24 ? `${horas}h em aberto` : `${Math.floor(horas / 24)}d em aberto`,
      };
    }
    if (p.status === 'visualizado' && p.visualizado_em) {
      const ms = agoraMs - new Date(p.visualizado_em).getTime();
      const horas = Math.floor(ms / (60 * 60 * 1000));
      return {
        urgente: ms >= HORAS_48,
        texto: horas < 1 ? 'Visualizado agora' : horas < 24 ? `${horas}h sem resolver` : `${Math.floor(horas / 24)}d sem resolver`,
      };
    }
    return { urgente: false, texto: '' };
  };

  const handleVisualizarHelp = async (id: string) => {
    const agora = new Date().toISOString();
    const { data } = await supabase
      .from('pedidos_help')
      .update({
        status: 'visualizado',
        visualizado_em: agora,
        visualizado_por: usuario?.email,
      })
      .eq('id', id)
      .select()
      .single();
    if (data) setPedidosHelp((prev) => prev.map((p) => (p.id === id ? data : p)));
  };

  const handleResolverHelp = async (id: string) => {
    const solucao = (solucaoRascunho[id] || '').trim();
    const agora = new Date().toISOString();
    const { data } = await supabase
      .from('pedidos_help')
      .update({
        status: 'resolvido',
        resolvido_em: agora,
        resolvido_por_email: usuario?.email,
        resolvido_por_tipo: 'coordenador',
        solucao: solucao || null,
      })
      .eq('id', id)
      .select()
      .single();
    if (data) {
      setPedidosHelp((prev) => prev.map((p) => (p.id === id ? data : p)));
      setSolucaoRascunho((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

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

  const helpsPendentes = helpsAbertos.length + helpsVisualizados.length;

  const itensMenu: { id: Aba; label: string; icone: React.ReactNode; badge?: number; badgeUrgente?: boolean }[] = [
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
    {
      id: 'help',
      label: 'Help',
      badge: helpsPendentes > 0 ? helpsPendentes : undefined,
      badgeUrgente: helpsUrgentes > 0,
      icone: (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
          <circle cx="12" cy="12" r="3" strokeWidth={1.8} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5.636 5.636l3.536 3.536m5.656 0l3.536-3.536m-3.536 9.192l3.536 3.536m-9.192-3.536l-3.536 3.536" />
        </svg>
      ),
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      icone: (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

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
                  onClick={() => { setAba(item.id); setBusca(''); setFiltroAnalista('todos'); setAnalistaDetalhado(null); }}
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
                        <span
                          className={`inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-white text-[10px] font-bold ${
                            item.badgeUrgente ? 'bg-red-600 animate-pulse' : 'bg-slate-500'
                          }`}
                        >
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
          {aba === 'visao' && (
            <>
              <div className="mb-8 border-b border-slate-200 pb-6">
                <p className="label-tiny">
                  Painel de Coordenação
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                  Visão consolidada da carteira
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Competência atual: <span className="capitalize">{NOME_MES}</span> · {totalAtivas} empresas ativas · {analistas.length} analistas.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="label-tiny">
                    Empresas ativas
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{totalAtivas}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="label-tiny">
                    Analistas
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{analistas.length}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="label-tiny">
                    Média/analista
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {analistas.length > 0 ? Math.round(totalAtivas / analistas.length) : 0}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="label-tiny">
                    Tempo da equipe
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
                    {formatarDuracao(tempoTotalEquipe)}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="label-tiny">
                    Não envia
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-amber-700">{totalNaoEnvia}</p>
                </div>
              </div>

              {/* === SEÇÃO HOJE === */}
              <section className="mb-8">
                <header className="mb-3">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    Hoje
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    O que precisa da sua atenção agora.
                  </p>
                </header>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Trabalhando agora */}
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="label-tiny">
                        Trabalhando agora
                      </p>
                      <span className="text-xl font-semibold text-slate-900">{trabalhandoAgora.length}</span>
                    </div>
                    {trabalhandoAgora.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Ninguém com sessão ativa.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {trabalhandoAgora.map((t, i) => (
                          <li key={i} className="text-xs flex items-baseline gap-1.5">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mt-1 shrink-0" />
                            <span className="font-medium text-slate-900">{t.analista?.nome || t.empresa?.analista_nome || '—'}</span>
                            <span className="text-slate-500 truncate">
                              em {t.empresa ? (
                                <Link href={`/empresa/${t.empresa.id}`} className="hover:underline">{t.empresa.nome}</Link>
                              ) : '—'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Helps urgentes */}
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="label-tiny">
                        Helps urgentes
                      </p>
                      <span className={`text-xl font-semibold ${helpsUrgentes > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                        {helpsUrgentes}
                      </span>
                    </div>
                    {helpsUrgentes === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        {helpsPendentes > 0 ? `${helpsPendentes} pendente${helpsPendentes === 1 ? '' : 's'}, nada urgente.` : 'Nenhum pedido aberto.'}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-600">
                        {helpsUrgentes} pedido{helpsUrgentes === 1 ? '' : 's'} parado{helpsUrgentes === 1 ? '' : 's'} há mais de 24h.
                        {' '}
                        <button
                          onClick={() => { setAba('help'); }}
                          className="text-red-700 font-semibold hover:underline"
                        >
                          Ver agora →
                        </button>
                      </p>
                    )}
                  </div>

                  {/* Tarefas atrasadas */}
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="label-tiny">
                        Tarefas atrasadas
                      </p>
                      <span className={`text-xl font-semibold ${tarefasAtrasadasEquipe.length > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                        {tarefasAtrasadasEquipe.length}
                      </span>
                    </div>
                    {tarefasAtrasadasEquipe.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Nenhuma tarefa atrasada.</p>
                    ) : (
                      <ul className="space-y-1">
                        {tarefasAtrasadasEquipe.slice(0, 3).map(({ tarefa, empresa }) => (
                          <li key={tarefa.id} className="text-xs truncate">
                            <Link href={`/empresa/${empresa!.id}`} className="text-slate-700 hover:underline">
                              {empresa!.nome}
                            </Link>
                            <span className="text-slate-500 mx-1">·</span>
                            <span className="text-slate-500">{tarefa.titulo}</span>
                          </li>
                        ))}
                        {tarefasAtrasadasEquipe.length > 3 && (
                          <li className="text-[11px] text-slate-400 pt-0.5">
                            + {tarefasAtrasadasEquipe.length - 3} outra{tarefasAtrasadasEquipe.length - 3 === 1 ? '' : 's'}
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </section>

              {/* === DESEMPENHO POR ANALISTA — versão compacta === */}
              <section className="mb-8">
                <header className="mb-3 flex items-baseline justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                      Desempenho por analista
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Resumo da competência. Para detalhes, vá em <button onClick={() => setAba('desempenho')} className="text-slate-700 hover:underline font-medium">Desempenho da equipe</button>.
                    </p>
                  </div>
                </header>
                <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Analista</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Balanços</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Em atenção</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Tempo no mês</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsPorAnalista.map((s, idx) => (
                        <tr
                          key={s.analista.id}
                          className={`border-b border-slate-100 ${idx === statsPorAnalista.length - 1 ? 'border-b-0' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-slate-900">{s.analista.nome}</p>
                            <p className="text-[11px] text-slate-500">{s.total} empresas</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    s.percentConcluido >= 80 ? 'bg-emerald-500'
                                    : s.percentConcluido >= 50 ? 'bg-amber-500'
                                    : 'bg-red-500'
                                  }`}
                                  style={{ width: `${s.percentConcluido}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold text-slate-900 tabular-nums">{s.percentConcluido}%</span>
                              <span className="text-[11px] text-slate-500">({s.concluidas}/{s.total})</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-semibold ${(atencaoPorAnalista[s.analista.id]?.length || 0) > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                              {atencaoPorAnalista[s.analista.id]?.length || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-sm font-semibold text-slate-700 tabular-nums">
                              {formatarDuracao(tempoAnalistaMes(s.analista.email))}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                        {empresasAtencao.slice(0, mostrarMaisAtencao ? 30 : 5).map((item, idx, arr) => (
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
                    {empresasAtencao.length > 5 && (
                      <button
                        onClick={() => setMostrarMaisAtencao(!mostrarMaisAtencao)}
                        className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border-t border-slate-200 text-xs font-medium text-slate-700 transition"
                      >
                        {mostrarMaisAtencao
                          ? 'Mostrar menos'
                          : `Ver mais (${Math.min(empresasAtencao.length - 5, 25)} ${empresasAtencao.length - 5 === 1 ? 'empresa' : 'empresas'})`}
                      </button>
                    )}
                  </div>
                )}
              </section>

              {topEmpresasTempo.length > 0 && (
                <section className="mb-8">
                  <header className="mb-3 flex items-baseline justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                        Empresas com mais tempo investido · {NOME_MES}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Top 10 empresas que mais demandaram tempo da equipe.
                      </p>
                    </div>
                  </header>
                  <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600 w-8">#</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Empresa</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Analista</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Tempo</th>
                          <th className="px-4 py-2.5 w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {topEmpresasTempo.map((item, idx) => {
                          const maxSegundos = topEmpresasTempo[0].segundos;
                          const proporcao = maxSegundos > 0 ? (item.segundos / maxSegundos) * 100 : 0;
                          return (
                            <tr
                              key={item.empresa.id}
                              className={`border-b border-slate-100 hover:bg-slate-50 ${
                                idx === topEmpresasTempo.length - 1 ? 'border-b-0' : ''
                              }`}
                            >
                              <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{idx + 1}</td>
                              <td className="px-4 py-2.5 text-slate-900 font-medium">{item.empresa.nome}</td>
                              <td className="px-4 py-2.5 text-slate-600 text-xs">{item.empresa.analista_nome}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2 justify-end">
                                  <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-slate-700"
                                      style={{ width: `${proporcao}%` }}
                                    />
                                  </div>
                                  <span className="font-mono font-semibold text-slate-900 tabular-nums text-xs min-w-[60px] text-right">
                                    {formatarDuracao(item.segundos)}
                                  </span>
                                </div>
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <div className="mt-8 bg-slate-50 border border-slate-200 rounded-md p-4 text-center">
                <p className="text-xs text-slate-500">
                  Quer ver a carteira completa, gerenciar empresas, baixadas ou suspensas?
                </p>
                <button
                  onClick={() => setAba('controle')}
                  className="mt-2 text-sm font-medium text-slate-700 hover:text-slate-900 underline"
                >
                  Ir para Controle de empresas →
                </button>
              </div>
            </>
          )}

          {aba === 'desempenho' && !analistaDetalhado && (
            <>
              <div className="mb-8 border-b border-slate-200 pb-6">
                <p className="label-tiny">
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
                            label: 'Balanços concluídos',
                            valores: statsPorAnalista.map((s) => ({
                              valor: s.percentConcluido,
                              texto: `${s.percentConcluido}% (${s.concluidas}/${s.total})`,
                              max: 100,
                            })),
                          },
                          {
                            label: 'Balanços em andamento',
                            valores: statsPorAnalista.map((s) => ({
                              valor: s.parciais,
                              texto: String(s.parciais),
                              max: 0,
                            })),
                          },
                          {
                            label: 'Solicitações de extrato',
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
                    % de empresas com balanço 100% concluído, por analista.
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
                              const p = historicoBalancos[a.id]?.[c] ?? 0;
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
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-slate-50 rounded px-1 py-2">
                            <p className="text-lg font-semibold text-emerald-700">{s.concluidas}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Concl.</p>
                          </div>
                          <div className="bg-slate-50 rounded px-1 py-2">
                            <p className="text-lg font-semibold text-amber-700">{s.parciais}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Em and.</p>
                          </div>
                          <div className="bg-slate-50 rounded px-1 py-2">
                            <p className="text-lg font-semibold text-red-700">{atencaoPorAnalista[s.analista.id]?.length || 0}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Atenção</p>
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
            const atencoes = atencaoPorAnalista[analistaDetalhado] || [];
            const empresasA = empresasAtivas.filter((e) => e.analista_id === analistaDetalhado);
            const cor = CORES_ANALISTAS[analistas.findIndex((x) => x.id === analistaDetalhado) % CORES_ANALISTAS.length];
            const historico = competencias6m.map((c) => ({
              competencia: c,
              percentual: historicoBalancos[analistaDetalhado]?.[c] ?? 0,
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
                    <p className="label-tiny">
                      Analista
                    </p>
                    <h1 className="text-2xl font-semibold text-slate-900">{a.nome}</h1>
                    <p className="text-sm text-slate-500">{a.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <p className="label-tiny">Carteira</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{empresasA.length}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <p className="label-tiny">Balanços concluídos</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {s?.percentConcluido || 0}%
                      <span className="text-sm font-normal text-slate-500 ml-2">
                        ({s?.concluidas || 0}/{s?.total || 0})
                      </span>
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <p className="label-tiny">Em andamento</p>
                    <p className="mt-2 text-2xl font-semibold text-amber-700">{s?.parciais || 0}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <p className="label-tiny">Em atenção</p>
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
                  <p className="label-tiny">
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
                  <p className="label-tiny">Ativas</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-700">{totalAtivas}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="label-tiny">Suspensas</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-700">{totalSuspensas}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="label-tiny">Baixadas</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-500">{totalBaixadas}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="label-tiny">Total</p>
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

          {aba === 'help' && (
            <>
              <div className="mb-8 border-b border-slate-200 pb-6">
                <p className="label-tiny">
                  Suporte à equipe
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                  Pedidos de ajuda dos analistas
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {helpsAbertos.length} aberto{helpsAbertos.length === 1 ? '' : 's'} · {helpsVisualizados.length} visualizado{helpsVisualizados.length === 1 ? '' : 's'} · {helpsResolvidos.length} resolvido{helpsResolvidos.length === 1 ? '' : 's'}
                  {helpsUrgentes > 0 && (
                    <span className="text-red-700 font-semibold ml-2">
                      · {helpsUrgentes} urgente{helpsUrgentes === 1 ? '' : 's'}
                    </span>
                  )}
                </p>
              </div>

              {helpsAbertos.length === 0 && helpsVisualizados.length === 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-md px-5 py-8 text-center mb-6">
                  <p className="text-sm font-semibold text-emerald-800">Nenhum pedido aberto.</p>
                  <p className="text-xs text-emerald-700 mt-1">Tudo está sob controle no momento.</p>
                </div>
              )}

              {helpsAbertos.length > 0 && (
                <section className="mb-8">
                  <header className="mb-3">
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                      Aguardando primeira resposta
                    </h2>
                  </header>
                  <ul className="space-y-3">
                    {helpsAbertos.map((p) => {
                      const empresa = empresas.find((e) => e.id === p.empresa_id);
                      const idade = idadeHelp(p);
                      return (
                        <li
                          key={p.id}
                          className={`bg-white border rounded-md p-5 shadow-sm ${
                            idade.urgente ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">
                                {empresa?.nome || '—'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {p.analista_email} · {new Date(p.created_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${
                                idade.urgente
                                  ? 'bg-red-50 text-red-800 border-red-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {idade.urgente ? '🔴 ' : ''}
                              {idade.texto}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap mb-4">{p.mensagem}</p>

                          <div className="border-t border-slate-100 pt-3 space-y-3">
                            <textarea
                              value={solucaoRascunho[p.id] || ''}
                              onChange={(e) => setSolucaoRascunho({ ...solucaoRascunho, [p.id]: e.target.value })}
                              placeholder="Escreva a solução (opcional, se for fácil de resolver agora)..."
                              rows={3}
                              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y"
                            />
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              <button
                                onClick={() => handleVisualizarHelp(p.id)}
                                className="text-xs font-medium px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                              >
                                Visualizei, ajudo mais tarde
                              </button>
                              <button
                                onClick={() => handleResolverHelp(p.id)}
                                className="text-xs font-medium px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 transition"
                              >
                                Dei um help (resolver)
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {helpsVisualizados.length > 0 && (
                <section className="mb-8">
                  <header className="mb-3">
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                      Visualizados, aguardando resolução
                    </h2>
                  </header>
                  <ul className="space-y-3">
                    {helpsVisualizados.map((p) => {
                      const empresa = empresas.find((e) => e.id === p.empresa_id);
                      const idade = idadeHelp(p);
                      return (
                        <li
                          key={p.id}
                          className={`bg-white border rounded-md p-5 shadow-sm ${
                            idade.urgente ? 'border-red-300 ring-1 ring-red-200' : 'border-amber-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">
                                {empresa?.nome || '—'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {p.analista_email} · criado {new Date(p.created_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${
                                idade.urgente
                                  ? 'bg-red-50 text-red-800 border-red-300 animate-pulse'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}
                            >
                              {idade.urgente ? '🔴 ' : ''}
                              {idade.texto}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap mb-4">{p.mensagem}</p>

                          <div className="border-t border-slate-100 pt-3 space-y-3">
                            <textarea
                              value={solucaoRascunho[p.id] || ''}
                              onChange={(e) => setSolucaoRascunho({ ...solucaoRascunho, [p.id]: e.target.value })}
                              placeholder="Escreva a solução (opcional)..."
                              rows={3}
                              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y"
                            />
                            <div className="flex justify-end">
                              <button
                                onClick={() => handleResolverHelp(p.id)}
                                className="text-xs font-medium px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 transition"
                              >
                                Marcar como resolvido
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {helpsResolvidos.length > 0 && (
                <section>
                  <header className="mb-3">
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                      Resolvidos recentes
                    </h2>
                  </header>
                  <ul className="space-y-3">
                    {helpsResolvidos.slice(0, 15).map((p) => {
                      const empresa = empresas.find((e) => e.id === p.empresa_id);
                      return (
                        <li key={p.id} className="bg-white border border-slate-200 rounded-md p-4 opacity-80">
                          <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-700">{empresa?.nome || '—'}</p>
                              <p className="text-[11px] text-slate-500">
                                Por {p.analista_email} · resolvido por{' '}
                                {p.resolvido_por_tipo === 'analista' ? 'ele mesmo' : 'coordenação'}
                                {' '}em {p.resolvido_em ? new Date(p.resolvido_em).toLocaleString('pt-BR') : '—'}
                              </p>
                            </div>
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border bg-emerald-50 text-emerald-800 border-emerald-300">
                              Resolvido
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 whitespace-pre-wrap">{p.mensagem}</p>
                          {p.solucao && (
                            <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                                Resposta
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

          {aba === 'relatorios' && (
            <>
              <div className="mb-8 border-b border-slate-200 pb-6">
                <p className="label-tiny">
                  Documentação
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                  Relatórios
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Gere documentos para auditoria, reuniões e arquivamento. Após visualizar, use o botão "Imprimir / Salvar como PDF".
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Relatório mensal de extratos */}
                <section className="bg-white border border-slate-200 rounded-md shadow-sm">
                  <header className="px-5 py-4 border-b border-slate-200">
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                      Relatório mensal de extratos
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Status dos extratos bancários por empresa na competência selecionada.
                    </p>
                  </header>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Competência
                      </label>
                      <input
                        type="month"
                        value={relExtrCompetencia}
                        onChange={(e) => setRelExtrCompetencia(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Analista
                      </label>
                      <select
                        value={relExtrAnalista}
                        onChange={(e) => setRelExtrAnalista(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                      >
                        <option value="todos">Todos os analistas</option>
                        {analistas.map((a) => (
                          <option key={a.id} value={a.id}>{a.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Filtrar por status
                      </label>
                      <select
                        value={relExtrStatus}
                        onChange={(e) => setRelExtrStatus(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                      >
                        <option value="todos">Todos</option>
                        <option value="pendente">Apenas pendentes</option>
                        <option value="solicitado">Apenas solicitados</option>
                        <option value="recebido">Apenas recebidos</option>
                        <option value="importado">Apenas importados</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Empresas
                      </label>
                      <select
                        value={relExtrEnvio}
                        onChange={(e) => setRelExtrEnvio(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                      >
                        <option value="todas">Todas</option>
                        <option value="regulares">Apenas regulares</option>
                        <option value="nao_envia">Apenas "não envia extratos"</option>
                      </select>
                    </div>
                    <div className="pt-2">
                      <a
                        href={`/relatorios/extratos?competencia=${relExtrCompetencia}&analista=${relExtrAnalista}&status=${relExtrStatus}&envio=${relExtrEnvio}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 transition"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v4a1 1 0 001 1h4M5 8V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2v-3m-3 0h10m0 0l-3-3m3 3l-3 3" />
                        </svg>
                        Gerar relatório
                      </a>
                    </div>
                  </div>
                </section>

                {/* Relatório individual por analista */}
                <section className="bg-white border border-slate-200 rounded-md shadow-sm">
                  <header className="px-5 py-4 border-b border-slate-200">
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                      Relatório individual por analista
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Desempenho consolidado de um analista para o mês escolhido. Bom para reuniões individuais.
                    </p>
                  </header>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Analista
                      </label>
                      <select
                        value={relAnaAnalista}
                        onChange={(e) => setRelAnaAnalista(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                      >
                        <option value="">— Selecione o analista —</option>
                        {analistas.map((a) => (
                          <option key={a.id} value={a.id}>{a.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Competência de referência
                      </label>
                      <input
                        type="month"
                        value={relAnaCompetencia}
                        onChange={(e) => setRelAnaCompetencia(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    </div>
                    <div className="pt-2">
                      {relAnaAnalista ? (
                        <a
                          href={`/relatorios/analista?analista=${relAnaAnalista}&competencia=${relAnaCompetencia}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 transition"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v4a1 1 0 001 1h4M5 8V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2v-3m-3 0h10m0 0l-3-3m3 3l-3 3" />
                          </svg>
                          Gerar relatório
                        </a>
                      ) : (
                        <button
                          disabled
                          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded bg-slate-300 text-white cursor-not-allowed"
                        >
                          Selecione um analista
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              <div className="mt-8 bg-slate-100 border border-slate-200 rounded-md p-5 text-sm text-slate-600">
                <p className="font-semibold text-slate-900 mb-1">Como salvar como PDF</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Clique em "Gerar relatório" — abre em nova aba.</li>
                  <li>Na página do relatório, clique no botão "Imprimir / Salvar como PDF".</li>
                  <li>Na janela do navegador, em <strong>Destino</strong>, escolha <strong>"Salvar como PDF"</strong>.</li>
                  <li>Em "Mais configurações", desmarque "Cabeçalhos e rodapés" para um documento limpo.</li>
                  <li>Clique em <strong>Salvar</strong>.</li>
                </ol>
              </div>
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
                  className="btn-primary"
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
