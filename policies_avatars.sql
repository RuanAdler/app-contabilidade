-- Policies para o bucket "avatars"
-- Permite: qualquer pessoa logada subir/atualizar/excluir; qualquer pessoa ler

-- Leitura pública (qualquer um vê as fotos)
CREATE POLICY "Avatares: leitura publica"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Upload por usuários autenticados
CREATE POLICY "Avatares: upload autenticado"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Atualização por usuários autenticados
CREATE POLICY "Avatares: update autenticado"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- Exclusão por usuários autenticados
CREATE POLICY "Avatares: delete autenticado"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

SELECT 'Policies criadas para o bucket avatars.' AS resultado;
