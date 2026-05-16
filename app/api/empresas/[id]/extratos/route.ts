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
    .from('solicitacoes_extrato')
    .select('solicitacoes_extrato.*, bancos_empresa(nome_banco)')
    .eq('bancos_empresa.empresa_id', id);

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
  const { extrato_id, status } = body;

  const { data, error } = await supabase
    .from('solicitacoes_extrato')
    .update({ status, updated_at: new Date() })
    .eq('id', extrato_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
