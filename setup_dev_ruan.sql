-- Confirma o e-mail e cria o registro de desenvolvedor

UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'ruanadler14@gmail.com';

INSERT INTO analistas (nome, email, cargo)
VALUES ('RUAN (DEV)', 'ruanadler14@gmail.com', 'desenvolvedor')
ON CONFLICT (email) DO UPDATE SET cargo = 'desenvolvedor', nome = 'RUAN (DEV)';

SELECT 'Conta dev pronta. Faça login com ruanadler14@gmail.com / 123456' AS resultado;
