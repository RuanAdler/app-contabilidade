import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const competencia = searchParams.get('competencia');

  let query = supabase
    .from('progresso_checklist')
    .select('progresso_checklist.*, etapas_checklist(nome, ordem)')
    .eq('empresa_id', id)
    .order('ordem', { foreignTable: 'etapas_checklist' });

  if (competencia) {
    query = query.eq('competencia', competencia);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { progresso_id, feito_em, observacao, usuario_id } = body;

  const { data, error } = await supabase
    .from('progresso_checklist')
    .update({ feito_em, observacao, feito_por: usuario_id })
    .eq('id', progresso_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
