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
    <nav className="bg-slate-900 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center h-8 w-8 rounded bg-white">
            <span className="text-slate-900 font-bold text-xs tracking-tight">RA</span>
          </span>
          <span className="text-white text-sm font-semibold tracking-tight">
            R.A. Contabilidade
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <span className="text-slate-300 text-xs hidden sm:inline">
            {usuario?.email}
          </span>
          <button
            onClick={handleLogout}
            className="text-slate-200 hover:text-white text-xs font-medium border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded transition"
          >
            Sair
          </button>
        </div>
      </div>
    </nav>
  );
}
