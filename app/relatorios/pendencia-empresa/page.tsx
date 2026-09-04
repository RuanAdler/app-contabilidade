'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Empresa, Analista, BancoEmpresa, SolicitacaoExtrato } from '@/lib/types';

const NOMES_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  solicitado: 'Solicitado',
};

const STATUS_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  pendente: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  solicitado: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
};

function labelMes(competencia: string): string {
  const [ano, mes] = competencia.split('-');
  return `${NOMES_MES[parseInt(mes, 10) - 1]}/${ano.slice(2)}`;
}

function proximaCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const d = new Date(ano, mes, 1); // mes já é 1-indexado -> avança um mês
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function diasDesde(dataISO: string): number {
  const inicio = new Date(dataISO).getTime();
  return Math.max(0, Math.floor((Date.now() - inicio) / (1000 * 60 * 60 * 24)));
}

type PendenciaExtrato = {
  banco: BancoEmpresa;
  competencia: string;
  status: 'pendente' | 'solicitado';
  qtd_solicitacoes: number;
  ultima_solicitacao_em: string | null;
  desde: string; // ISO usado para calcular dias em aberto
  diasEmAberto: number;
};

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm text-slate-500">Carregando...</p></div>}>
      <RelatorioPendenciaEmpresa />
    </Suspense>
  );
}

