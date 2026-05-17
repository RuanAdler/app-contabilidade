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
  const emAndamento = empresas.filter((e) => {
    const p = percentualBalanco(e.id, competencia);
    return p > 0 && p < 100;
  }).length;
  const naoIniciados = empresas.length - concluidos - emAndamento;
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
        <div className="bg-white print:bg-transparent border border-slate-200 print:border-0 rounded-md print:rounded-none shadow-sm print:shadow-none p-8 print:p-0">
          {/* Cabeçalho */}
          <header className="pb-6 border-b border-slate-300 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center h-12 w-12">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="Controle Contábil" className="h-full w-full object-contain" />
                </span>
                <div>
                  <p className="text-base font-bold text-slate-900 tracking-tight">Controle Contábil</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Documento interno</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Gerado em</p>
                <p className="text-sm text-slate-900 font-medium">
                  {new Date().toLocaleString('pt-BR')}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">por {geradoPor}</p>
              </div>
            </div>
            <h1 className="mt-6 text-2xl font-bold text-slate-900">
              Relatório Individual de Desempenho
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Analista: <strong>{analista.nome}</strong> · {analista.email} · Competência: <strong>{competencia}</strong>
            </p>
          </header>

          {/* Resumo */}
          <section className="mb-6 print-avoid-break">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Resumo do mês
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border border-slate-300 rounded p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Carteira</p>
                <p className="text-xl font-bold text-slate-900">{empresas.length}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">empresas ativas</p>
              </div>
              <div className="border border-slate-300 rounded p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Balanços concluídos</p>
                <p className="text-xl font-bold text-emerald-700">{percentConcluidos}%</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{concluidos} de {empresas.length}</p>
              </div>
              <div className="border border-slate-300 rounded p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Extratos recebidos</p>
                <p className="text-xl font-bold text-emerald-700">{percentExtratos}%</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{bancosRecebidos} de {totalBancos} bancos</p>
              </div>
              <div className="border border-slate-300 rounded p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Em atenção</p>
                <p className="text-xl font-bold text-amber-700">{atencoes.length}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">empresas</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded p-2 border" style={{ backgroundColor: '#d1fae5', borderColor: '#6ee7b7' }}>
                <p className="font-bold text-base" style={{ color: '#065f46' }}>{concluidos}</p>
                <p className="uppercase tracking-wider text-[10px]" style={{ color: '#065f46' }}>Concluídos</p>
              </div>
              <div className="rounded p-2 border" style={{ backgroundColor: '#fef3c7', borderColor: '#fcd34d' }}>
                <p className="font-bold text-base" style={{ color: '#92400e' }}>{emAndamento}</p>
                <p className="uppercase tracking-wider text-[10px]" style={{ color: '#92400e' }}>Em andamento</p>
              </div>
              <div className="rounded p-2 border" style={{ backgroundColor: '#fee2e2', borderColor: '#fca5a5' }}>
                <p className="font-bold text-base" style={{ color: '#991b1b' }}>{naoIniciados}</p>
                <p className="uppercase tracking-wider text-[10px]" style={{ color: '#991b1b' }}>Não iniciados</p>
              </div>
            </div>
          </section>

          {/* Evolução 6 meses */}
          <section className="mb-6 print-avoid-break">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Evolução · últimos 6 meses
            </h2>
            <p className="text-xs text-slate-600 mb-2">% de empresas com balanço 100% concluído por mês.</p>
            <div className="grid grid-cols-6 gap-2">
              {historico.map((h) => (
                <div key={h.competencia} className="text-center border border-slate-200 rounded p-2">
                  <div className="h-20 flex items-end justify-center mb-1">
                    <div
                      className="w-full rounded-t bg-slate-700"
                      style={{ height: `${Math.max(2, h.percentual)}%` }}
                    />
                  </div>
                  <p className="text-sm font-bold text-slate-900">{h.percentual}%</p>
                  <p className="text-[10px] text-slate-500 uppercase">{labelCurtoMes(h.competencia)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Empresas em atenção */}
          <section className="mb-6 print-avoid-break">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Empresas que precisam de atenção ({atencoes.length})
            </h2>
            {atencoes.length === 0 ? (
              <p className="text-sm text-slate-500 py-3 px-4 border border-emerald-200 bg-emerald-50 rounded">
                Nenhuma empresa em estado crítico no período.
              </p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-3 py-2 font-bold text-[10px] uppercase tracking-wider text-slate-700 border border-slate-300">
                      Empresa
                    </th>
                    <th className="text-left px-3 py-2 font-bold text-[10px] uppercase tracking-wider text-slate-700 border border-slate-300">
                      Motivo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {atencoes.map((x, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 border border-slate-300 text-slate-900">{x.empresa.nome}</td>
                      <td className="px-3 py-2 border border-slate-300 text-slate-700">{x.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Tarefas */}
          <section className="mb-6 print-avoid-break">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Tarefas do mês ({tarefas.length})
            </h2>
            <p className="text-xs text-slate-600 mb-2">
              {tarefasFeitas} concluída{tarefasFeitas === 1 ? '' : 's'} · {tarefas.length - tarefasFeitas} pendente{(tarefas.length - tarefasFeitas) === 1 ? '' : 's'}
              {tarefasAtrasadas.length > 0 && <span className="text-red-700 font-semibold"> · {tarefasAtrasadas.length} atrasada{tarefasAtrasadas.length === 1 ? '' : 's'}</span>}
            </p>
            {tarefas.length === 0 ? (
              <p className="text-sm text-slate-500 py-3 px-4 border border-slate-200 rounded">
                Sem tarefas registradas para a competência.
              </p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-3 py-2 font-bold text-[10px] uppercase tracking-wider text-slate-700 border border-slate-300">
                      Empresa
                    </th>
                    <th className="text-left px-3 py-2 font-bold text-[10px] uppercase tracking-wider text-slate-700 border border-slate-300">
                      Tarefa
                    </th>
                    <th className="text-left px-3 py-2 font-bold text-[10px] uppercase tracking-wider text-slate-700 border border-slate-300">
                      Prazo
                    </th>
                    <th className="text-left px-3 py-2 font-bold text-[10px] uppercase tracking-wider text-slate-700 border border-slate-300">
                      Situação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tarefas.map((t) => {
                    const atrasada = !t.feita && t.prazo && t.prazo < HOJE_STR;
                    const emp = empresaPorId[t.empresa_id];
                    return (
                      <tr key={t.id}>
                        <td className="px-3 py-2 border border-slate-300 text-slate-900">{emp?.nome || '—'}</td>
                        <td className="px-3 py-2 border border-slate-300 text-slate-700">{t.titulo}</td>
                        <td className="px-3 py-2 border border-slate-300 text-slate-700">
                          {t.prazo ? new Date(t.prazo + 'T00:00').toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-3 py-2 border border-slate-300">
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
            )}
          </section>

          {/* Rodapé */}
          <footer className="mt-8 pt-4 border-t border-slate-300 text-xs text-slate-500 flex items-center justify-between gap-3 flex-wrap">
            <span>Relatório gerado pelo sistema interno Controle Contábil.</span>
            <span>Página gerada em {new Date().toLocaleString('pt-BR')}.</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
