'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Empresa, BancoEmpresa, SolicitacaoExtrato, ProgressoChecklist } from '@/lib/types';

export default function EmpresaDetail() {
  const [usuario, setUsuario] = useState<any>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [bancos, setBancos] = useState<BancoEmpresa[]>([]);
  const [extratos, setExtratos] = useState<SolicitacaoExtrato[]>([]);
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
        .select('progresso_checklist.*, etapas_checklist(nome, ordem)')
        .eq('empresa_id', empresaId)
        .eq('competencia', competencia)
        .order('ordem', { foreignTable: 'etapas_checklist' });

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
            feito_por: feito ? user?.email : null,
          }
        : item
    );

    setChecklist(updatedChecklist);
  };

  if (loading) {
    return <div className="text-center py-10">Carregando...</div>;
  }

  if (!empresa) {
    return <div className="text-center py-10">Empresa não encontrada.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar usuario={usuario} />

      <main className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => router.back()}
          className="mb-6 text-blue-600 hover:text-blue-800"
        >
          ← Voltar
        </button>

        <h1 className="text-3xl font-bold mb-2">{empresa.nome}</h1>
        <p className="text-gray-600 mb-6">{empresa.email_contato}</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4">📊 Extratos Bancários</h2>
            <p className="text-sm text-gray-500 mb-4">Competência: {competencia}</p>

            {bancos.length === 0 ? (
              <p className="text-gray-400">Nenhum banco cadastrado.</p>
            ) : (
              <div className="space-y-3">
                {bancos.map((banco) => (
                  <div key={banco.id} className="p-3 border border-gray-200 rounded">
                    <p className="font-semibold">{banco.nome_banco}</p>
                    <select className="w-full mt-2 p-2 border border-gray-300 rounded text-sm">
                      <option>pendente</option>
                      <option>solicitado</option>
                      <option>recebido</option>
                      <option>importado</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4">✅ Checklist do Balanço</h2>
            <p className="text-sm text-gray-500 mb-4">Competência: {competencia}</p>

            {checklist.length === 0 ? (
              <p className="text-gray-400">Nenhuma etapa cadastrada.</p>
            ) : (
              <div className="space-y-3">
                {checklist.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-3 border border-gray-200 rounded flex items-start gap-3"
                  >
                    <input
                      type="checkbox"
                      checked={!!item.feito_em}
                      onChange={(e) => handleChecklistChange(item.id, e.target.checked)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label className="font-semibold cursor-pointer">
                        {item.etapas_checklist?.nome}
                      </label>
                      {item.feito_em && (
                        <p className="text-xs text-gray-500 mt-1">
                          Feito em {new Date(item.feito_em).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                      <textarea
                        placeholder="Adicionar observação..."
                        defaultValue={item.observacao || ''}
                        className="w-full mt-2 p-2 border border-gray-300 rounded text-sm"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
