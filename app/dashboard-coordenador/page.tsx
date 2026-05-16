'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Empresa, Analista, BancoEmpresa, SolicitacaoExtrato } from '@/lib/types';

type EmpresaComAnalista = Empresa & { analista_nome: string };
type FiltroEnvio = 'todas' | 'regulares' | 'nao_envia';
type StatusMes = 'sem_bancos' | 'concluido' | 'parcial' | 'pendente';

const hoje = new Date();
const COMPETENCIA_ATUAL = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
const NOME_MES = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

export default function DashboardCoordenador() {
  const [usuario, setUsuario] = useState<any>(null);
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaComAnalista[]>([]);
  const [bancos, setBancos] = useState<BancoEmpresa[]>([]);
  const [extratos, setExtratos] = useState<SolicitacaoExtrato[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroAnalista, setFiltroAnalista] = useState<string>('todos');
  const [filtroEnvio, setFiltroEnvio] = useState<FiltroEnvio>('todas');
  const [loading, setLoading] = useState(true);
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

      if (listaBancos.length > 0) {
        const { data: extratosData } = await supabase
          .from('solicitacoes_extrato')
          .select('*')
          .in('banco_id', listaBancos.map((b) => b.id))
          .eq('competencia', COMPETENCIA_ATUAL);
        setExtratos(extratosData || []);
      }

      setLoading(false);
    };

    checkAuth();
  }, [router]);

  // Mapas para cálculo de status do mês por empresa
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

  // Estatísticas por analista
  const statsPorAnalista = useMemo(() => {
    return analistas.map((a) => {
      const empresasDoAnalista = empresas.filter((e) => e.analista_id === a.id);
      const total = empresasDoAnalista.length;
      const naoEnvia = empresasDoAnalista.filter((e) => e.nao_envia_extratos).length;
      const elegives = empresasDoAnalista.filter((e) => !e.nao_envia_extratos);
      let concluidas = 0;
      let parciais = 0;
      let pendentes = 0;
      let semBancos = 0;
      for (const emp of elegives) {
        const s = statusMesDaEmpresa(emp.id);
        if (s === 'concluido') concluidas++;
        else if (s === 'parcial') parciais++;
        else if (s === 'pendente') pendentes++;
        else semBancos++;
      }
      const baseElegivel = elegives.length - semBancos;
      const percentConcluido = baseElegivel > 0 ? Math.round((concluidas / baseElegivel) * 100) : 0;
      return {
        analista: a,
        total,
        naoEnvia,
        concluidas,
        parciais,
        pendentes,
        semBancos,
        percentConcluido,
      };
    });
  }, [analistas, empresas, bancosPorEmpresa, extratoPorBanco]);

  // Empresas em atenção
  const empresasAtencao = useMemo(() => {
    return empresas
      .map((emp) => {
        const bs = bancosPorEmpresa[emp.id] || [];
        let maxSolicitacoes = 0;
        let bancosAbertos = 0;
        for (const b of bs) {
          const e = extratoPorBanco[b.id];
          if (e) {
            if ((e.qtd_solicitacoes || 0) > maxSolicitacoes) {
              maxSolicitacoes = e.qtd_solicitacoes || 0;
            }
            if (e.status !== 'recebido' && e.status !== 'importado') bancosAbertos++;
          } else {
            bancosAbertos++;
          }
        }
        const status = statusMesDaEmpresa(emp.id);
        let motivo = '';
        let prioridade = 0;
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
  }, [empresas, bancosPorEmpresa, extratoPorBanco]);

  const empresasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return empresas.filter((e) => {
      const passaAnalista =
        filtroAnalista === 'todos' || e.analista_id === filtroAnalista;
      const passaBusca =
        !termo ||
        e.nome.toLowerCase().includes(termo) ||
        (e.email_contato || '').toLowerCase().includes(termo) ||
        e.analista_nome.toLowerCase().includes(termo);
      const passaEnvio =
        filtroEnvio === 'todas' ||
        (filtroEnvio === 'regulares' && !e.nao_envia_extratos) ||
        (filtroEnvio === 'nao_envia' && e.nao_envia_extratos);
      return passaAnalista && passaBusca && passaEnvio;
    });
  }, [empresas, busca, filtroAnalista, filtroEnvio]);

  const totalNaoEnvia = empresas.filter((e) => e.nao_envia_extratos).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar usuario={usuario} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8 border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Painel de Coordenação
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Visão consolidada da carteira
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Competência atual: <span className="capitalize">{NOME_MES}</span> · {empresas.length} empresas · {analistas.length} analistas.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-md p-4">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Total de empresas
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{empresas.length}</p>
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
              {analistas.length > 0
                ? Math.round(empresas.length / analistas.length)
                : 0}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-md p-4">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Não envia extratos
            </p>
            <p className="mt-2 text-2xl font-semibold text-amber-700">{totalNaoEnvia}</p>
          </div>
        </div>

        {/* Painel por analista */}
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
                      s.percentConcluido >= 80
                        ? 'bg-emerald-500'
                        : s.percentConcluido >= 50
                        ? 'bg-amber-500'
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
                    {s.semBancos} empresa{s.semBancos === 1 ? '' : 's'} sem bancos cadastrados.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Empresas em atenção */}
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
              <p className="text-xs text-emerald-700 mt-0.5">
                Nenhuma empresa atende aos critérios de atenção nesta competência.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">
                      Empresa
                    </th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">
                      Analista
                    </th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">
                      Motivo
                    </th>
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
                      <td className="px-4 py-2.5 text-slate-900 font-medium">
                        {item.empresa.nome}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {item.empresa.analista_nome}
                      </td>
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
                  Exibindo as 20 mais críticas de {empresasAtencao.length}. Use os filtros abaixo para ver todas.
                </div>
              )}
            </div>
          )}
        </section>

        {/* Lista completa */}
        <section>
          <header className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Carteira completa
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Todas as empresas da contabilidade. Use os filtros para encontrar.
            </p>
          </header>

          <div className="bg-white border border-slate-200 rounded-md shadow-sm">
            <div className="p-4 border-b border-slate-200 grid grid-cols-1 md:grid-cols-[1fr_200px_220px] gap-3">
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
                  placeholder="Pesquisar por empresa, e-mail ou analista..."
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
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
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
                        Analista responsável
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
                    {empresasFiltradas.map((empresa, idx) => (
                      <tr
                        key={empresa.id}
                        className={`border-b border-slate-100 hover:bg-slate-50 ${
                          idx === empresasFiltradas.length - 1 ? 'border-b-0' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-slate-900 font-medium">
                          {empresa.nome}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {empresa.analista_nome}
                        </td>
                        <td className="px-4 py-3">
                          {empresa.nao_envia_extratos ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border bg-amber-50 text-amber-800 border-amber-300">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V3m0 0l13 4-13 5" />
                              </svg>
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
      </main>
    </div>
  );
}
