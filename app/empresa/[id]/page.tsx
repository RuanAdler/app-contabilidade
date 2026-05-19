'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import {
  Empresa, ProgressoChecklist, EtapaChecklist, GrupoChecklist,
  ObservacaoEmpresa, TarefaEmpresa, SessaoTrabalho,
} from '@/lib/types';

function formatarDuracao(segundos: number): string {
  if (!segundos || segundos < 0) return '0min';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

const GRUPO_LABEL: Record<GrupoChecklist, string> = {
  ativo: 'Ativo',
  passivo: 'Passivo',
  patrimonio_liquido: 'Patrimônio Líquido',
};

const SUBGRUPO_LABEL: Record<string, string> = {
  circulante: 'Circulante',
  nao_circulante: 'Não circulante',
};

type AbaEmpresa = 'checklist' | 'observacoes';

export default function EmpresaDetail() {
  const [usuario, setUsuario] = useState<any>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [checklist, setChecklist] = useState<ProgressoChecklist[]>([]);
  const [etapas, setEtapas] = useState<EtapaChecklist[]>([]);
  const [observacao, setObservacao] = useState<ObservacaoEmpresa | null>(null);
  const [obsTexto, setObsTexto] = useState('');
  const [salvandoObs, setSalvandoObs] = useState(false);
  const [tarefas, setTarefas] = useState<TarefaEmpresa[]>([]);
  const [novaTarefa, setNovaTarefa] = useState({ titulo: '', descricao: '', prazo: '' });
  const [salvandoTarefa, setSalvandoTarefa] = useState(false);
  const [obsEditandoId, setObsEditandoId] = useState<string | null>(null);
  const [obsRascunho, setObsRascunho] = useState('');
  const [obsGeralTexto, setObsGeralTexto] = useState('');
  const [salvandoObsGeral, setSalvandoObsGeral] = useState(false);
  const [aba, setAba] = useState<AbaEmpresa>('checklist');
  const [sidebarFixa, setSidebarFixa] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const sidebarAberta = sidebarFixa || sidebarHover;

  // Sessões de trabalho
  const [sessaoAtiva, setSessaoAtiva] = useState<SessaoTrabalho | null>(null);
  const [sessoesMes, setSessoesMes] = useState<SessaoTrabalho[]>([]);
  const [tickAgora, setTickAgora] = useState<number>(Date.now());
  const [modalPausaAberto, setModalPausaAberto] = useState(false);
  const [motivoPausa, setMotivoPausa] = useState('');
  const [pausando, setPausando] = useState(false);
  const [iniciando, setIniciando] = useState(false);

  const hoje = new Date();
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const [mes, setMes] = useState(String(hoje.getMonth() + 1).padStart(2, '0'));
  const competencia = `${ano}-${mes}`;
  const [loading, setLoading] = useState(true);
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
      setObsGeralTexto(empresaData?.observacao_geral || '');
      setLoading(false);
    };
    loadData();
  }, [router, empresaId]);

  // Carregar sessões da empresa no mês + sessão ativa do analista
  useEffect(() => {
    const carregar = async () => {
      if (!usuario?.email) return;
      const { data: sessoes } = await supabase
        .from('sessoes_trabalho')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('competencia', competencia)
        .eq('analista_email', usuario.email)
        .order('inicio_em', { ascending: false });
      const todas = sessoes || [];
      setSessoesMes(todas);
      const ativa = todas.find((s) => !s.fim_em) || null;
      setSessaoAtiva(ativa);
    };
    carregar();
  }, [empresaId, competencia, usuario?.email]);

  // Tick a cada segundo enquanto houver sessão ativa
  useEffect(() => {
    if (!sessaoAtiva) return;
    const interval = setInterval(() => setTickAgora(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [sessaoAtiva]);

  const iniciarTrabalho = async () => {
    if (!usuario?.email || iniciando) return;
    setIniciando(true);
    const agora = new Date().toISOString();

    // Fechar qualquer outra sessão aberta do analista (em qualquer empresa)
    const { data: abertas } = await supabase
      .from('sessoes_trabalho')
      .select('*, empresa:empresas(nome)')
      .is('fim_em', null)
      .eq('analista_email', usuario.email);

    if (abertas && abertas.length > 0) {
      for (const aberta of abertas) {
        const dur = Math.max(0, Math.floor((Date.now() - new Date(aberta.inicio_em).getTime()) / 1000));
        const motivo = aberta.empresa_id === empresaId
          ? 'Sessão reiniciada'
          : `Trocou para "${empresa?.nome || 'outra empresa'}"`;
        await supabase
          .from('sessoes_trabalho')
          .update({ fim_em: agora, duracao_segundos: dur, motivo_pausa: motivo })
          .eq('id', aberta.id);
      }
    }

    // Criar nova sessão
    const { data } = await supabase
      .from('sessoes_trabalho')
      .insert({
        empresa_id: empresaId,
        competencia,
        analista_email: usuario.email,
        inicio_em: agora,
      })
      .select()
      .single();

    if (data) {
      setSessaoAtiva(data);
      setSessoesMes((prev) => {
        const filtradas = prev.map((s) => {
          if (!s.fim_em) {
            const dur = Math.max(0, Math.floor((Date.now() - new Date(s.inicio_em).getTime()) / 1000));
            return { ...s, fim_em: agora, duracao_segundos: dur, motivo_pausa: 'Sessão reiniciada' };
          }
          return s;
        });
        return [data, ...filtradas];
      });
    }
    setIniciando(false);
  };

  const confirmarPausa = async () => {
    if (!sessaoAtiva || pausando) return;
    setPausando(true);
    const agora = new Date().toISOString();
    const dur = Math.max(0, Math.floor((Date.now() - new Date(sessaoAtiva.inicio_em).getTime()) / 1000));
    const { data } = await supabase
      .from('sessoes_trabalho')
      .update({
        fim_em: agora,
        duracao_segundos: dur,
        motivo_pausa: motivoPausa.trim() || null,
      })
      .eq('id', sessaoAtiva.id)
      .select()
      .single();
    if (data) {
      setSessoesMes((prev) => prev.map((s) => (s.id === sessaoAtiva.id ? data : s)));
      setSessaoAtiva(null);
    }
    setMotivoPausa('');
    setModalPausaAberto(false);
    setPausando(false);
  };

  const segundosSessaoAtiva = sessaoAtiva
    ? Math.floor((tickAgora - new Date(sessaoAtiva.inicio_em).getTime()) / 1000)
    : 0;

  const segundosFechadasMes = sessoesMes.reduce(
    (sum, s) => sum + (s.fim_em ? (s.duracao_segundos || 0) : 0),
    0
  );

  const segundosTotalMes = segundosFechadasMes + segundosSessaoAtiva;

  const salvarObservacaoGeral = async () => {
    if (!empresa) return;
    if (obsGeralTexto === (empresa.observacao_geral || '')) return;
    setSalvandoObsGeral(true);
    const valor = obsGeralTexto.trim() || null;
    const { data } = await supabase
      .from('empresas')
      .update({ observacao_geral: valor })
      .eq('id', empresaId)
      .select()
      .single();
    if (data) setEmpresa(data);
    setSalvandoObsGeral(false);
  };

  useEffect(() => {
    const carregar = async () => {
      const [{ data: etapasData }, { data: progressoData }, { data: obsData }, { data: tarefasData }] = await Promise.all([
        supabase.from('etapas_checklist').select('*').order('ordem'),
        supabase.from('progresso_checklist').select('*').eq('empresa_id', empresaId).eq('competencia', competencia),
        supabase.from('observacoes_empresa').select('*').eq('empresa_id', empresaId).eq('competencia', competencia).maybeSingle(),
        supabase.from('tarefas_empresa').select('*').in('empresa_id', [empresaId]).eq('competencia', competencia).order('feita').order('prazo', { nullsFirst: false }),
      ]);
      setEtapas(etapasData || []);
      setChecklist(progressoData || []);
      setObservacao(obsData || null);
      setObsTexto(obsData?.texto || '');
      setTarefas(tarefasData || []);
    };
    carregar();
  }, [empresaId, competencia]);

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

  const salvarObservacaoEtapa = async (etapaId: string, texto: string) => {
    const valor = texto.trim() || null;
    const existente = checklist.find((c) => c.etapa_id === etapaId);
    if (existente) {
      if ((existente.observacao || null) === valor) return;
      const { data } = await supabase
        .from('progresso_checklist')
        .update({ observacao: valor })
        .eq('id', existente.id)
        .select()
        .single();
      if (data) {
        setChecklist((prev) => prev.map((c) => (c.id === existente.id ? data : c)));
      }
    } else if (valor) {
      const { data } = await supabase
        .from('progresso_checklist')
        .insert({
          empresa_id: empresaId,
          etapa_id: etapaId,
          competencia,
          observacao: valor,
        })
        .select()
        .single();
      if (data) setChecklist((prev) => [...prev, data]);
    }
  };

  const abrirEdicaoObs = (etapaId: string, textoAtual: string) => {
    setObsEditandoId(etapaId);
    setObsRascunho(textoAtual);
  };

  const fecharEdicaoObs = async () => {
    if (obsEditandoId) {
      await salvarObservacaoEtapa(obsEditandoId, obsRascunho);
    }
    setObsEditandoId(null);
    setObsRascunho('');
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
            {[
              {
                id: 'checklist' as AbaEmpresa,
                label: 'Checklist',
                icone: (
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                ),
              },
              {
                id: 'observacoes' as AbaEmpresa,
                label: 'Observações',
                icone: (
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                ),
              },
            ].map((item) => {
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
        </div>

      <main className="flex-1 max-w-6xl mx-auto px-6 py-8 min-w-0">
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
              <p className="label-tiny">
                Empresa
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">{empresa.nome}</h1>
              <p className="mt-1 text-sm text-slate-500">
                <Link href={`/empresa/${empresaId}/extratos`} className="hover:underline">
                  Ver extratos da empresa →
                </Link>
              </p>
            </div>

            {/* Controle de tempo de trabalho */}
            <div className="bg-white border border-slate-200 rounded-md p-3 min-w-[240px]">
              {sessaoAtiva ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                      Trabalhando agora
                    </p>
                  </div>
                  <p className="text-xl font-mono font-bold text-slate-900 tabular-nums">
                    {formatarDuracao(segundosSessaoAtiva)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Iniciado {new Date(sessaoAtiva.inicio_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <button
                    onClick={() => setModalPausaAberto(true)}
                    className="mt-2 w-full text-xs font-medium px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-amber-50 hover:border-amber-300 transition"
                  >
                    ⏸ Pausar trabalho
                  </button>
                </div>
              ) : (
                <div>
                  <p className="label-tiny">
                    Tempo no mês
                  </p>
                  <p className="text-xl font-mono font-bold text-slate-900 tabular-nums">
                    {formatarDuracao(segundosTotalMes)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {sessoesMes.length} sessão{sessoesMes.length === 1 ? '' : 'es'} em {competencia}
                  </p>
                  <button
                    onClick={iniciarTrabalho}
                    disabled={iniciando}
                    className="mt-2 w-full text-xs font-medium px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition"
                  >
                    {iniciando ? 'Iniciando...' : '▶ Iniciar trabalho'}
                  </button>
                </div>
              )}
              {sessaoAtiva && segundosTotalMes > segundosSessaoAtiva && (
                <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
                  Total no mês: <strong className="font-mono">{formatarDuracao(segundosTotalMes)}</strong>
                </p>
              )}
            </div>
          </div>
          {empresa.nao_envia_extratos && (
            <div className="mt-4 border border-amber-300 bg-amber-50 text-amber-900 rounded-md px-4 py-3 text-sm">
              <p className="font-semibold">Empresa não envia extratos regularmente</p>
              <p className="text-xs mt-0.5">
                Marcada em {empresa.marcado_em ? new Date(empresa.marcado_em).toLocaleDateString('pt-BR') : '—'}.
                {' '}Para alterar essa marcação, acesse{' '}
                <Link href={`/empresa/${empresaId}/extratos`} className="underline font-medium">
                  Extratos da empresa
                </Link>.
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
              return (
                <button
                  key={m.num}
                  onClick={() => setMes(m.num)}
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

        {aba === 'checklist' && (
        <div className="space-y-6">
          {/* Checklist */}
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
                                  const observacao = progresso?.observacao || '';
                                  const editando = obsEditandoId === etapa.id;
                                  return (
                                    <li key={etapa.id} className="px-2 py-1.5 rounded hover:bg-slate-50 group">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          id={`chk-${etapa.id}`}
                                          checked={feito}
                                          onChange={(e) => handleChecklistChange(etapa.id, e.target.checked)}
                                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                                        />
                                        <label
                                          htmlFor={`chk-${etapa.id}`}
                                          className={`text-sm flex-1 cursor-pointer ${
                                            feito ? 'text-slate-400 line-through' : 'text-slate-900'
                                          }`}
                                        >
                                          {etapa.nome}
                                        </label>
                                        {!editando && (
                                          <button
                                            type="button"
                                            onClick={() => abrirEdicaoObs(etapa.id, observacao)}
                                            title={observacao ? 'Editar observação' : 'Adicionar observação'}
                                            className={`text-slate-300 hover:text-slate-700 transition ${
                                              observacao ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                            }`}
                                          >
                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                          </button>
                                        )}
                                        {feito && progresso?.feito_em && !editando && (
                                          <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition">
                                            {new Date(progresso.feito_em).toLocaleDateString('pt-BR')}
                                          </span>
                                        )}
                                      </div>
                                      {editando ? (
                                        <div className="mt-1 ml-6">
                                          <textarea
                                            value={obsRascunho}
                                            onChange={(e) => setObsRascunho(e.target.value)}
                                            onBlur={fecharEdicaoObs}
                                            autoFocus
                                            rows={2}
                                            placeholder="Ex: falta conciliar PIS, IRPJ ainda não conferido..."
                                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y"
                                          />
                                          <p className="text-[10px] text-slate-400 mt-0.5">
                                            Clique fora para salvar.
                                          </p>
                                        </div>
                                      ) : observacao ? (
                                        <p
                                          className="mt-0.5 ml-6 text-[11px] text-amber-700 italic cursor-pointer hover:underline"
                                          onClick={() => abrirEdicaoObs(etapa.id, observacao)}
                                          title="Clique para editar"
                                        >
                                          ↳ {observacao}
                                        </p>
                                      ) : null}
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
        )}

        {aba === 'observacoes' && (
          <div className="space-y-6">
            {/* Observação geral */}
            <section className="bg-white border border-slate-200 rounded-md shadow-sm">
              <header className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                  Observação geral da empresa
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Notas permanentes sobre esta empresa, não vinculadas a um mês específico (contato preferencial, particularidades fiscais, contexto de negócio, etc.).
                </p>
              </header>
              <div className="p-5">
                <textarea
                  value={obsGeralTexto}
                  onChange={(e) => setObsGeralTexto(e.target.value)}
                  onBlur={salvarObservacaoGeral}
                  placeholder="Ex: Cliente prefere contato por WhatsApp. Possui 2 filiais que ainda não foram cadastradas. Pagamentos atrasam frequentemente..."
                  rows={8}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y"
                />
                <div className="mt-2 text-xs text-slate-500">
                  {salvandoObsGeral ? 'Salvando...' : 'Salva automaticamente ao sair do campo.'}
                </div>
              </div>
            </section>

            {/* Observação do mês — espelhada com a aba checklist */}
            <section className="bg-white border border-slate-200 rounded-md shadow-sm">
              <header className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                  Observação do mês · {competencia}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Específica para esta competência. Também aparece no fim da aba <strong>Checklist</strong>.
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
        )}
      </main>
      </div>

      {modalPausaAberto && sessaoAtiva && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                Pausar trabalho
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Sessão de <strong className="font-mono">{formatarDuracao(segundosSessaoAtiva)}</strong> · iniciada às {new Date(sessaoAtiva.inicio_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Motivo da pausa (opcional)
              </label>
              <textarea
                value={motivoPausa}
                onChange={(e) => setMotivoPausa(e.target.value)}
                placeholder="Ex: Cliente atrasou documentação · Almoço · Reunião · Empresa X é mais urgente..."
                rows={3}
                autoFocus
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y"
              />
              <p className="text-[11px] text-slate-400">
                Ajuda o coordenador a entender o fluxo de trabalho. Pode deixar em branco.
              </p>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setModalPausaAberto(false); setMotivoPausa(''); }}
                disabled={pausando}
                className="text-sm font-medium px-4 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarPausa}
                disabled={pausando}
                className="btn-primary"
              >
                {pausando ? 'Pausando...' : 'Confirmar pausa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
