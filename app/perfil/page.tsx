'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Analista } from '@/lib/types';

export default function Perfil() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any>(null);
  const [analista, setAnalista] = useState<Analista | null>(null);
  const [loading, setLoading] = useState(true);

  // Dados pessoais
  const [nome, setNome] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [msgNome, setMsgNome] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Senha
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [msgSenha, setMsgSenha] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Avatar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadando, setUploadando] = useState(false);
  const [msgFoto, setMsgFoto] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUsuario(session.user);

      const { data } = await supabase
        .from('analistas')
        .select('*')
        .eq('email', session.user.email)
        .single();

      if (data) {
        setAnalista(data);
        setNome(data.nome || '');
      }
      setLoading(false);
    };
    load();
  }, [router]);

  const handleSalvarNome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analista) return;
    const novoNome = nome.trim();
    if (!novoNome) {
      setMsgNome({ tipo: 'erro', texto: 'O nome não pode ficar em branco.' });
      return;
    }
    setSalvandoNome(true);
    setMsgNome(null);
    const { error } = await supabase
      .from('analistas')
      .update({ nome: novoNome })
      .eq('id', analista.id);
    if (error) {
      setMsgNome({ tipo: 'erro', texto: 'Erro ao salvar: ' + error.message });
    } else {
      setMsgNome({ tipo: 'ok', texto: 'Nome atualizado com sucesso.' });
      setAnalista({ ...analista, nome: novoNome });
    }
    setSalvandoNome(false);
  };

  const handleTrocarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgSenha(null);
    if (novaSenha.length < 6) {
      setMsgSenha({ tipo: 'erro', texto: 'A senha precisa ter ao menos 6 caracteres.' });
      return;
    }
    if (novaSenha !== confirmaSenha) {
      setMsgSenha({ tipo: 'erro', texto: 'A confirmação não confere com a nova senha.' });
      return;
    }
    setSalvandoSenha(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) {
      setMsgSenha({ tipo: 'erro', texto: 'Erro: ' + error.message });
    } else {
      setMsgSenha({ tipo: 'ok', texto: 'Senha alterada com sucesso.' });
      setNovaSenha('');
      setConfirmaSenha('');
    }
    setSalvandoSenha(false);
  };

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !analista) return;
    if (file.size > 2 * 1024 * 1024) {
      setMsgFoto({ tipo: 'erro', texto: 'A imagem precisa ter no máximo 2 MB.' });
      return;
    }
    setUploadando(true);
    setMsgFoto(null);

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${analista.id}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (upErr) {
      setMsgFoto({ tipo: 'erro', texto: 'Erro no upload: ' + upErr.message });
      setUploadando(false);
      return;
    }

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    const novaUrl = pub.publicUrl;

    const { error: dbErr } = await supabase
      .from('analistas')
      .update({ avatar_url: novaUrl })
      .eq('id', analista.id);

    if (dbErr) {
      setMsgFoto({ tipo: 'erro', texto: 'Erro ao salvar: ' + dbErr.message });
    } else {
      setAnalista({ ...analista, avatar_url: novaUrl });
      setMsgFoto({ tipo: 'ok', texto: 'Foto atualizada com sucesso.' });
    }
    setUploadando(false);
  };

  const handleRemoverFoto = async () => {
    if (!analista) return;
    await supabase.from('analistas').update({ avatar_url: null }).eq('id', analista.id);
    setAnalista({ ...analista, avatar_url: null });
    setMsgFoto({ tipo: 'ok', texto: 'Foto removida.' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    );
  }

  if (!analista) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Perfil não encontrado.</p>
      </div>
    );
  }

  const iniciais = analista.nome
    ? analista.nome
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : analista.email.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar usuario={usuario} avatarUrl={analista.avatar_url} />

      <main className="max-w-3xl mx-auto px-6 py-8">
        <button
          onClick={() => router.back()}
          className="mb-6 text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>

        <div className="mb-8 border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Conta
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Meu perfil</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gerencie suas informações de acesso e identificação.
          </p>
        </div>

        <section className="bg-white border border-slate-200 rounded-md shadow-sm mb-6">
          <header className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Foto de perfil
            </h2>
          </header>
          <div className="p-5 flex items-center gap-5 flex-wrap">
            <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-300 shrink-0">
              {analista.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={analista.avatar_url}
                  alt="Foto de perfil"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-slate-600 font-semibold text-xl">{iniciais}</span>
              )}
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm text-slate-600">
                Use uma imagem quadrada de no máximo 2 MB. Formatos aceitos: JPG, PNG, WebP.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleUploadFoto}
                />
                <button
                  type="button"
                  disabled={uploadando}
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium px-3 py-1.5 rounded border bg-slate-900 text-white border-slate-900 hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  {uploadando ? 'Enviando...' : analista.avatar_url ? 'Trocar foto' : 'Enviar foto'}
                </button>
                {analista.avatar_url && (
                  <button
                    type="button"
                    onClick={handleRemoverFoto}
                    className="text-xs font-medium px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                  >
                    Remover
                  </button>
                )}
              </div>
              {msgFoto && (
                <p
                  className={`mt-2 text-xs ${
                    msgFoto.tipo === 'ok' ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {msgFoto.texto}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-md shadow-sm mb-6">
          <header className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Dados pessoais
            </h2>
          </header>
          <form onSubmit={handleSalvarNome} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                value={analista.email}
                disabled
                className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-500 rounded-md cursor-not-allowed"
              />
              <p className="text-xs text-slate-400 mt-1">
                O e-mail não pode ser alterado. Contate o coordenador caso precise.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Cargo
              </label>
              <input
                type="text"
                value={analista.cargo === 'coordenador' ? 'Coordenador' : 'Analista'}
                disabled
                className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-500 rounded-md cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Nome de exibição
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            {msgNome && (
              <p
                className={`text-xs ${
                  msgNome.tipo === 'ok' ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {msgNome.texto}
              </p>
            )}
            <button
              type="submit"
              disabled={salvandoNome}
              className="text-xs font-medium px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {salvandoNome ? 'Salvando...' : 'Salvar dados'}
            </button>
          </form>
        </section>

        <section className="bg-white border border-slate-200 rounded-md shadow-sm">
          <header className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Trocar senha
            </h2>
          </header>
          <form onSubmit={handleTrocarSenha} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Nova senha
              </label>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <p className="text-xs text-slate-400 mt-1">Mínimo de 6 caracteres.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirmar nova senha
              </label>
              <input
                type="password"
                value={confirmaSenha}
                onChange={(e) => setConfirmaSenha(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            {msgSenha && (
              <p
                className={`text-xs ${
                  msgSenha.tipo === 'ok' ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {msgSenha.texto}
              </p>
            )}
            <button
              type="submit"
              disabled={salvandoSenha || !novaSenha || !confirmaSenha}
              className="text-xs font-medium px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
