import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const analistaId = searchParams.get('analista_id');

  let query = supabase.from('empresas').select('*');

  if (analistaId) {
    query = query.eq('analista_id', analistaId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nome, analista_id, email_contato } = body;

  const { data, error } = await supabase
    .from('empresas')
    .insert([{ nome, analista_id, email_contato }])
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data[0], { status: 201 });
}
