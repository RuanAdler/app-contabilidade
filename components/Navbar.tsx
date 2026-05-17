'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Props = {
  usuario: any;
  avatarUrl?: string | null;
};

export default function Navbar({ usuario, avatarUrl }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [foto, setFoto] = useState<string | null>(avatarUrl ?? null);
  const [nome, setNome] = useState<string | null>(null);
  const [cargo, setCargo] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!usuario?.email) return;
    supabase
      .from('analistas')
      .select('avatar_url,nome,cargo')
      .eq('email', usuario.email)
      .single()
      .then(({ data }) => {
        if (data) {
          if (avatarUrl === undefined) setFoto(data.avatar_url ?? null);
          setNome(data.nome ?? null);
          setCargo(data.cargo ?? null);
        }
      });
  }, [usuario?.email, avatarUrl]);

  useEffect(() => {
    if (avatarUrl !== undefined) setFoto(avatarUrl);
  }, [avatarUrl]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const iniciais = (nome || usuario?.email || '')
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0])
    .join('')
    .toUpperCase() || '??';

  return (
    <nav className="bg-slate-900 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center h-8 w-8 rounded bg-white overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Controle Contábil" className="h-full w-full object-contain" />
          </span>
          <span className="text-white text-sm font-semibold tracking-tight">
            Controle Contábil
          </span>
        </Link>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setAberto(!aberto)}
            className="flex items-center gap-2 group"
          >
            <span className="text-slate-300 text-xs hidden sm:inline group-hover:text-white transition">
              {nome || usuario?.email}
            </span>
            <span className="h-8 w-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center overflow-hidden group-hover:border-slate-400 transition">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-white text-xs font-semibold">{iniciais}</span>
              )}
            </span>
            <svg
              className={`h-3 w-3 text-slate-400 transition ${aberto ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {aberto && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-md shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-900 truncate">{nome || 'Usuário'}</p>
                <p className="text-xs text-slate-500 truncate">{usuario?.email}</p>
              </div>
              <Link
                href="/perfil"
                onClick={() => setAberto(false)}
                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                Meu perfil
              </Link>
              {cargo === 'coordenador' && (
                <Link
                  href="/configuracoes"
                  onClick={() => setAberto(false)}
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                >
                  Configurações
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition border-t border-slate-100"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
