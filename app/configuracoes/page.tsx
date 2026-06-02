'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { EtapaChecklist, GrupoChecklist, SubgrupoChecklist } from '@/lib/types';

const GRUPO_LABEL: Record<GrupoChecklist, string> = {
  ativo: 'Ativo',
  passivo: 'Passivo',
  patrimonio_liquido: 'Patrimônio Líquido',
};

const SUBGRUPO_LABEL: Record<string, string> = {
  circulante: 'Circulante',
  nao_circulante: 'Não circulante',
};

export default function Configuracoes() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [etapas, setEtapas] = useState<EtapaChecklist[]>([]);

  // Form adicionar
  const [novoNome, setNovoNome] = useState('');
  const [novoGrupo, setNovoGrupo] = useState<GrupoChecklist>('ativo');
  const [novoSubgrupo, setNovoSubgrupo] = useState<string>('circulante');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    const carregar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUsuario(session.user);

      const { data: u } = await supabase
        .from('analistas')
        .select('cargo')
        .eq('email', session.user.email)
        .single();

      if (u?.cargo === 'desenvolvedor') {
        router.push('/dashboard-dev?aba=configuracoes');
        return;
      }
      if (u?.cargo !== 'coordenador') {
        router.push('/dashboard-analista');
        return;
      }
      setAutorizado(true);

      const { data } = await supabase
        .from('etapas_checklist')
        .select('*')
        .order('ordem');
      setEtapas(data || []);
      setLoading(false);
    };
    carregar();
  }, [router]);

  const etapasAgrupadas = useMemo(() => {
    const grupos: Record<string, Record<string, EtapaChecklist[]>> = {
      ativo: { circulante: [], nao_circulante: [] },
      passivo: { circulante: [], nao_circulante: [] },
      patrimonio_liquido: { _: [] },
    };
    for (const e of etapas) {
      const sub = e.subgrupo || '_';
      if (!grupos[e.grupo]) grupos[e.grupo] = {};
      if (!grupos[e.grupo][sub]) grupos[e.grupo][sub] = [];
      grupos[e.grupo][sub].push(e);
    }
    return grupos;
  }, [etapas]);

  const handleAdicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagem(null);
    const nome = novoNome.trim().toUpperCase();
    if (!nome) return;
    const subgrupo: SubgrupoChecklist =
      novoGrupo === 'patrimonio_liquido' ? null : (novoSubgrupo as SubgrupoChecklist);
    const proximaOrdem = Math.max(0, ...etapas.map((e) => e.ordem)) + 1;

    setSalvando(true);
    const { data, error } = await supabase
      .from('etapas_checklist')
      .insert({ nome, grupo: novoGrupo, subgrupo, ordem: proximaOrdem })
      .select()
      .single();
    setSalvando(false);

    if (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao adicionar: ' + error.message });
      return;
    }
    if (data) {
      setEtapas((prev) => [...prev, data].sort((a, b) => a.ordem - b.ordem));
      setNovoNome('');
      setMensagem({ tipo: 'ok', texto: `Conta "${nome}" adicionada.` });
    }
  };

  const handleRemover = async (etapa: EtapaChecklist) => {
    if (!confirm(`Remover a conta "${etapa.nome}"?\n\nTodas as marcações dessa conta em todas as empresas serão apagadas. Esta ação não pode ser desfeita.`)) return;

    // Apaga progresso primeiro (sem cascade)
    await supabase.from('progresso_checklist').delete().eq('etapa_id', etapa.id);
    const { error } = await supabase.from('etapas_checklist').delete().eq('id', etapa.id);

    if (error) {
      alert('Erro ao remover: ' + error.message);
      return;
    }
    setEtapas((prev) => prev.filter((e) => e.id !== etapa.id));
    setMensagem({ tipo: 'ok', texto: `Conta "${etapa.nome}" removida.` });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    );
  }

  if (!autorizado) return null;

  const renderColuna = (grupo: GrupoChecklist) => {
    const subgrupos = etapasAgrupadas[grupo] || {};
    return (
      <div className="bg-white border border-slate-200 rounded-md">
        <header className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
            {GRUPO_LABEL[grupo]}
          </h3>
        </header>
        <div className="p-4 space-y-4">
          {Object.entries(subgrupos).map(([subkey, lista]) => (
            <div key={subkey}>
              {subkey !== '_' && (
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {SUBGRUPO_LABEL[subkey]}
                </p>
              )}
              {lista.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhuma conta cadastrada.</p>
              ) : (
                <ul className="space-y-1">
                  {lista.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-2 group py-1 px-2 rounded hover:bg-slate-50"
                    >
                      <span className="text-sm text-slate-800">{e.nome}</span>
                      <button
                        onClick={() => handleRemover(e)}
                        title="Remover"
                        className="text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar usuario={usuario} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <button
          onClick={() => router.back()}
          className="mb-6 text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>

        <div className="mb-8 border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Administração
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Configurações</h1>
          <p className="mt-1 text-sm text-slate-500">
            Apenas coordenadores. Alterações refletem para todas as empresas automaticamente.
          </p>
        </div>

        <section className="bg-white border border-slate-200 rounded-md shadow-sm mb-6">
          <header className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Contas do balanço (checklist)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Estas contas aparecem na aba "Checklist" de cada empresa para conferência mensal.
              Total: {etapas.length} contas.
            </p>
          </header>

          <form onSubmit={handleAdicionar} className="p-5 border-b border-slate-200 grid grid-cols-1 md:grid-cols-[1fr_180px_180px_auto] gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Nome da conta
              </label>
              <input
                type="text"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="ex: ESTOQUES"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Grupo
              </label>
              <select
                value={novoGrupo}
                onChange={(e) => setNovoGrupo(e.target.value as GrupoChecklist)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
              >
                <option value="ativo">Ativo</option>
                <option value="passivo">Passivo</option>
                <option value="patrimonio_liquido">Patrimônio Líquido</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Subgrupo
              </label>
              <select
                value={novoSubgrupo}
                onChange={(e) => setNovoSubgrupo(e.target.value)}
                disabled={novoGrupo === 'patrimonio_liquido'}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="circulante">Circulante</option>
                <option value="nao_circulante">Não circulante</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={salvando || !novoNome.trim()}
              className="text-sm font-medium px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {salvando ? 'Adicionando...' : '+ Adicionar'}
            </button>
          </form>

          {mensagem && (
            <div className={`px-5 py-2 text-xs ${
              mensagem.tipo === 'ok' ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
            }`}>
              {mensagem.texto}
            </div>
          )}

          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {renderColuna('ativo')}
            {renderColuna('passivo')}
            {renderColuna('patrimonio_liquido')}
          </div>
        </section>
      </main>
    </div>
  );
}
