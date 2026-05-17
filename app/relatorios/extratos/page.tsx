'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Empresa, Analista, BancoEmpresa, SolicitacaoExtrato } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  solicitado: 'Solicitado',
  recebido: 'Recebido',
  importado: 'Importado',
};

const STATUS_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  pendente:   { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  solicitado: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  recebido:   { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  importado:  { bg: '#0f172a', text: '#ffffff', border: '#0f172a' },
};

type Linha = {
  empresa: Empresa;
  analista_nome: string;
  banco: BancoEmpresa;
  extrato: SolicitacaoExtrato | null;
};

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm text-slate-500">Carregando...</p></div>}>
      <RelatorioExtratos />
    </Suspense>
  );
}

function RelatorioExtratos() {
  const router = useRouter();
  const params = useSearchParams();
  const competencia = params.get('competencia') || '';
  const analistaFiltro = params.get('analista') || 'todos';
  const statusFiltro = params.get('status') || 'todos';
  const envioFiltro = params.get('envio') || 'todas';

  const [loading, setLoading] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
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

      const { data: analistasData } = await supabase
        .from('analistas')
        .select('*')
        .eq('cargo', 'analista')
        .order('nome');
      const listaAnalistas = analistasData || [];
      setAnalistas(listaAnalistas);

      const mapaAnalistas: Record<string, string> = {};
      listaAnalistas.forEach((a) => { mapaAnalistas[a.id] = a.nome; });

      let qEmpresas = supabase.from('empresas').select('*').eq('status', 'ativa').order('nome');
      if (analistaFiltro !== 'todos') qEmpresas = qEmpresas.eq('analista_id', analistaFiltro);
      if (envioFiltro === 'regulares') qEmpresas = qEmpresas.eq('nao_envia_extratos', false);
      if (envioFiltro === 'nao_envia') qEmpresas = qEmpresas.eq('nao_envia_extratos', true);
      const { data: empresasData } = await qEmpresas;
      const empresas = empresasData || [];

      if (empresas.length === 0) {
        setLinhas([]);
        setLoading(false);
        return;
      }

      const empresasIds = empresas.map((e) => e.id);
      const { data: bancosData } = await supabase
        .from('bancos_empresa')
        .select('*')
        .in('empresa_id', empresasIds)
        .order('nome_banco');
      const bancos = bancosData || [];

      const bancosIds = bancos.map((b) => b.id);
      let extratos: SolicitacaoExtrato[] = [];
      if (bancosIds.length > 0) {
        const { data } = await supabase
          .from('solicitacoes_extrato')
          .select('*')
          .in('banco_id', bancosIds)
          .eq('competencia', competencia);
        extratos = data || [];
      }
      const extratoPorBanco: Record<string, SolicitacaoExtrato> = {};
      extratos.forEach((e) => { extratoPorBanco[e.banco_id] = e; });

      const linhasGeradas: Linha[] = [];
      for (const empresa of empresas) {
        const bancosEmp = bancos.filter((b) => b.empresa_id === empresa.id);
        if (bancosEmp.length === 0) {
          // Empresa sem bancos: cria uma linha "marcadora" sem banco/extrato
          if (statusFiltro === 'todos') {
            linhasGeradas.push({
              empresa,
              analista_nome: mapaAnalistas[empresa.analista_id] || '—',
              banco: { id: '__sem_bancos__', empresa_id: empresa.id, nome_banco: '', created_at: '' },
              extrato: null,
            });
          }
          continue;
        }
        for (const banco of bancosEmp) {
          const extrato = extratoPorBanco[banco.id] || null;
          const status = extrato?.status || 'pendente';
          if (statusFiltro !== 'todos' && status !== statusFiltro) continue;
          linhasGeradas.push({
            empresa,
            analista_nome: mapaAnalistas[empresa.analista_id] || '—',
            banco,
            extrato,
          });
        }
      }
      setLinhas(linhasGeradas);
      setLoading(false);
    };
    carregar();
  }, [router, competencia, analistaFiltro, statusFiltro, envioFiltro]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-slate-500">Carregando relatório...</p>
      </div>
    );
  }

  if (!autorizado) return null;

  const linhasComBanco = linhas.filter((l) => l.banco.id !== '__sem_bancos__');
  const semBancosCount = linhas.length - linhasComBanco.length;
  const totalLinhas = linhasComBanco.length;
  const recebidos = linhasComBanco.filter((l) => l.extrato?.status === 'recebido' || l.extrato?.status === 'importado').length;
  const solicitados = linhasComBanco.filter((l) => l.extrato?.status === 'solicitado').length;
  const pendentes = totalLinhas - recebidos - solicitados;
  const percentRecebidos = totalLinhas > 0 ? Math.round((recebidos / totalLinhas) * 100) : 0;

  const nomeAnalistaFiltro =
    analistaFiltro === 'todos'
      ? 'Todos os analistas'
      : analistas.find((a) => a.id === analistaFiltro)?.nome || '—';

  // Agrupar por empresa para visualização
  const empresasNoRelatorio = Array.from(
    new Map(linhas.map((l) => [l.empresa.id, { empresa: l.empresa, analista_nome: l.analista_nome }])).values()
  );

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
              <p className="text-xs font-medium">Relatório de Extratos</p>
            </div>
          </div>

          <div className="px-8 py-7 print:px-6 print:py-4">

            {/* === Título do documento === */}
            <header className="mb-6 print-avoid-break">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Relatório mensal · {competencia}
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900 leading-tight">
                Extratos Bancários
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {empresasNoRelatorio.length} empresa{empresasNoRelatorio.length === 1 ? '' : 's'} · {totalLinhas} registro{totalLinhas === 1 ? '' : 's'} de banco
                {semBancosCount > 0 && (
                  <> · <span className="text-slate-500">{semBancosCount} sem banco cadastrado</span></>
                )}
              </p>
            </header>

            {/* === 2. Box de filtros aplicados === */}
            <section className="mb-6 bg-slate-50 border border-slate-200 rounded px-4 py-3 print-avoid-break">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Filtros aplicados
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-x-4 gap-y-1.5 text-xs">
                <div>
                  <span className="text-slate-500">Competência: </span>
                  <strong className="text-slate-900">{competencia}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Analista: </span>
                  <strong className="text-slate-900">{nomeAnalistaFiltro}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Status: </span>
                  <strong className="text-slate-900">
                    {statusFiltro === 'todos' ? 'Todos' : STATUS_LABEL[statusFiltro] || statusFiltro}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Empresas: </span>
                  <strong className="text-slate-900">
                    {envioFiltro === 'todas' ? 'Todas' : envioFiltro === 'regulares' ? 'Apenas regulares' : 'Apenas "não envia"'}
                  </strong>
                </div>
                <div className="md:col-span-2">
                  <span className="text-slate-500">Gerado em: </span>
                  <strong className="text-slate-900">{new Date().toLocaleString('pt-BR')}</strong>
                </div>
                <div className="md:col-span-2">
                  <span className="text-slate-500">Gerado por: </span>
                  <strong className="text-slate-900">{geradoPor}</strong>
                </div>
              </div>
            </section>

            {/* === 3. Resumo com mini-gráfico de barras === */}
            <section className="mb-7 print-avoid-break">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-3">
                Distribuição geral
              </h2>

              {/* Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-2.5 mb-4">
                <div className="border border-slate-300 rounded p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total registros</p>
                  <p className="text-2xl font-bold text-slate-900">{totalLinhas}</p>
                </div>
                <div className="rounded p-3 border" style={{ backgroundColor: '#d1fae5', borderColor: '#6ee7b7' }}>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: '#065f46' }}>Recebidos</p>
                  <p className="text-2xl font-bold" style={{ color: '#065f46' }}>{recebidos}</p>
                </div>
                <div className="rounded p-3 border" style={{ backgroundColor: '#fef3c7', borderColor: '#fcd34d' }}>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: '#92400e' }}>Solicitados</p>
                  <p className="text-2xl font-bold" style={{ color: '#92400e' }}>{solicitados}</p>
                </div>
                <div className="rounded p-3 border" style={{ backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }}>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: '#334155' }}>Pendentes</p>
                  <p className="text-2xl font-bold" style={{ color: '#334155' }}>{pendentes}</p>
                </div>
              </div>

              {/* Barra horizontal proporcional */}
              {totalLinhas > 0 && (
                <div>
                  <div className="flex h-6 rounded overflow-hidden border border-slate-300">
                    {recebidos > 0 && (
                      <div
                        className="flex items-center justify-center text-[10px] font-bold"
                        style={{
                          width: `${(recebidos / totalLinhas) * 100}%`,
                          backgroundColor: '#10b981',
                          color: 'white',
                        }}
                      >
                        {recebidos / totalLinhas >= 0.08 && `${Math.round((recebidos / totalLinhas) * 100)}%`}
                      </div>
                    )}
                    {solicitados > 0 && (
                      <div
                        className="flex items-center justify-center text-[10px] font-bold"
                        style={{
                          width: `${(solicitados / totalLinhas) * 100}%`,
                          backgroundColor: '#f59e0b',
                          color: 'white',
                        }}
                      >
                        {solicitados / totalLinhas >= 0.08 && `${Math.round((solicitados / totalLinhas) * 100)}%`}
                      </div>
                    )}
                    {pendentes > 0 && (
                      <div
                        className="flex items-center justify-center text-[10px] font-bold"
                        style={{
                          width: `${(pendentes / totalLinhas) * 100}%`,
                          backgroundColor: '#94a3b8',
                          color: 'white',
                        }}
                      >
                        {pendentes / totalLinhas >= 0.08 && `${Math.round((pendentes / totalLinhas) * 100)}%`}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: '#10b981' }} />
                      Recebidos & Importados
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />
                      Solicitados
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: '#94a3b8' }} />
                      Pendentes
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* === 4 & 5. Tabela com agrupamento por empresa === */}
            <section>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-3">
                Detalhamento por empresa
              </h2>
              {linhas.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center border border-slate-200 rounded">
                  Nenhum registro encontrado para os filtros selecionados.
                </p>
              ) : (
                <div className="border border-slate-300 rounded overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: '#0f172a' }}>
                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">
                          Banco
                        </th>
                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">
                          Status
                        </th>
                        <th className="text-center px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">
                          Cobranças
                        </th>
                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">
                          Última cobrança
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {empresasNoRelatorio.map((empInfo) => {
                        const linhasDaEmpresa = linhas.filter((l) => l.empresa.id === empInfo.empresa.id);
                        return (
                          <React.Fragment key={empInfo.empresa.id}>
                            <tr className="print-avoid-break" style={{ backgroundColor: '#f8fafc' }}>
                              <td colSpan={4} className="px-3 py-2 border-t border-slate-200">
                                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                                  <span className="font-bold text-slate-900 text-sm">
                                    {empInfo.empresa.nome}
                                    {empInfo.empresa.nao_envia_extratos && (
                                      <span
                                        className="ml-2 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border align-middle"
                                        style={{ backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }}
                                      >
                                        ⚑ NÃO ENVIA
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                                    Analista: <strong className="text-slate-700">{empInfo.analista_nome}</strong>
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {linhasDaEmpresa.map((l, idx) => {
                              if (l.banco.id === '__sem_bancos__') {
                                return (
                                  <tr key={`${empInfo.empresa.id}-sem`}>
                                    <td
                                      colSpan={4}
                                      className="px-3 py-2 border-t border-slate-100 text-slate-400 italic text-xs pl-6"
                                    >
                                      Sem bancos cadastrados para esta empresa.
                                    </td>
                                  </tr>
                                );
                              }
                              const status = l.extrato?.status || 'pendente';
                              const ehZebra = idx % 2 === 1;
                              return (
                                <tr
                                  key={`${empInfo.empresa.id}-${idx}`}
                                  style={ehZebra ? { backgroundColor: '#fcfcfd' } : undefined}
                                >
                                  <td className="px-3 py-2 border-t border-slate-100 text-slate-700 pl-6">
                                    {l.banco.nome_banco}
                                  </td>
                                  <td className="px-3 py-2 border-t border-slate-100">
                                    <span
                                      className="inline-block px-2 py-0.5 rounded text-[11px] font-bold border"
                                      style={{
                                        backgroundColor: STATUS_BADGE[status]?.bg,
                                        color: STATUS_BADGE[status]?.text,
                                        borderColor: STATUS_BADGE[status]?.border,
                                      }}
                                    >
                                      {STATUS_LABEL[status] || status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 border-t border-slate-100 text-center text-slate-700 font-medium">
                                    {l.extrato?.qtd_solicitacoes || 0}×
                                  </td>
                                  <td className="px-3 py-2 border-t border-slate-100 text-slate-700">
                                    {l.extrato?.ultima_solicitacao_em
                                      ? new Date(l.extrato.ultima_solicitacao_em).toLocaleDateString('pt-BR')
                                      : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
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
