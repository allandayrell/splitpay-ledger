# SplitPay Ledger

[![CI](https://github.com/allandayrell/splitpay-ledger/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/allandayrell/splitpay-ledger/actions/workflows/ci.yml)

## Integrantes

- Allan Dayrell · [GitHub](https://github.com/allandayrell)
- Warley Vieira · [GitHub](https://github.com/warley004)

## Sobre o sistema

O SplitPay Ledger organiza contas de viagens, repúblicas e encontros. Cada projeto tem participantes, pagadores, rateios e um histórico de acertos. A home mostra a pendência de cada usuário. O dono pode renomear, arquivar e reabrir o projeto. Os participantes podem registrar e desfazer acertos.

O motor calcula valores em centavos e sugere transferências determinísticas. Para um grupo com N participantes e saldos válidos, a estratégia gulosa usa no máximo N − 1 transferências. Contas de demonstração, projetos e notificações internas ficam no armazenamento do navegador.

## Tecnologias

- React 19, TypeScript e Vite para a aplicação web.
- Tailwind CSS e Lucide para estilos e ícones.
- Vitest, fast-check e cobertura V8 para testar comportamento e invariantes do domínio.
- Playwright com Chromium para jornadas de usuário e ESLint para análise estática.
- GitHub Actions para validar Linux, Windows e macOS. Codecov recebe o LCOV quando ativado.

## Uso de IA

O Codex foi usado na etapa de conclusão para auditar a implementação, reproduzir regressões, implementar incrementos, escrever testes e preparar a CI e a documentação. Cada alteração publicada passou por revisão do diff e pelos comandos de validação do projeto. O histórico dos PRs registra as alterações e as evidências de cada incremento.

## Execução dos testes

Use Node.js 22.13 ou posterior na série 22.x. Na raiz do repositório, instale exatamente as dependências registradas e o Chromium usado pelos testes.

```sh
npm ci
npx playwright install --only-shell chromium
npm test
npm run test:coverage
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

O Vitest aplica o mínimo de 85% a linhas, branches, funções e statements no domínio e nos serviços. O relatório LCOV fica em `coverage/lcov.info`. O Playwright inicia o build de produção em `127.0.0.1:4173` e executa as jornadas com dados locais. As dependências de sistema do Chromium estão descritas na documentação do navegador. [Playwright](https://playwright.dev/docs/browsers)

Execute `npm run dev` para abrir a aplicação em desenvolvimento. A primeira visita inicia um workspace de demonstração.

## Publicação e cobertura

- **Vercel.** O proprietário deve importar `allandayrell/splitpay-ledger` no painel Vercel, selecionar a branch de produção `main`, escolher Node.js 22.x e publicar. O `vercel.json` define Vite, `npm ci`, `npm run build` e a saída em `dist/`. Depois do deploy, abra a URL exibida e valide a home, a abertura de um projeto e as transferências. [Configuração da Vercel](https://vercel.com/docs/project-configuration/vercel-json)
- **Codecov.** O proprietário deve ativar o repositório no Codecov, obter o token de upload e criar o secret `CODECOV_TOKEN` em **Settings → Secrets and variables → Actions** do repositório. Em **Actions → CI → Run workflow**, escolha `main`. Também é possível executar `gh workflow run ci.yml --ref main`. Confira o passo de upload e a cobertura associada ao SHA no Codecov. Enquanto o secret estiver ausente, a CI testa e gera LCOV nos três sistemas e registra que o envio foi omitido. [Configuração do Codecov](https://docs.codecov.com/docs/codecov-tokens)
