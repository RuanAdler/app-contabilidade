# Deploy para GitHub e Vercel

## 1. Fazer commit no GitHub

Na pasta `app-contabilidade`, execute no terminal:

```powershell
git add .
git commit -m "Projeto inicial do app de contabilidade"
git branch -M main
git push -u origin main
```

Pronto! O código está no GitHub.

## 2. Deploy na Vercel

1. Acesse https://vercel.com e faça login (use a conta do GitHub)
2. Clique em **Add New...** > **Project**
3. Selecione o repositório `app-contabilidade`
4. Na seção **Environment Variables**, adicione:
   - **NEXT_PUBLIC_SUPABASE_URL** = `<seu_url_do_supabase>`
   - **NEXT_PUBLIC_SUPABASE_ANON_KEY** = `<sua_chave_anon>`
   - **NEXT_PUBLIC_APP_URL** = `https://<seu-projeto>.vercel.app` (veja depois do deploy)
5. Clique em **Deploy**

Espere terminar (2-5 minutos). Sua URL estará pronta, tipo:
`https://app-contabilidade.vercel.app`

## 3. Testar o app

1. Acesse a URL gerada
2. Login com as credenciais que criou no Supabase
3. Se for analista, vê o dashboard de analista; se coordenador, vê o painel do coordenador

## 4. Problemas comuns?

- **"Erro de autenticação"** → Verifique se as variáveis de ambiente estão corretas
- **"Não vejo as empresas"** → Verifique se cadastrou as empresas no Supabase
- **Página em branco** → Abra a console do navegador (F12) e veja se há erros

Pronto! Seu app está no ar! 🚀
