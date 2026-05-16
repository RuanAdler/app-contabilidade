'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Empresa, BancoEmpresa, ProgressoChecklist } from '@/lib/types';

export default function EmpresaDetail() {
  const [usuario, setUsuario] = useState<any>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [bancos, setBancos] = useState<BancoEmpresa[]>([]);
  const [checklist, setChecklist] = useState<ProgressoChecklist[]>([]);
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const empresaId = params.id as string;

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
        .eq('empresa_id', empresaId);

      setBancos(bancosData || []);

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

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar usuario={usuario} />

      <main className="max-w-7xl mx-auto px-6 py-8">
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

        <div className="mb-6 bg-white border border-slate-200 rounded-md p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Competência
            </label>
            <input
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Conclusão do balanço
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {percentual}%
              <span className="text-sm font-normal text-slate-500 ml-2">
                ({concluidos}/{totalChecklist})
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-200 rounded-md shadow-sm">
            <header className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                Extratos bancários
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Status de solicitação por banco na competência {competencia}.
              </p>
            </header>

            {bancos.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500">Nenhum banco cadastrado.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">
                      Banco
                    </th>
                    <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bancos.map((banco, idx) => (
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
                        <select className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-400">
                          <option value="pendente">Pendente</option>
                          <option value="solicitado">Solicitado</option>
                          <option value="recebido">Recebido</option>
                          <option value="importado">Importado</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

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
        </div>
      </main>
    </div>
  );
}
