'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Empresa, Analista, BancoEmpresa, SolicitacaoExtrato, ProgressoChecklist, TarefaEmpresa,
} from '@/lib/types';

function competenciasAnteriores(qtd: number, base: string): string[] {
  const [anoStr, mesStr] = base.split('-');
  const d = new Date(parseInt(anoStr), parseInt(mesStr) - 1, 1);
  const lista: string[] = [];
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

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm text-slate-500">Carregando...</p></div>}>
      <RelatorioAnalista />
    </Suspense>
  );
}

function RelatorioAnalista() {
  const router = useRouter();
  const params = useSearchParams();
  const analistaId = params.get('analista') || '';
  const competencia = params.get('competencia') || '';

  const [loading, setLoading] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [analista, setAnalista] = useState<Analista | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [bancos, setBancos] = useState<BancoEmpresa[]>([]);
  const [extratos, setExtratos] = useState<SolicitacaoExtrato[]>([]);
  const [extratos6m, setExtratos6m] = useState<SolicitacaoExtrato[]>([]);
  const [checklist, setChecklist] = useState<ProgressoChecklist[]>([]);
  const [checklist6m, setChecklist6m] = useState<ProgressoChecklist[]>([]);
  const [tarefas, setTarefas] = useState<TarefaEmpresa[]>([]);
  const [totalEtapas, setTotalEtapas] = useState(0);
  const [geradoPor, setGeradoPor] = useState('');

  useEffect(() => {
    const carregar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const { data: u } = await supabase
        .from('analistas')
        .select('cargo,nome,email')
        .eq('email', session.user.email)
        .single();
      if (u?.cargo !== 'coordenador') {
        router.push('/dashboard-analista');
        return;
      }
      setGeradoPor(u?.nome || u?.email || '');
      setAutorizado(true);

      const { data: analistaData } = await supabase
        .from('analistas')
        .select('*')
        .eq('id', analistaId)
        .single();
      if (!analistaData) {
        setLoading(false);
        return;
      }
      setAnalista(analistaData);

      const { data: empresasData } = await supabase
        .from('empresas')
        .select('*')
        .eq('analista_id', analistaId)
        .eq('status', 'ativa')
        .order('nome');
      const listaEmpresas = empresasData || [];
      setEmpresas(listaEmpresas);

      if (listaEmpresas.length === 0) {
        setLoading(false);
        return;
      }
      const empresasIds = listaEmpresas.map((e) => e.id);

      const { data: bancosData } = await supabase
        .from('bancos_empresa')
        .select('*')
        .in('empresa_id', empresasIds);
      const listaBancos = bancosData || [];
      setBancos(listaBancos);

      const competencias6m = competenciasAnteriores(6, competencia);
      const bancosIds = listaBancos.map((b) => b.id);
      if (bancosIds.length > 0) {
        const { data: extData } = await supabase
          .from('solicitacoes_extrato')
          .select('*')
          .in('banco_id', bancosIds)
          .in('competencia', competencias6m);
        const todos = extData || [];
        setExtratos6m(todos);
        setExtratos(todos.filter((e) => e.competencia === competencia));
      }

      const { data: checklistData } = await supabase
        .from('progresso_checklist')
        .select('*')
        .in('empresa_id', empresasIds)
        .in('competencia', competencias6m);
      const todosCheck = checklistData || [];
      setChecklist6m(todosCheck);
      setChecklist(todosCheck.filter((c) => c.competencia === competencia));

      const { data: tarefasData } = await supabase
        .from('tarefas_empresa')
        .select('*')
        .in('empresa_id', empresasIds)
        .eq('competencia', competencia);
      setTarefas(tarefasData || []);

      const { count: countEtapas } = await supabase
        .from('etapas_checklist')
        .select('*', { count: 'exact', head: true });
      setTotalEtapas(countEtapas || 0);

      setLoading(false);
    };
    carregar();
  }, [router, analistaId, competencia]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-slate-500">Carregando relatório...</p>
      </div>
    );
  }

  if (!autorizado) return null;

  if (!analista) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-slate-500">Analista não encontrado.</p>
      </div>
    );
  }

  const competencias6m = competenciasAnteriores(6, competencia);
  const HOJE_STR = new Date().toISOString().slice(0, 10);

  const percentualBalanco = (empresaId: string, comp: string) => {
    if (totalEtapas === 0) return 0;
    const feitos = checklist6m.filter(
      (c) => c.empresa_id === empresaId && c.competencia === comp && c.feito_em
    ).length;
    return Math.round((feitos / totalEtapas) * 100);
  };

  // Stats do mês escolhido
  const concluidos = empresas.filter((e) => percentualBalanco(e.id, competencia) === 100).length;
  const empresasEmAndamento = empresas.filter((e) => {
    const p = percentualBalanco(e.id, competencia);
    return p > 0 && p < 100;
  });
  const emAndamento = empresasEmAndamento.length;
  const empresasConcluidas = empresas.filter((e) => percentualBalanco(e.id, competencia) === 100);
  const empresasNaoIniciadas = empresas.filter((e) => percentualBalanco(e.id, competencia) === 0);
  const naoIniciados = empresasNaoIniciadas.length;
  const percentConcluidos = empresas.length > 0 ? Math.round((concluidos / empresas.length) * 100) : 0;

  // Extratos do mês
  const totalBancos = bancos.length;
  const bancosRecebidos = bancos.filter((b) => {
    const e = extratos.find((x) => x.banco_id === b.id);
    return e && (e.status === 'recebido' || e.status === 'importado');
  }).length;
  const percentExtratos = totalBancos > 0 ? Math.round((bancosRecebidos / totalBancos) * 100) : 0;

  // Histórico
  const historico = competencias6m.map((c) => ({
    competencia: c,
    percentual: empresas.length > 0
      ? Math.round(
          (empresas.filter((e) => percentualBalanco(e.id, c) === 100).length / empresas.length) * 100
        )
      : 0,
  }));

  // Empresas em atenção
  const atencoes = empresas
    .map((emp) => {
      const bs = bancos.filter((b) => b.empresa_id === emp.id);
      let maxSolicitacoes = 0;
      let bancosAbertos = 0;
      for (const b of bs) {
        const e = extratos.find((x) => x.banco_id === b.id);
        if (e) {
          if ((e.qtd_solicitacoes || 0) > maxSolicitacoes) maxSolicitacoes = e.qtd_solicitacoes || 0;
          if (e.status !== 'recebido' && e.status !== 'importado') bancosAbertos++;
        } else {
          bancosAbertos++;
        }
      }
      let motivo = '';
      if (emp.nao_envia_extratos) motivo = 'Não envia extratos';
      else if (maxSolicitacoes >= 3 && bancosAbertos > 0) motivo = `${maxSolicitacoes}× solicitado sem retorno`;
      else if (bancosAbertos > 0 && maxSolicitacoes >= 2) motivo = `${maxSolicitacoes}× solicitado, ainda pendente`;
      return { empresa: emp, motivo };
    })
    .filter((x) => x.motivo);

  // Tarefas atrasadas
  const tarefasAtrasadas = tarefas.filter((t) => !t.feita && t.prazo && t.prazo < HOJE_STR);
  const tarefasFeitas = tarefas.filter((t) => t.feita).length;

  const empresaPorId: Record<string, Empresa> = {};
  empresas.forEach((e) => { empresaPorId[e.id] = e; });

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Barra de ações — não imprime */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => window.close()}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Fechar
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir / Salvar como PDF
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 print:p-0 print:max-w-none">
        <div className="bg-white print:bg-transparent border border-slate-200 print:border-0 rounded-md print:rounded-none shadow-sm print:shadow-none overflow-hidden print:overflow-visible">

          {/* === 1. Barra superior escura (identidade) === */}
          <div className="bg-slate-900 text-white px-8 py-3 print:px-6 flex items-center justify-between print-avoid-break">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center h-8 w-8 bg-white rounded">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Controle Contábil" className="h-full w-full object-contain p-0.5" />
              </span>
              <div>
                <p className="text-sm font-bold tracking-tight leading-tight">Controle Contábil</p>
                <p className="text-[9px] uppercase tracking-[0.15em] opacity-70">Sistema interno</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-[0.15em] opacity-70">Documento</p>
              <p className="text-xs font-medium">Desempenho Individual</p>
            </div>
          </div>

          <div className="px-8 py-7 print:px-6 print:py-4">

            {/* === Título === */}
            <header className="mb-6 print-avoid-break">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Relatório de desempenho · {competencia}
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900 leading-tight">
                {analista.nome}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {empresas.length} empresa{empresas.length === 1 ? '' : 's'} na carteira · {analista.email}
              </p>
            </header>

            {/* === 2. Box de filtros aplicados === */}
            <section className="mb-6 bg-slate-50 border border-slate-200 rounded px-4 py-3 print-avoid-break">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Parâmetros
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-x-4 gap-y-1.5 text-xs">
                <div>
                  <span className="text-slate-500">Analista: </span>
                  <strong className="text-slate-900">{analista.nome}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Competência: </span>
                  <strong className="text-slate-900">{competencia}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Gerado em: </span>
                  <strong className="text-slate-900">{new Date().toLocaleString('pt-BR')}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Gerado por: </span>
                  <strong className="text-slate-900">{geradoPor}</strong>
                </div>
              </div>
            </section>

            {/* === 3. Resumo com mini-gráfico === */}
            <section className="mb-7 print-avoid-break">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-3">
                Resumo do mês
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-2.5 mb-4">
                <div className="border border-slate-300 rounded p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Carteira</p>
                  <p className="text-2xl font-bold text-slate-900">{empresas.length}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">empresas ativas</p>
                </div>
                <div className="border border-slate-300 rounded p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Balanços</p>
                  <p className="text-2xl font-bold text-emerald-700">{percentConcluidos}%</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{concluidos} de {empresas.length}</p>
                </div>
                <div className="border border-slate-300 rounded p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Extratos</p>
                  <p className="text-2xl font-bold text-emerald-700">{percentExtratos}%</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{bancosRecebidos} de {totalBancos} bancos</p>
                </div>
                <div className="border border-slate-300 rounded p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Em atenção</p>
                  <p className="text-2xl font-bold text-amber-700">{atencoes.length}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">empresas</p>
                </div>
              </div>

              {/* Barra horizontal proporcional dos balanços */}
              {empresas.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Distribuição dos balanços</p>
                  <div className="flex h-6 rounded overflow-hidden border border-slate-300">
                    {concluidos > 0 && (
                      <div
                        className="flex items-center justify-center text-[10px] font-bold"
                        style={{
                          width: `${(concluidos / empresas.length) * 100}%`,
                          backgroundColor: '#10b981',
                          color: 'white',
                        }}
                      >
                        {concluidos / empresas.length >= 0.08 && `${Math.round((concluidos / empresas.length) * 100)}%`}
                      </div>
                    )}
                    {emAndamento > 0 && (
                      <div
                        className="flex items-center justify-center text-[10px] font-bold"
                        style={{
                          width: `${(emAndamento / empresas.length) * 100}%`,
                          backgroundColor: '#f59e0b',
                          color: 'white',
                        }}
                      >
                        {emAndamento / empresas.length >= 0.08 && `${Math.round((emAndamento / empresas.length) * 100)}%`}
                      </div>
                    )}
                    {naoIniciados > 0 && (
                      <div
                        className="flex items-center justify-center text-[10px] font-bold"
                        style={{
                          width: `${(naoIniciados / empresas.length) * 100}%`,
                          backgroundColor: '#ef4444',
                          color: 'white',
                        }}
                      >
                        {naoIniciados / empresas.length >= 0.08 && `${Math.round((naoIniciados / empresas.length) * 100)}%`}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: '#10b981' }} />
                      Concluídos ({concluidos})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />
                      Em andamento ({emAndamento})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
                      Não iniciados ({naoIniciados})
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* Evolução 6 meses */}
            <section className="mb-7 print-avoid-break">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-3">
                Evolução · últimos 6 meses
              </h2>
              <p className="text-xs text-slate-600 mb-3">% de empresas com balanço 100% concluído por mês.</p>
              <div className="grid grid-cols-6 gap-2">
                {historico.map((h) => (
                  <div key={h.competencia} className="text-center border border-slate-200 rounded p-2 bg-slate-50">
                    <div className="h-20 flex items-end justify-center mb-1">
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${Math.max(2, h.percentual)}%`,
                          backgroundColor: h.percentual >= 80 ? '#10b981' : h.percentual >= 50 ? '#f59e0b' : '#94a3b8',
                        }}
                      />
                    </div>
                    <p className="text-sm font-bold text-slate-900">{h.percentual}%</p>
                    <p className="text-[10px] text-slate-500 uppercase">{labelCurtoMes(h.competencia)}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Empresas da carteira agrupadas por status */}
            {empresas.length > 0 && (
              <section className="mb-7 print-avoid-break">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-3">
                  Empresas da carteira por status
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-3">
                  {/* Concluídos */}
                  <div className="border rounded overflow-hidden" style={{ borderColor: '#6ee7b7' }}>
                    <div className="px-3 py-2 flex items-baseline justify-between" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Concluídos</span>
                      <span className="text-sm font-bold">{empresasConcluidas.length}</span>
                    </div>
                    {empresasConcluidas.length === 0 ? (
                      <p className="px-3 py-2 text-[11px] text-slate-400 italic">Nenhuma.</p>
                    ) : (
                      <ul className="px-3 py-2 space-y-0.5">
                        {empresasConcluidas.map((e) => (
                          <li key={e.id} className="text-[11px] text-slate-700 leading-tight flex items-baseline gap-1">
                            <span style={{ color: '#10b981' }}>•</span>
                            <span className="break-words">
                              {e.nome}
                              {e.nao_envia_extratos && <span className="ml-1 text-amber-700" title="Não envia extratos">⚑</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Em andamento */}
                  <div className="border rounded overflow-hidden" style={{ borderColor: '#fcd34d' }}>
                    <div className="px-3 py-2 flex items-baseline justify-between" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Em andamento</span>
                      <span className="text-sm font-bold">{empresasEmAndamento.length}</span>
                    </div>
                    {empresasEmAndamento.length === 0 ? (
                      <p className="px-3 py-2 text-[11px] text-slate-400 italic">Nenhuma.</p>
                    ) : (
                      <ul className="px-3 py-2 space-y-0.5">
                        {empresasEmAndamento.map((e) => (
                          <li key={e.id} className="text-[11px] text-slate-700 leading-tight flex items-baseline gap-1">
                            <span style={{ color: '#f59e0b' }}>•</span>
                            <span className="break-words">
                              {e.nome}
                              {e.nao_envia_extratos && <span className="ml-1 text-amber-700" title="Não envia extratos">⚑</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Não iniciados */}
                  <div className="border rounded overflow-hidden" style={{ borderColor: '#fca5a5' }}>
                    <div className="px-3 py-2 flex items-baseline justify-between" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Não iniciados</span>
                      <span className="text-sm font-bold">{empresasNaoIniciadas.length}</span>
                    </div>
                    {empresasNaoIniciadas.length === 0 ? (
                      <p className="px-3 py-2 text-[11px] text-slate-400 italic">Nenhuma.</p>
                    ) : (
                      <ul className="px-3 py-2 space-y-0.5">
                        {empresasNaoIniciadas.map((e) => (
                          <li key={e.id} className="text-[11px] text-slate-700 leading-tight flex items-baseline gap-1">
                            <span style={{ color: '#ef4444' }}>•</span>
                            <span className="break-words">
                              {e.nome}
                              {e.nao_envia_extratos && <span className="ml-1 text-amber-700" title="Não envia extratos">⚑</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  <span className="text-amber-700">⚑</span> indica empresa marcada como "não envia extratos".
                </p>
              </section>
            )}

            {/* Empresas em atenção */}
            <section className="mb-7 print-avoid-break">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-3">
                Empresas que precisam de atenção ({atencoes.length})
              </h2>
              {atencoes.length === 0 ? (
                <p className="text-sm py-3 px-4 border rounded" style={{ backgroundColor: '#d1fae5', borderColor: '#6ee7b7', color: '#065f46' }}>
                  Nenhuma empresa em estado crítico no período.
                </p>
              ) : (
                <div className="border border-slate-300 rounded overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: '#0f172a' }}>
                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">
                          Empresa
                        </th>
                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">
                          Motivo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {atencoes.map((x, idx) => (
                        <tr key={idx} style={idx % 2 === 1 ? { backgroundColor: '#fcfcfd' } : undefined}>
                          <td className="px-3 py-2 border-t border-slate-100 text-slate-900 font-medium">{x.empresa.nome}</td>
                          <td className="px-3 py-2 border-t border-slate-100 text-slate-700">{x.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Tarefas */}
            <section className="mb-7 print-avoid-break">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-3">
                Tarefas do mês ({tarefas.length})
              </h2>
              <p className="text-xs text-slate-600 mb-3">
                {tarefasFeitas} concluída{tarefasFeitas === 1 ? '' : 's'} · {tarefas.length - tarefasFeitas} pendente{(tarefas.length - tarefasFeitas) === 1 ? '' : 's'}
                {tarefasAtrasadas.length > 0 && <span className="text-red-700 font-semibold"> · {tarefasAtrasadas.length} atrasada{tarefasAtrasadas.length === 1 ? '' : 's'}</span>}
              </p>
              {tarefas.length === 0 ? (
                <p className="text-sm text-slate-500 py-3 px-4 border border-slate-200 rounded">
                  Sem tarefas registradas para a competência.
                </p>
              ) : (
                <div className="border border-slate-300 rounded overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: '#0f172a' }}>
                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">
                          Empresa
                        </th>
                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">
                          Tarefa
                        </th>
                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">
                          Prazo
                        </th>
                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">
                          Situação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tarefas.map((t, idx) => {
                        const atrasada = !t.feita && t.prazo && t.prazo < HOJE_STR;
                        const emp = empresaPorId[t.empresa_id];
                        return (
                          <tr key={t.id} style={idx % 2 === 1 ? { backgroundColor: '#fcfcfd' } : undefined}>
                            <td className="px-3 py-2 border-t border-slate-100 text-slate-900 font-medium">{emp?.nome || '—'}</td>
                            <td className="px-3 py-2 border-t border-slate-100 text-slate-700">{t.titulo}</td>
                            <td className="px-3 py-2 border-t border-slate-100 text-slate-700">
                              {t.prazo ? new Date(t.prazo + 'T00:00').toLocaleDateString('pt-BR') : '—'}
                            </td>
                            <td className="px-3 py-2 border-t border-slate-100">
                              <span
                                className="inline-block px-2 py-0.5 rounded text-[11px] font-bold border"
                                style={
                                  t.feita
                                    ? { backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#6ee7b7' }
                                    : atrasada
                                    ? { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }
                                    : { backgroundColor: '#f1f5f9', color: '#334155', borderColor: '#cbd5e1' }
                                }
                              >
                                {t.feita ? 'Concluída' : atrasada ? 'Atrasada' : 'Pendente'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Rodapé */}
            <footer className="mt-10 pt-4 border-t-2 border-slate-900 text-xs text-slate-500 flex items-center justify-between gap-3 flex-wrap">
              <span>Documento interno — Controle Contábil.</span>
              <span>Gerado em {new Date().toLocaleString('pt-BR')}.</span>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
