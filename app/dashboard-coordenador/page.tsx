'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Empresa, Analista } from '@/lib/types';

type EmpresaComAnalista = Empresa & { analista_nome: string };
type FiltroEnvio = 'todas' | 'regulares' | 'nao_envia';

export default function DashboardCoordenador() {
  const [usuario, setUsuario] = useState<any>(null);
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaComAnalista[]>([]);
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
      setLoading(false);
    };

    checkAuth();
  }, [router]);

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
            {empresas.length} empresas distribuídas entre {analistas.length} analistas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
      </main>
    </div>
  );
}
