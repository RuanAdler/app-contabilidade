import Link from 'next/link';
import { Empresa } from '@/lib/types';

export default function EmpresaCard({ empresa }: { empresa: Empresa }) {
  return (
    <Link href={`/empresa/${empresa.id}`}>
      <div className="bg-white p-4 rounded-lg shadow hover:shadow-lg transition cursor-pointer border border-gray-200">
        <h3 className="font-bold text-lg text-blue-600">{empresa.nome}</h3>
        <p className="text-sm text-gray-500">{empresa.email_contato}</p>
        <p className="text-xs text-gray-400 mt-2">ID: {empresa.id}</p>
      </div>
    </Link>
  );
}
