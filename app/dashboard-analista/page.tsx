'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import EmpresaCard from '@/components/EmpresaCard';
import { Empresa } from '@/lib/types';

export default function DashboardAnalista() {
  const [usuario, setUsuario] = useState<any>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
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
          .eq('analista_id', analistaData.id);

        setEmpresas(empresasData || []);
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

      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Minhas Empresas</h1>

        {empresas.length === 0 ? (
          <p className="text-gray-500">Nenhuma empresa atribuída.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {empresas.map((empresa) => (
              <EmpresaCard key={empresa.id} empresa={empresa} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
