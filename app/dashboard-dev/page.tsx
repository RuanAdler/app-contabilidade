'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Analista, EtapaChecklist, GrupoChecklist, SubgrupoChecklist, Empresa } from '@/lib/types';

const GRUPO_LABEL: Record<GrupoChecklist, string> = {
  ativo: 'Ativo',
  passivo: 'Passivo',
  patrimonio_liquido: 'Patrimônio Líquido',
};

const SUBGRUPO_LABEL: Record<string, string> = {
  circulante: 'Circulante',
  nao_circulante: 'Não circulante',
};

type Aba = 'equipe' | 'configuracoes';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-sm text-slate-500">Carregando...</p></div>}>
      <DashboardDev />
    </Suspense>
  );
}

function DashboardDev() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const abaInicial = (searchParams.get('aba') as Aba) || 'equipe';
  const [aba, setAbaState] = useState<Aba>(abaInicial);

  useEffect(() => {
    const fromUrl = searchParams.get('aba') as Aba | null;
    if (fromUrl && fromUrl !== aba) setAbaState(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setAba = (nova: Aba) => {
    setAbaState(nova);
    const params = new URLSearchParams(searchParams.toString());
    params.set('aba', nova);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [usuario, setUsuario] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autorizado, setAutorizado] = useState(false);

  const [todosAnalistas, setTodosAnalistas] = useState<Analista[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [etapas, setEtapas] = useState<EtapaChecklist[]>([]);

  // Modal adicionar usuário
  const [modalUserAberto, setModalUserAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [novoCargo, setNovoCargo] = useState<'analista' | 'coordenador' | 'desenvolvedor'>('analista');
  const [salvandoUser, setSalvandoUser] = useState(false);
  const [msgUser, setMsgUser] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Form adicionar conta
  const [novaContaNome, setNovaContaNome] = useState('');
  const [novaContaGrupo, setNovaContaGrupo] = useState<GrupoChecklist>('ativo');
  const [novaContaSubgrupo, setNovaContaSubgrupo] = useState<string>('circulante');
  const [salvandoConta, setSalvandoConta] = useState(false);
  const [msgConta, setMsgConta] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Sidebar hover
  const [sidebarFixa, setSidebarFixa] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const sidebarAberta = sidebarFixa || sidebarHover;

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

      if (u?.cargo !== 'desenvolvedor') {
        if (u?.cargo === 'coordenador') router.push('/dashboard-coordenador');
        else router.push('/dashboard-analista');
        return;
      }
      setAutorizado(true);

      const [{ data: todos }, { data: emps }, { data: ets }] = await Promise.all([
        supabase.from('analistas').select('*').order('cargo').order('nome'),
        supabase.from('empresas').select('*'),
        supabase.from('etapas_checklist').select('*').order('ordem'),
      ]);

      setTodosAnalistas(todos || []);
      setEmpresas(emps || []);
      setEtapas(ets || []);
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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = novoNome.trim();
    const email = novoEmail.trim().toLowerCase();
    if (!nome || !email || novaSenha.length < 6) {
      setMsgUser({ tipo: 'erro', texto: 'Preencha todos os campos (senha mín. 6 caracteres).' });
      return;
    }
    setSalvandoUser(true);
    setMsgUser(null);

    try {
      const resp = await fetch('https://vnmjducnedyihsdkltyw.supabase.co/auth/v1/signup', {
        method: 'POST',
        headers: {
          'apikey': 'sb_publishable_qfiY6GtXrsg0X4V_T1IRxQ_GZj_YasW',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password: novaSenha }),
      });
      const authData = await resp.json();
      if (!resp.ok) {
        setMsgUser({ tipo: 'erro', texto: 'Erro Auth: ' + (authData?.msg || 'desconhecido') });
        setSalvandoUser(false);
        return;
      }
    } catch {
      setMsgUser({ tipo: 'erro', texto: 'Erro de conexão.' });
      setSalvandoUser(false);
      return;
    }

    const { data, error } = await supabase
      .from('analistas')
      .insert({ nome, email, cargo: novoCargo })
      .select()
      .single();
    if (error) {
      setMsgUser({ tipo: 'erro', texto: 'Auth criado, erro tabela: ' + error.message });
      setSalvandoUser(false);
      return;
    }
    if (data) {
      setTodosAnalistas((prev) => [...prev, data].sort((a, b) => a.cargo.localeCompare(b.cargo) || a.nome.localeCompare(b.nome)));
    }
    setMsgUser({ tipo: 'ok', texto: `${nome} criado. Pode ser necessário confirmar e-mail (ver aviso abaixo).` });
    setNovoNome(''); setNovoEmail(''); setNovaSenha(''); setNovoCargo('analista');
    setSalvandoUser(false);
  };

  const handleRemoveUser = async (id: string, nome: string) => {
    const qtdEmpresas = empresas.filter((e) => e.analista_id === id).length;
    if (qtdEmpresas > 0) {
      alert(`"${nome}" tem ${qtdEmpresas} empresa(s) atribuída(s). Reatribua antes.`);
      return;
    }
    if (!confirm(`Remover "${nome}" do app? Conta de login no Supabase Auth continua existindo.`)) return;
    const { error } = await supabase.from('analistas').delete().eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    setTodosAnalistas((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAddConta = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgConta(null);
    const nome = novaContaNome.trim().toUpperCase();
    if (!nome) return;
    const subgrupo: SubgrupoChecklist =
      novaContaGrupo === 'patrimonio_liquido' ? null : (novaContaSubgrupo as SubgrupoChecklist);
    const proximaOrdem = Math.max(0, ...etapas.map((e) => e.ordem)) + 1;
    setSalvandoConta(true);
    const { data, error } = await supabase
      .from('etapas_checklist')
      .insert({ nome, grupo: novaContaGrupo, subgrupo, ordem: proximaOrdem })
      .select()
      .single();
    setSalvandoConta(false);
    if (error) { setMsgConta({ tipo: 'erro', texto: 'Erro: ' + error.message }); return; }
    if (data) {
      setEtapas((prev) => [...prev, data].sort((a, b) => a.ordem - b.ordem));
      setNovaContaNome('');
      setMsgConta({ tipo: 'ok', texto: `Conta "${nome}" adicionada.` });
    }
  };

  const handleRemoveConta = async (etapa: EtapaChecklist) => {
    if (!confirm(`Remover "${etapa.nome}"? Marcações em todas as empresas serão apagadas.`)) return;
    await supabase.from('progresso_checklist').delete().eq('etapa_id', etapa.id);
    const { error } = await supabase.from('etapas_checklist').delete().eq('id', etapa.id);
    if (error) { alert('Erro: ' + error.message); return; }
    setEtapas((prev) => prev.filter((e) => e.id !== etapa.id));
    setMsgConta({ tipo: 'ok', texto: `Conta "${etapa.nome}" removida.` });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    );
  }
  if (!autorizado) return null;

  const itensMenu = [
    {
      id: 'equipe' as Aba,
      label: 'Equipe',
      icone: (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      id: 'configuracoes' as Aba,
      label: 'Configurações',
      icone: (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

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
                title={sidebarFixa ? 'Liberar menu' : 'Fixar menu aberto'}
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
              {itensMenu.map((item) => {
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

        <main className="flex-1 px-6 py-8 min-w-0">
          {aba === 'equipe' && (
            <>
              <div className="mb-8 border-b border-slate-200 pb-6 flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="label-tiny">Desenvolvedor</p>
                  <h1 className="mt-1 text-2xl font-semibold text-slate-900">Equipe</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Gerencie analistas, coordenadores e desenvolvedores do app.
                  </p>
                </div>
                <button
                  onClick={() => { setModalUserAberto(true); setMsgUser(null); }}
                  className="btn-primary"
                >
                  + Adicionar usuário
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="label-tiny">Analistas</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {todosAnalistas.filter((a) => a.cargo === 'analista').length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="label-tiny">Coordenadores</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {todosAnalistas.filter((a) => a.cargo === 'coordenador').length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="label-tiny">Desenvolvedores</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {todosAnalistas.filter((a) => a.cargo === 'desenvolvedor').length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-4">
                  <p className="label-tiny">Total</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{todosAnalistas.length}</p>
                </div>
              </div>

              <section className="bg-white border border-slate-200 rounded-md shadow-sm">
                <header className="px-5 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    Usuários cadastrados
                  </h2>
                </header>
                {todosAnalistas.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-slate-500">Nenhum usuário cadastrado.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Nome</th>
                        <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">E-mail</th>
                        <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Cargo</th>
                        <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">Empresas</th>
                        <th className="px-5 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {todosAnalistas.map((a, idx) => {
                        const qtd = empresas.filter((e) => e.analista_id === a.id).length;
                        const cargoLabel = a.cargo === 'desenvolvedor' ? 'Desenvolvedor' : a.cargo === 'coordenador' ? 'Coordenador' : 'Analista';
                        const cargoBadge = a.cargo === 'desenvolvedor' ? 'badge-aviso' : a.cargo === 'coordenador' ? 'badge-destaque' : 'badge-info';
                        return (
                          <tr key={a.id} className={`border-b border-slate-100 ${idx === todosAnalistas.length - 1 ? 'border-b-0' : ''}`}>
                            <td className="px-5 py-3 text-slate-900 font-medium">{a.nome}</td>
                            <td className="px-5 py-3 text-slate-600 text-xs">{a.email}</td>
                            <td className="px-5 py-3">
                              <span className={`badge ${cargoBadge}`}>{cargoLabel}</span>
                            </td>
                            <td className="px-5 py-3 text-slate-700">
                              {a.cargo === 'analista' ? (
                                <span className={qtd > 0 ? 'font-medium' : 'text-slate-400'}>{qtd}</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right">
                              {a.email !== usuario?.email && (
                                <button
                                  onClick={() => handleRemoveUser(a.id, a.nome)}
                                  title="Remover"
                                  className="text-slate-400 hover:text-red-600 transition"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                                  </svg>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>

              <div className="mt-8 bg-slate-50 border border-slate-200 rounded-md p-5 text-sm text-slate-600">
                <p className="font-semibold text-slate-900 mb-2">⚠️ Confirmação de e-mail</p>
                <p className="text-xs">
                  Se o login do novo usuário não funcionar, o Supabase pode estar exigindo confirmação. Vá em <strong>Supabase Dashboard → Authentication → Providers → Email</strong> e desmarque <strong>&quot;Confirm email&quot;</strong>.
                </p>
                <p className="text-xs mt-2">
                  Ou rode no SQL Editor:{' '}
                  <code className="bg-white border border-slate-300 px-1.5 py-0.5 rounded text-[11px]">
                    UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = &apos;email_aqui&apos;;
                  </code>
                </p>
              </div>
            </>
          )}

          {aba === 'configuracoes' && (
            <>
              <div className="mb-8 border-b border-slate-200 pb-6">
                <p className="label-tiny">Desenvolvedor</p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">Configurações</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Contas do checklist do balanço — aplicam-se a todas as empresas.
                </p>
              </div>

              <section className="bg-white border border-slate-200 rounded-md shadow-sm">
                <header className="px-5 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    Contas do balanço (checklist)
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Total: {etapas.length} contas.
                  </p>
                </header>

                <form onSubmit={handleAddConta} className="p-5 border-b border-slate-200 grid grid-cols-1 md:grid-cols-[1fr_180px_180px_auto] gap-3 items-end">
                  <div>
                    <label className="block label-tiny mb-1.5">Nome da conta</label>
                    <input
                      type="text"
                      value={novaContaNome}
                      onChange={(e) => setNovaContaNome(e.target.value)}
                      placeholder="ex: ESTOQUES"
                      className="input-text"
                    />
                  </div>
                  <div>
                    <label className="block label-tiny mb-1.5">Grupo</label>
                    <select
                      value={novaContaGrupo}
                      onChange={(e) => setNovaContaGrupo(e.target.value as GrupoChecklist)}
                      className="input-select"
                    >
                      <option value="ativo">Ativo</option>
                      <option value="passivo">Passivo</option>
                      <option value="patrimonio_liquido">Patrimônio Líquido</option>
                    </select>
                  </div>
                  <div>
                    <label className="block label-tiny mb-1.5">Subgrupo</label>
                    <select
                      value={novaContaSubgrupo}
                      onChange={(e) => setNovaContaSubgrupo(e.target.value)}
                      disabled={novaContaGrupo === 'patrimonio_liquido'}
                      className="input-select disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="circulante">Circulante</option>
                      <option value="nao_circulante">Não circulante</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={salvandoConta || !novaContaNome.trim()}
                    className="btn-primary"
                  >
                    {salvandoConta ? 'Adicionando...' : '+ Adicionar'}
                  </button>
                </form>

                {msgConta && (
                  <div className={`px-5 py-2 text-xs ${msgConta.tipo === 'ok' ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
                    {msgConta.texto}
                  </div>
                )}

                <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {(['ativo', 'passivo', 'patrimonio_liquido'] as GrupoChecklist[]).map((grupo) => {
                    const subgrupos = etapasAgrupadas[grupo] || {};
                    return (
                      <div key={grupo} className="bg-white border border-slate-200 rounded-md">
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
                                <p className="text-xs text-slate-400 italic">Nenhuma conta.</p>
                              ) : (
                                <ul className="space-y-1">
                                  {lista.map((e) => (
                                    <li key={e.id} className="flex items-center justify-between gap-2 group py-1 px-2 rounded hover:bg-slate-50">
                                      <span className="text-sm text-slate-800">{e.nome}</span>
                                      <button
                                        onClick={() => handleRemoveConta(e)}
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
                  })}
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      {modalUserAberto && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                Adicionar usuário
              </h3>
              <button onClick={() => { setModalUserAberto(false); setMsgUser(null); }} className="text-slate-400 hover:text-slate-700 transition">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-5 space-y-4">
              <div>
                <label className="block label-tiny mb-1.5">Nome completo</label>
                <input type="text" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} required autoFocus className="input-text" />
              </div>
              <div>
                <label className="block label-tiny mb-1.5">E-mail</label>
                <input type="email" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} required className="input-text" />
              </div>
              <div>
                <label className="block label-tiny mb-1.5">Senha inicial</label>
                <input type="text" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required minLength={6} className="input-text" placeholder="Mín. 6 caracteres" />
              </div>
              <div>
                <label className="block label-tiny mb-1.5">Cargo</label>
                <select
                  value={novoCargo}
                  onChange={(e) => setNovoCargo(e.target.value as 'analista' | 'coordenador' | 'desenvolvedor')}
                  className="input-select"
                >
                  <option value="analista">Analista</option>
                  <option value="coordenador">Coordenador</option>
                  <option value="desenvolvedor">Desenvolvedor</option>
                </select>
              </div>
              {msgUser && (
                <p className={`text-xs ${msgUser.tipo === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {msgUser.texto}
                </p>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setModalUserAberto(false); setMsgUser(null); }} className="btn-secondary">
                  Fechar
                </button>
                <button type="submit" disabled={salvandoUser || !novoNome.trim() || !novoEmail.trim() || novaSenha.length < 6} className="btn-primary">
                  {salvandoUser ? 'Criando...' : 'Criar conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
