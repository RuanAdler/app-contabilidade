'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Navbar({ usuario }: { usuario: any }) {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <nav className="bg-blue-600 text-white p-4 flex justify-between items-center">
      <Link href="/" className="text-xl font-bold">
        📊 Contabilidade
      </Link>
      <div className="flex gap-4 items-center">
        <span className="text-sm">Olá, {usuario?.email}</span>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded text-sm"
        >
          Sair
        </button>
      </div>
    </nav>
  );
}
