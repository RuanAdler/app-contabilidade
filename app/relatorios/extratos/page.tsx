'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Empresa, Analista, BancoEmpresa, SolicitacaoExtrato } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  solicitado: 'Solicitado',
  recebido: 'Recebido',
  importado: 'Importado',
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
          if (statusFiltro === 'todos' || statusFiltro === 'pendente') {
            linhasGeradas.push({
              empresa,
              analista_nome: mapaAnalistas[empresa.analista_id] || '—',
              banco: { id: '', empresa_id: empresa.id, nome_banco: '— Sem bancos cadastrados —', created_at: '' },
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

  const totalLinhas = linhas.length;
  const recebidos = linhas.filter((l) => l.extrato?.status === 'recebido' || l.extrato?.status === 'importado').length;
  const solicitados = linhas.filter((l) => l.extrato?.status === 'solicitado').length;
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
              Relatório Mensal de Extratos Bancários
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Competência: <strong>{competencia}</strong> · Analista: <strong>{nomeAnalistaFiltro}</strong>
              {statusFiltro !== 'todos' && (
                <> · Status: <strong>{STATUS_LABEL[statusFiltro] || statusFiltro}</strong></>
              )}
              {envioFiltro === 'regulares' && <> · Empresas: <strong>regulares</strong></>}
              {envioFiltro === 'nao_envia' && <> · Empresas: <strong>não envia extratos</strong></>}
            </p>
          </header>

          {/* Resumo */}
          <section className="mb-6 print-avoid-break">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Resumo
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border border-slate-300 rounded p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total registros</p>
                <p className="text-xl font-bold text-slate-900">{totalLinhas}</p>
              </div>
              <div className="border border-slate-300 rounded p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Recebidos</p>
                <p className="text-xl font-bold text-emerald-700">{recebidos}</p>
              </div>
              <div className="border border-slate-300 rounded p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Solicitados</p>
                <p className="text-xl font-bold text-amber-700">{solicitados}</p>
              </div>
              <div className="border border-slate-300 rounded p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Pendentes</p>
                <p className="text-xl font-bold text-slate-700">{pendentes}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-700">
              <strong>{percentRecebidos}%</strong> dos extratos foram efetivamente recebidos no período.
            </p>
          </section>

          {/* Tabela */}
          <section>
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Detalhamento ({empresasNoRelatorio.length} empresa{empresasNoRelatorio.length === 1 ? '' : 's'})
            </h2>
            {linhas.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center border border-slate-200 rounded">
                Nenhum registro encontrado para os filtros selecionados.
              </p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 print:bg-slate-100">
                    <th className="text-left px-3 py-2 font-bold text-[10px] uppercase tracking-wider text-slate-700 border border-slate-300">
                      Empresa
                    </th>
                    <th className="text-left px-3 py-2 font-bold text-[10px] uppercase tracking-wider text-slate-700 border border-slate-300">
                      Analista
                    </th>
                    <th className="text-left px-3 py-2 font-bold text-[10px] uppercase tracking-wider text-slate-700 border border-slate-300">
                      Banco
                    </th>
                    <th className="text-left px-3 py-2 font-bold text-[10px] uppercase tracking-wider text-slate-700 border border-slate-300">
                      Status
                    </th>
                    <th className="text-center px-3 py-2 font-bold text-[10px] uppercase tracking-wider text-slate-700 border border-slate-300">
                      Cobranças
                    </th>
                    <th className="text-left px-3 py-2 font-bold text-[10px] uppercase tracking-wider text-slate-700 border border-slate-300">
                      Última cobrança
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, idx) => {
                    const status = l.extrato?.status || 'pendente';
                    return (
                      <tr key={idx} className="break-inside-avoid">
                        <td className="px-3 py-2 border border-slate-300 align-top">
                          <span className="text-slate-900 font-medium">{l.empresa.nome}</span>
                          {l.empresa.nao_envia_extratos && (
                            <span className="ml-2 text-[10px] text-amber-700 font-medium">⚑ não envia</span>
                          )}
                        </td>
                        <td className="px-3 py-2 border border-slate-300 align-top text-slate-700">
                          {l.analista_nome}
                        </td>
                        <td className="px-3 py-2 border border-slate-300 align-top text-slate-700">
                          {l.banco.nome_banco}
                        </td>
                        <td className="px-3 py-2 border border-slate-300 align-top">
                          <span className="font-medium">{STATUS_LABEL[status] || status}</span>
                        </td>
                        <td className="px-3 py-2 border border-slate-300 align-top text-center text-slate-700">
                          {l.extrato?.qtd_solicitacoes || 0}×
                        </td>
                        <td className="px-3 py-2 border border-slate-300 align-top text-slate-700">
                          {l.extrato?.ultima_solicitacao_em
                            ? new Date(l.extrato.ultima_solicitacao_em).toLocaleDateString('pt-BR')
                            : '—'}
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
