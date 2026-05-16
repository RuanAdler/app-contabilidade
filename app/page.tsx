'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
      } else {
        const { data: userData } = await supabase
          .from('analistas')
          .select('cargo')
          .eq('email', session.user.email)
          .single();

        if (userData?.cargo === 'coordenador') {
          router.push('/dashboard-coordenador');
        } else {
          router.push('/dashboard-analista');
        }
      }
    };

    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-sm text-slate-500">Redirecionando...</p>
    </div>
  );
}
