'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Empresa, Analista } from '@/lib/types';

export default function DashboardCoordenador() {
  const [usuario, setUsuario] = useState<any>(null);
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [empresasPorAnalista, setEmpresasPorAnalista] = useState<Record<string, Empresa[]>>({});
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
        .eq('cargo', 'analista');

      setAnalistas(analistasData || []);

      if (analistasData) {
        const empresasMap: Record<string, Empresa[]> = {};
        for (const analista of analistasData) {
          const { data: empresas } = await supabase
            .from('empresas')
            .select('*')
            .eq('analista_id', analista.id);
          empresasMap[analista.id] = empresas || [];
        }
        setEmpresasPorAnalista(empresasMap);
      }

      setLoading(false);
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return <div className="text-center py-10">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar usuario={usuario} />

      <main className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Painel do Coordenador</h1>

        {analistas.map((analista) => (
          <div key={analista.id} className="mb-8 bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-semibold mb-4">{analista.nome}</h2>
            <p className="text-gray-600 mb-4">{analista.email}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {empresasPorAnalista[analista.id]?.map((empresa) => (
                <div
                  key={empresa.id}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition"
                >
                  <h3 className="font-bold text-blue-600">{empresa.nome}</h3>
                  <p className="text-sm text-gray-500">{empresa.email_contato}</p>
                </div>
              ))}
            </div>

            {(!empresasPorAnalista[analista.id] || empresasPorAnalista[analista.id].length === 0) && (
              <p className="text-gray-400">Nenhuma empresa atribuída.</p>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
