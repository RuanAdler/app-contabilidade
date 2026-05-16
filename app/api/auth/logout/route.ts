import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
}
