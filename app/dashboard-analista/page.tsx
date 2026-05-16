'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Empresa } from '@/lib/types';

type FiltroEnvio = 'todas' | 'regulares' | 'nao_envia';

export default function DashboardAnalista() {
  const [usuario, setUsuario] = useState<any>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [busca, setBusca] = useState('');
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

      setUsuario(session.user);

      const { data: analistaData } = await supabase
        .from('analistas')
        .select('id')
        .eq('email', session.user.email)
        .single();

      if (analistaData) {
        const { data: empresasData } = await supabase
          .from('empresas')
          .select('*')
          .eq('analista_id', analistaData.id)
          .neq('status', 'baixada')
          .order('nome');

        setEmpresas(empresasData || []);
      }

      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const empresasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return empresas.filter((e) => {
      const passaBusca =
        !termo ||
        e.nome.toLowerCase().includes(termo) ||
        (e.email_contato || '').toLowerCase().includes(termo);
      const passaEnvio =
        filtroEnvio === 'todas' ||
        (filtroEnvio === 'regulares' && !e.nao_envia_extratos) ||
        (filtroEnvio === 'nao_envia' && e.nao_envia_extratos);
      return passaBusca && passaEnvio;
    });
  }, [empresas, busca, filtroEnvio]);

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
            Carteira de Clientes
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Empresas sob sua responsabilidade
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Total de {empresas.length} {empresas.length === 1 ? 'empresa cadastrada' : 'empresas cadastradas'}
            {totalNaoEnvia > 0 && ` · ${totalNaoEnvia} marcada${totalNaoEnvia === 1 ? '' : 's'} como "não envia extratos"`}.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-md shadow-sm">
          <div className="p-4 border-b border-slate-200 grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
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
                placeholder="Pesquisar por nome ou e-mail da empresa..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              />
            </div>
            <select
              value={filtroEnvio}
              onChange={(e) => setFiltroEnvio(e.target.value as FiltroEnvio)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
            >
              <option value="todas">Todas as empresas</option>
              <option value="regulares">Apenas regulares</option>
              <option value="nao_envia">Apenas "não envia extratos"</option>
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {empresa.status === 'suspensa' && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border bg-amber-50 text-amber-800 border-amber-300">
                              Suspensa
                            </span>
                          )}
                          {empresa.nao_envia_extratos && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border bg-amber-50 text-amber-800 border-amber-300">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V3m0 0l13 4-13 5" />
                              </svg>
                              Não envia extratos
                            </span>
                          )}
                          {empresa.status !== 'suspensa' && !empresa.nao_envia_extratos && (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
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