function RelatorioPendenciaEmpresa() {
  const router = useRouter();
  const params = useSearchParams();
  const empresaId = params.get('empresa') || '';
  const hoje = new Date();
  const competenciaAtual = params.get('competencia') || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  const [loading, setLoading] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [analista, setAnalista] = useState<Analista | null>(null);
  const [bancos, setBancos] = useState<BancoEmpresa[]>([]);
  const [extratos, setExtratos] = useState<SolicitacaoExtrato[]>([]);
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
        .select('nome,email')
        .eq('email', session.user.email)
        .single();
      setGeradoPor(u?.nome || u?.email || '');
      setAutorizado(true);

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', empresaId)
        .single();
      if (!empresaData) {
        setLoading(false);
        return;
      }
      setEmpresa(empresaData);

      const { data: analistaData } = await supabase
        .from('analistas')
        .select('*')
        .eq('id', empresaData.analista_id)
        .single();
      setAnalista(analistaData);

      const { data: bancosData } = await supabase
        .from('bancos_empresa')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome_banco');
      const listaBancos = bancosData || [];
      setBancos(listaBancos);

      if (listaBancos.length > 0) {
        const { data: extratosData } = await supabase
          .from('solicitacoes_extrato')
          .select('*')
          .in('banco_id', listaBancos.map((b) => b.id));
        setExtratos(extratosData || []);
      }

      setLoading(false);
    };
    carregar();
  }, [router, empresaId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-slate-500">Carregando relatório...</p>
      </div>
    );
  }

  if (!autorizado) return null;

  if (!empresa) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-slate-500">Empresa não encontrada.</p>
      </div>
    );
  }

  // ==== Monta o histórico completo de competências relevantes (sem limite de meses) ====
  const competenciasComDados = extratos.map((e) => e.competencia).sort();
  const competenciaInicial = competenciasComDados[0] || `${hoje.getFullYear()}-01`;

  const todasCompetencias: string[] = [];
  let cursor = competenciaInicial;
  while (cursor <= competenciaAtual) {
    todasCompetencias.push(cursor);
    cursor = proximaCompetencia(cursor);
  }

  const extratoPorBancoCompetencia: Record<string, SolicitacaoExtrato> = {};
  extratos.forEach((e) => { extratoPorBancoCompetencia[`${e.banco_id}__${e.competencia}`] = e; });

  const pendencias: PendenciaExtrato[] = [];
  for (const banco of bancos) {
    for (const competencia of todasCompetencias) {
      const registro = extratoPorBancoCompetencia[`${banco.id}__${competencia}`];
      const status = registro?.status;
      if (status === 'recebido' || status === 'importado') continue;
      const statusFinal: 'pendente' | 'solicitado' = status === 'solicitado' ? 'solicitado' : 'pendente';
      const desde = registro?.created_at || `${competencia}-01`;
      pendencias.push({
        banco,
        competencia,
        status: statusFinal,
        qtd_solicitacoes: registro?.qtd_solicitacoes || 0,
        ultima_solicitacao_em: registro?.ultima_solicitacao_em || null,
        desde,
        diasEmAberto: diasDesde(desde),
      });
    }
  }
  pendencias.sort((a, b) => b.diasEmAberto - a.diasEmAberto);

  const totalPendencias = pendencias.length;
  const maisAntigaDias = pendencias[0]?.diasEmAberto || 0;
  const bancosComPendencia = new Set(pendencias.map((p) => p.banco.id)).size;
  const totalCobrancas = pendencias.reduce((acc, p) => acc + p.qtd_solicitacoes, 0);

  const extratosMesAtual = bancos.filter((b) => {
    const r = extratoPorBancoCompetencia[`${b.id}__${competenciaAtual}`];
    return r?.status === 'recebido' || r?.status === 'importado';
  }).length;

  // Agrupado por banco, para exibição
  const pendenciasPorBanco = bancos
    .map((b) => ({ banco: b, itens: pendencias.filter((p) => p.banco.id === b.id).sort((a, c) => a.competencia.localeCompare(c.competencia)) }))
    .filter((g) => g.itens.length > 0);

  const bannerClasse = totalPendencias > 0
    ? { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' }
    : { bg: '#d1fae5', border: '#6ee7b7', text: '#065f46' };

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

          {/* Barra superior escura */}
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
              <p className="text-xs font-medium">Pendências de Extratos</p>
            </div>
          </div>

          <div className="px-8 py-7 print:px-6 print:py-4">

            {/* Título e identificação da empresa */}
            <header className="mb-6 print-avoid-break">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Relatório de pendências contábeis
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900 leading-tight">
                {empresa.nome}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {empresa.cnpj ? `CNPJ ${empresa.cnpj} · ` : ''}
                Analista: {analista?.nome || '—'} · Emitido em {new Date().toLocaleDateString('pt-BR')} por {geradoPor}
              </p>
            </header>

            {/* Faixa de alerta */}
            <section
              className="mb-6 border rounded px-4 py-3 print-avoid-break"
              style={{ backgroundColor: bannerClasse.bg, borderColor: bannerClasse.border, color: bannerClasse.text }}
            >
              <p className="text-sm font-bold">
                {totalPendencias > 0
                  ? `${totalPendencias} pendência${totalPendencias === 1 ? '' : 's'} de extrato ${totalPendencias === 1 ? 'impede' : 'impedem'} o fechamento`
                  : 'Nenhuma pendência de extrato — apto para fechamento'}
              </p>
              {totalPendencias > 0 && (
                <p className="text-xs mt-0.5 opacity-90">
                  Extratos em aberto de {competenciasComDados.length > 0 ? labelMes(competenciaInicial) : labelMes(competenciaAtual)} até {labelMes(competenciaAtual)}.
                </p>
              )}
            </section>

            {/* Cards de resumo */}
            <section className="mb-7 print-avoid-break">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-3">
                Resumo
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-2.5">
                <div className="border border-slate-300 rounded p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Em aberto</p>
                  <p className="text-2xl font-bold text-slate-900">{totalPendencias}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">extratos pendentes</p>
                </div>
                <div className="border border-slate-300 rounded p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Mais antiga</p>
                  <p className="text-2xl font-bold text-red-700">{maisAntigaDias}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">dias em aberto</p>
                </div>
                <div className="border border-slate-300 rounded p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Bancos afetados</p>
                  <p className="text-2xl font-bold text-amber-700">{bancosComPendencia}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">de {bancos.length} banco{bancos.length === 1 ? '' : 's'}</p>
                </div>
                <div className="border border-slate-300 rounded p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Extratos · {labelMes(competenciaAtual)}</p>
                  <p className="text-2xl font-bold text-slate-900">{extratosMesAtual}/{bancos.length}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{totalCobrancas} cobrança{totalCobrancas === 1 ? '' : 's'} no total</p>
                </div>
              </div>
            </section>

            {/* Detalhamento completo, por banco */}
            <section>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-3">
                Detalhamento das pendências ({totalPendencias})
              </h2>
              {pendenciasPorBanco.length === 0 ? (
                <p className="text-sm py-8 text-center border border-slate-200 rounded" style={{ backgroundColor: '#d1fae5', borderColor: '#6ee7b7', color: '#065f46' }}>
                  Todos os extratos foram recebidos. Nenhuma pendência registrada.
                </p>
              ) : (
                <div className="border border-slate-300 rounded overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: '#0f172a' }}>
                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">Banco</th>
                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">Competência</th>
                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">Status</th>
                        <th className="text-center px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">Dias em aberto</th>
                        <th className="text-center px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">Cobranças</th>
                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-white">Última cobrança</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendenciasPorBanco.map((grupo) => (
                        <React.Fragment key={grupo.banco.id}>
                          <tr className="print-avoid-break" style={{ backgroundColor: '#f8fafc' }}>
                            <td colSpan={6} className="px-3 py-2 border-t border-slate-200">
                              <span className="font-bold text-slate-900 text-sm">{grupo.banco.nome_banco}</span>
                              <span className="ml-2 text-[10px] text-slate-500 uppercase tracking-wider">
                                {grupo.itens.length} pendente{grupo.itens.length === 1 ? '' : 's'}
                              </span>
                            </td>
                          </tr>
                          {grupo.itens.map((p, idx) => (
                            <tr key={`${grupo.banco.id}-${p.competencia}`} style={idx % 2 === 1 ? { backgroundColor: '#fcfcfd' } : undefined}>
                              <td className="px-3 py-2 border-t border-slate-100 text-slate-400 pl-6">—</td>
                              <td className="px-3 py-2 border-t border-slate-100 text-slate-900 font-medium">{labelMes(p.competencia)}</td>
                              <td className="px-3 py-2 border-t border-slate-100">
                                <span
                                  className="inline-block px-2 py-0.5 rounded text-[11px] font-bold border"
                                  style={{
                                    backgroundColor: STATUS_BADGE[p.status]?.bg,
                                    color: STATUS_BADGE[p.status]?.text,
                                    borderColor: STATUS_BADGE[p.status]?.border,
                                  }}
                                >
                                  {STATUS_LABEL[p.status]}
                                </span>
                              </td>
                              <td className="px-3 py-2 border-t border-slate-100 text-center font-semibold text-slate-900">
                                {p.diasEmAberto}
                              </td>
                              <td className="px-3 py-2 border-t border-slate-100 text-center text-slate-700">
                                {p.qtd_solicitacoes}×
                              </td>
                              <td className="px-3 py-2 border-t border-slate-100 text-slate-700">
                                {p.ultima_solicitacao_em ? new Date(p.ultima_solicitacao_em).toLocaleDateString('pt-BR') : '—'}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-[10px] text-slate-500">
                Considera todo o histórico desde o primeiro registro de extrato desta empresa ({labelMes(competenciaInicial)}) até {labelMes(competenciaAtual)}. Meses sem nenhum registro de solicitação também contam como pendência.
              </p>
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
