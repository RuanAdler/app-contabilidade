'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Empresa, BancoEmpresa, SolicitacaoExtrato, ProgressoChecklist } from '@/lib/types';

type Aba = 'extratos' | 'checklist';
type StatusExtrato = 'pendente' | 'solicitado' | 'recebido' | 'importado';

const STATUS_LABELS: Record<StatusExtrato, string> = {
  pendente: 'Pendente',
  solicitado: 'Solicitado',
  recebido: 'Recebido',
  importado: 'Importado',
};

const STATUS_BADGE_CLASS: Record<StatusExtrato, string> = {
  pendente: 'bg-slate-100 text-slate-700 border-slate-300',
  solicitado: 'bg-amber-50 text-amber-800 border-amber-300',
  recebido: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  importado: 'bg-slate-900 text-white border-slate-900',
};

export default function EmpresaDetail() {
  const [usuario, setUsuario] = useState<any>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [bancos, setBancos] = useState<BancoEmpresa[]>([]);
  const [extratos, setExtratos] = useState<SolicitacaoExtrato[]>([]);
  const [checklist, setChecklist] = useState<ProgressoChecklist[]>([]);
  const hoje = new Date();
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const [mes, setMes] = useState(String(hoje.getMonth() + 1).padStart(2, '0'));
  const competencia = `${ano}-${mes}`;
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>('extratos');
  const [sidebarAberta, setSidebarAberta] = useState(true);
  const [novoBanco, setNovoBanco] = useState('');
  const [adicionandoBanco, setAdicionandoBanco] = useState(false);
  const router = useRouter();
  const params = useParams();
  const empresaId = params.id as string;

  const meses = [
    { num: '01', label: 'Jan' },
    { num: '02', label: 'Fev' },
    { num: '03', label: 'Mar' },
    { num: '04', label: 'Abr' },
    { num: '05', label: 'Mai' },
    { num: '06', label: 'Jun' },
    { num: '07', label: 'Jul' },
    { num: '08', label: 'Ago' },
    { num: '09', label: 'Set' },
    { num: '10', label: 'Out' },
    { num: '11', label: 'Nov' },
    { num: '12', label: 'Dez' },
  ];

  const anos = Array.from({ length: 5 }, (_, i) => String(hoje.getFullYear() - 2 + i));

  const carregarExtratos = async (bancosIds: string[]) => {
    if (bancosIds.length === 0) {
      setExtratos([]);
      return;
    }
    const { data } = await supabase
      .from('solicitacoes_extrato')
      .select('*')
      .in('banco_id', bancosIds)
      .eq('competencia', competencia);
    setExtratos(data || []);
  };

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      setUsuario(session.user);

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', empresaId)
        .single();

      setEmpresa(empresaData);

      const { data: bancosData } = await supabase
        .from('bancos_empresa')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome_banco');

      const listaBancos = bancosData || [];
      setBancos(listaBancos);

      await carregarExtratos(listaBancos.map((b) => b.id));

      const { data: checklistData } = await supabase
        .from('progresso_checklist')
        .select('*, etapas_checklist(nome, ordem)')
        .eq('empresa_id', empresaId)
        .eq('competencia', competencia)
        .order('etapa_id');

      setChecklist(checklistData || []);

      setLoading(false);
    };

    loadData();
  }, [router, empresaId, competencia]);

  const statusDoBanco = (bancoId: string): StatusExtrato => {
    const e = extratos.find((x) => x.banco_id === bancoId);
    return (e?.status as StatusExtrato) || 'pendente';
  };

  const handleStatusChange = async (bancoId: string, novoStatus: StatusExtrato) => {
    const existente = extratos.find((e) => e.banco_id === bancoId);
    if (existente) {
      await supabase
        .from('solicitacoes_extrato')
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq('id', existente.id);
      setExtratos((prev) =>
        prev.map((e) => (e.id === existente.id ? { ...e, status: novoStatus } : e))
      );
    } else {
      const { data: novo } = await supabase
        .from('solicitacoes_extrato')
        .insert({ banco_id: bancoId, competencia, status: novoStatus })
        .select()
        .single();
      if (novo) setExtratos((prev) => [...prev, novo]);
    }
  };

  const handleAddBanco = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = novoBanco.trim();
    if (!nome) return;
    setAdicionandoBanco(true);
    const { data: novo } = await supabase
      .from('bancos_empresa')
      .insert({ empresa_id: empresaId, nome_banco: nome })
      .select()
      .single();
    if (novo) {
      setBancos((prev) => [...prev, novo].sort((a, b) => a.nome_banco.localeCompare(b.nome_banco)));
    }
    setNovoBanco('');
    setAdicionandoBanco(false);
  };

  const handleRemoveBanco = async (bancoId: string, nome: string) => {
    if (!confirm(`Excluir o banco "${nome}"? Todos os registros de extrato deste banco serão removidos.`)) return;
    await supabase.from('bancos_empresa').delete().eq('id', bancoId);
    setBancos((prev) => prev.filter((b) => b.id !== bancoId));
    setExtratos((prev) => prev.filter((e) => e.banco_id !== bancoId));
  };

  const handleChecklistChange = async (progressoId: string, feito: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase
      .from('progresso_checklist')
      .update({
        feito_em: feito ? new Date().toISOString() : null,
        feito_por: feito ? user?.email : null,
      })
      .eq('id', progressoId);

    const updatedChecklist = checklist.map((item) =>
      item.id === progressoId
        ? {
            ...item,
            feito_em: feito ? new Date().toISOString() : null,
            feito_por: feito ? (user?.email || null) : null,
          }
        : item
    );

    setChecklist(updatedChecklist);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Empresa não encontrada.</p>
      </div>
    );
  }

  const concluidos = checklist.filter((c: any) => c.feito_em).length;
  const totalChecklist = checklist.length;
  const percentual = totalChecklist > 0 ? Math.round((concluidos / totalChecklist) * 100) : 0;

  const bancosRecebidos = bancos.filter((b) => {
    const s = statusDoBanco(b.id);
    return s === 'recebido' || s === 'importado';
  });
  const bancosPendentes = bancos.filter((b) => {
    const s = statusDoBanco(b.id);
    return s !== 'recebido' && s !== 'importado';
  });

  let resumoTexto = '';
  let resumoClasse = '';
  let resumoTitulo = '';
  if (bancos.length === 0) {
    resumoTitulo = 'Sem bancos cadastrados';
    resumoTexto = 'Cadastre os bancos da empresa para começar a controlar os extratos.';
    resumoClasse = 'bg-slate-50 border-slate-200 text-slate-700';
  } else if (bancosPendentes.length === 0) {
    resumoTitulo = 'Envio concluído';
    resumoTexto = `Todos os ${bancos.length} extratos foram recebidos para ${competencia}.`;
    resumoClasse = 'bg-emerald-50 border-emerald-200 text-emerald-800';
  } else if (bancosRecebidos.length === 0) {
    resumoTitulo = 'Nenhum extrato recebido';
    resumoTexto = `Aguardando extratos de ${bancos.length} ${bancos.length === 1 ? 'banco' : 'bancos'}.`;
    resumoClasse = 'bg-amber-50 border-amber-200 text-amber-900';
  } else {
    resumoTitulo = `Faltam ${bancosPendentes.length} de ${bancos.length}`;
    resumoTexto = `Falta extrato de: ${bancosPendentes.map((b) => b.nome_banco).join(', ')}.`;
    resumoClasse = 'bg-amber-50 border-amber-200 text-amber-900';
  }

  const itensMenu: { id: Aba; label: string; icone: React.ReactNode }[] = [
    {
      id: 'extratos',
      label: 'Extratos bancários',
      icone: (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
        </svg>
      ),
    },
    {
      id: 'checklist',
      label: 'Checklist do balanço',
      icone: (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar usuario={usuario} />

      <div className="flex flex-1">
        <aside
          className={`bg-white border-r border-slate-200 transition-all duration-200 flex flex-col ${
            sidebarAberta ? 'w-56' : 'w-14'
          }`}
        >
          <div className="h-12 flex items-center justify-end px-2 border-b border-slate-200">
            <button
              onClick={() => setSidebarAberta(!sidebarAberta)}
              className="h-8 w-8 inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
              title={sidebarAberta ? 'Ocultar menu' : 'Mostrar menu'}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {sidebarAberta ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
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

        <main className="flex-1 px-6 py-8 min-w-0">
          <button
            onClick={() => router.back()}
            className="mb-6 text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar à lista
          </button>

          <div className="mb-8 border-b border-slate-200 pb-6">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Empresa
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{empresa.nome}</h1>
            <p className="mt-1 text-sm text-slate-500">{empresa.email_contato || 'Sem e-mail cadastrado'}</p>
          </div>

          <div className="mb-6 bg-white border border-slate-200 rounded-md">
            <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Ano
                </label>
                <select
                  value={ano}
                  onChange={(e) => setAno(e.target.value)}
                  className="px-2.5 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  {anos.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Conclusão do balanço
                </p>
                <p className="text-xl font-semibold text-slate-900">
                  {percentual}%
                  <span className="text-xs font-normal text-slate-500 ml-2">
                    ({concluidos}/{totalChecklist})
                  </span>
                </p>
              </div>
            </div>
            <div className="px-2 py-2 flex flex-wrap gap-1">
              {meses.map((m) => {
                const ativo = mes === m.num;
                return (
                  <button
                    key={m.num}
                    onClick={() => setMes(m.num)}
                    className={`flex-1 min-w-[58px] px-3 py-2 text-xs font-medium rounded transition ${
                      ativo
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {aba === 'extratos' && (
            <div className="space-y-4">
              <div className={`border rounded-md px-5 py-4 ${resumoClasse}`}>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                  Situação geral · {competencia}
                </p>
                <p className="mt-1 text-base font-semibold">{resumoTitulo}</p>
                <p className="mt-0.5 text-sm">{resumoTexto}</p>
                {bancos.length > 0 && (
                  <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-current transition-all"
                      style={{
                        width: `${Math.round((bancosRecebidos.length / bancos.length) * 100)}%`,
                        opacity: 0.6,
                      }}
                    />
                  </div>
                )}
              </div>

              <section className="bg-white border border-slate-200 rounded-md shadow-sm">
                <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                      Extratos bancários
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Atualize o status de cada banco para a competência selecionada.
                    </p>
                  </div>
                  <form onSubmit={handleAddBanco} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={novoBanco}
                      onChange={(e) => setNovoBanco(e.target.value)}
                      placeholder="Nome do banco"
                      className="px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                    <button
                      type="submit"
                      disabled={adicionandoBanco || !novoBanco.trim()}
                      className="text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 px-3 py-1.5 rounded-md transition"
                    >
                      {adicionandoBanco ? 'Adicionando...' : 'Adicionar banco'}
                    </button>
                  </form>
                </header>

                {bancos.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-slate-500">Nenhum banco cadastrado para esta empresa.</p>
                    <p className="text-xs text-slate-400 mt-1">Use o campo acima para adicionar o primeiro banco.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">
                          Banco
                        </th>
                        <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">
                          Status atual
                        </th>
                        <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">
                          Alterar
                        </th>
                        <th className="px-5 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bancos.map((banco, idx) => {
                        const status = statusDoBanco(banco.id);
                        return (
                          <tr
                            key={banco.id}
                            className={`border-b border-slate-100 ${
                              idx === bancos.length - 1 ? 'border-b-0' : ''
                            }`}
                          >
                            <td className="px-5 py-3 text-slate-900 font-medium">
                              {banco.nome_banco}
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${STATUS_BADGE_CLASS[status]}`}
                              >
                                {STATUS_LABELS[status]}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <select
                                value={status}
                                onChange={(e) => handleStatusChange(banco.id, e.target.value as StatusExtrato)}
                                className="px-2.5 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                              >
                                <option value="pendente">Pendente</option>
                                <option value="solicitado">Solicitado</option>
                                <option value="recebido">Recebido</option>
                                <option value="importado">Importado</option>
                              </select>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <button
                                onClick={() => handleRemoveBanco(banco.id, banco.nome_banco)}
                                title="Excluir banco"
                                className="text-slate-400 hover:text-red-600 transition"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            </div>
          )}

          {aba === 'checklist' && (
            <section className="bg-white border border-slate-200 rounded-md shadow-sm">
              <header className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                  Checklist do balanço
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Etapas do fechamento contábil mensal.
                </p>
              </header>

              {checklist.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-slate-500">Nenhuma etapa cadastrada para esta competência.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {checklist.map((item: any) => (
                    <li key={item.id} className="px-5 py-3 flex items-start gap-3">
                      <input
                        type="checkbox"
                        id={`check-${item.id}`}
                        checked={!!item.feito_em}
                        onChange={(e) => handleChecklistChange(item.id, e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                      />
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor={`check-${item.id}`}
                          className={`text-sm font-medium cursor-pointer ${
                            item.feito_em ? 'text-slate-400 line-through' : 'text-slate-900'
                          }`}
                        >
                          {item.etapas_checklist?.nome}
                        </label>
                        {item.feito_em && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Concluído em {new Date(item.feito_em).toLocaleDateString('pt-BR')}
                            {item.feito_por && ` por ${item.feito_por}`}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
