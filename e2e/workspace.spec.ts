import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const capitolioId = 'grp_capitolio';
const ownerParticipantId = 'p_usr_allan';
const openCapitolio = `open-project-btn-${capitolioId}`;

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort());
  await page.goto('/');
});

test('cria projeto, adiciona participantes e divide uma conta por pesos', async ({ page }) => {
  await page.getByTestId('open-create-project-btn').click();
  await page.getByTestId('new-project-name-input').fill('Viagem E2E');
  await page.getByTestId('submit-create-project-btn').click();

  await expect(page.getByTestId('group-name-heading')).toHaveText('Viagem E2E');
  const nameInput = page.getByTestId('participant-name-input');
  await nameInput.fill('Diana');
  await page.getByTestId('add-participant-btn').click();
  await nameInput.fill('Eduardo');
  await page.getByTestId('add-participant-btn').click();
  await page.getByTestId('expense-total-input').fill('60.00');

  const transfers = page.getByTestId('transfer-instructions-list');
  await expect(transfers.getByRole('listitem')).toHaveCount(2);
  await expect(transfers.getByRole('listitem').filter({ hasText: 'Diana' })).toContainText('R$ 20,00');
  await expect(transfers.getByRole('listitem').filter({ hasText: 'Eduardo' })).toContainText('R$ 20,00');
});

test('valida a soma do rateio exato antes de liberar os acertos', async ({ page }) => {
  await page.getByTestId(openCapitolio).click();
  await page.getByRole('button', { name: 'Valor Fixo Exato' }).click();
  await page.getByTestId(`split-input-exact-${ownerParticipantId}`).fill('50');
  await page.getByTestId('split-input-exact-p_warley_1').fill('30');
  await page.getByTestId('split-input-exact-p_carla_1').fill('10');

  await expect(page.getByTestId('advanced-split-error')).toBeVisible();
  await expect(page.getByTestId('transfer-plan-panel').getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quitar Transferência' })).toHaveCount(0);

  await page.getByTestId('split-input-exact-p_carla_1').fill('20');
  await expect(page.getByTestId('advanced-split-valid')).toBeVisible();
  await expect(page.getByTestId('transfer-instructions-list').getByRole('listitem')).toHaveCount(2);
});

test('quita transferências e desfaz um pagamento pelo histórico', async ({ page }) => {
  await page.getByTestId(openCapitolio).click();
  const payTransfer = page.getByRole('button', { name: 'Quitar Transferência' });
  await expect(payTransfer).toHaveCount(2);
  await payTransfer.first().click();
  await expect(payTransfer).toHaveCount(1);
  await payTransfer.click();

  await expect(page.getByTestId('all-settled-banner')).toBeVisible();
  const history = page.getByTestId('settlements-history');
  await expect(history.getByRole('listitem')).toHaveCount(2);
  await history.getByRole('button', { name: 'Voltar', exact: true }).first().click();

  await expect(payTransfer).toHaveCount(1);
  await expect(history.getByRole('listitem')).toHaveCount(1);
});

test('restaura os valores de vários pagadores após voltar à home e recarregar', async ({ page }) => {
  await page.getByTestId(openCapitolio).click();
  await page.getByTestId('add-payer-select').selectOption('p_warley_1');
  const ownerAmount = page.getByTestId(`payer-amount-input-${ownerParticipantId}`);
  const memberAmount = page.getByTestId('payer-amount-input-p_warley_1');
  await ownerAmount.fill('60');
  await memberAmount.fill('40');
  await expect(page.getByTestId('payers-sum-valid')).toBeVisible();

  await page.getByTestId('back-to-home-btn').click();
  await page.reload();
  await page.getByTestId(openCapitolio).click();

  await expect(ownerAmount).toHaveValue('60.00');
  await expect(memberAmount).toHaveValue('40.00');
  await expect(page.getByTestId('payers-sum-valid')).toBeVisible();
});

test('dono arquiva e participante comum encontra o projeto sem controles do dono', async ({ page }) => {
  await page.getByTestId(openCapitolio).click();
  await page.getByRole('button', { name: 'Arquivar Projeto' }).click();
  await expect(page.getByRole('button', { name: 'Reabrir Projeto' })).toBeVisible();

  await page.getByTestId('back-to-home-btn').click();
  await page.getByTestId('logout-btn').click();
  await page.getByTestId('quick-login-usr_warley').click();
  await page.getByTestId('toggle-archived-section-btn').click();
  const archives = page.getByTestId('section-archived-projects');
  await archives.getByTestId(openCapitolio).click();

  await expect(page.getByTestId('group-name-heading')).toHaveText('Viagem Capitólio 2026');
  await expect(page.getByTestId('participant-readonly-badge')).toBeVisible();
  await expect(page.getByTestId('toggle-archive-project-btn')).toHaveCount(0);
});

test('recarregar mantém um projeto sem despesas em dia', async ({ page }) => {
  const status = page.getByTestId('project-status-badge-grp_republica');
  await expect(status).toHaveText('Grupo: Quite');

  await page.reload();

  await expect(status).toHaveText('Grupo: Quite');
});

test('preserva dados armazenados quando o projeto local não pode ser lido', async ({ page }) => {
  await expect(page.getByTestId('projects-home-view')).toBeVisible();
  const damagedSnapshot = '{"users":';
  await page.evaluate((value) => {
    localStorage.setItem('splitpay_ledger_workspace_v1', value);
  }, damagedSnapshot);

  await page.reload();

  await expect(page.getByRole('alert')).toContainText('dados locais');
  await expect(page.getByTestId('projects-home-view')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('splitpay_ledger_workspace_v1')))
    .toBe(damagedSnapshot);
});

test('divide um subconjunto e exige 100% ao trocar para porcentagem', async ({ page }) => {
  await page.getByTestId(openCapitolio).click();
  await page.getByRole('button', { name: 'Igualitária' }).click();
  await page.getByRole('checkbox', { name: 'Incluir Carla Souza no rateio' }).uncheck();

  const transfers = page.getByTestId('transfer-instructions-list');
  await expect(transfers.getByRole('listitem')).toHaveCount(1);
  await expect(transfers).toContainText('R$ 50,00');

  await page.getByRole('button', { name: 'Porcentagem' }).click();
  await page.getByTestId(`split-input-percentage-${ownerParticipantId}`).fill('50');
  await page.getByTestId('split-input-percentage-p_warley_1').fill('60');
  await expect(page.getByTestId('advanced-split-error')).toContainText('A soma das porcentagens deve ser 100%');
  await expect(page.getByTestId('transfer-instructions-list')).toHaveCount(0);

  await page.getByTestId('split-input-percentage-p_warley_1').fill('50');
  await expect(page.getByTestId('advanced-split-valid')).toBeVisible();
  await page.getByTestId('back-to-home-btn').click();
  await page.reload();
  await page.getByTestId(openCapitolio).click();

  await expect(page.getByRole('button', { name: 'Porcentagem' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('checkbox', { name: 'Incluir Carla Souza no rateio' })).not.toBeChecked();
  await expect(transfers).toContainText('R$ 50,00');
});

test('mantém os pesos da conta gravada ao reabrir e adicionar participante', async ({ page }) => {
  await page.getByTestId(openCapitolio).click();
  const ownerWeight = page.getByTestId(`split-input-shares-${ownerParticipantId}`);
  await ownerWeight.fill('2');
  const transfers = page.getByTestId('transfer-instructions-list');
  await expect(transfers.getByRole('listitem').filter({ hasText: 'Warley' })).toContainText('R$ 25,00');
  await page.getByTestId('back-to-home-btn').click();
  await page.reload();
  await page.getByTestId(openCapitolio).click();

  await expect(ownerWeight).toHaveValue('2');
  await page.getByTestId('participant-name-input').fill('Diana');
  await page.getByTestId('add-participant-btn').click();
  await expect(transfers.getByRole('listitem')).toHaveCount(2);
  await expect(transfers.getByRole('listitem').filter({ hasText: 'Warley' })).toContainText('R$ 25,00');
});

test('registra duas despesas e agrega o total e os saldos do projeto', async ({ page }) => {
  await page.getByTestId('open-create-project-btn').click();
  await page.getByTestId('new-project-name-input').fill('Viagem com despesas');
  await page.getByTestId('submit-create-project-btn').click();

  for (const participant of ['Diana', 'Eduardo', 'Paula']) {
    await page.getByTestId('participant-name-input').fill(participant);
    await page.getByTestId('add-participant-btn').click();
  }
  await page.getByLabel('Descrição da despesa').fill('Hospedagem');
  await page.getByLabel('Categoria').selectOption('ACCOMMODATION');
  await page.getByTestId('expense-total-input').fill('120');
  await page.getByRole('button', { name: 'Salvar despesa' }).click();

  await page.getByRole('button', { name: 'Nova despesa' }).click();
  await page.getByLabel('Descrição da despesa').fill('Jantar');
  await page.getByLabel('Categoria').selectOption('FOOD');
  await page.getByTestId('expense-total-input').fill('60');
  await page.getByRole('button', { name: 'Salvar despesa' }).click();

  const records = page.getByTestId('expense-list');
  await expect(records.getByRole('listitem')).toHaveCount(2);
  await expect(records.getByRole('listitem').filter({ hasText: 'Jantar' })).toContainText('Alimentação');
  await expect(page.getByTestId('expense-total-spent')).toHaveText('R$ 180,00');
  const transfers = page.getByTestId('transfer-instructions-list');
  await expect(transfers.getByRole('listitem')).toHaveCount(3);
  await expect(transfers.getByRole('listitem').filter({ hasText: 'Diana' })).toContainText('R$ 45,00');
});

test('edita e exclui despesas pelo histórico e mantém o projeto vazio após recarregar', async ({ page }) => {
  await page.getByTestId(openCapitolio).click();
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  await page.getByLabel('Descrição da despesa').fill('Jantar');
  await page.getByTestId('expense-total-input').fill('60');
  await page.getByRole('button', { name: 'Salvar despesa' }).click();

  await page.getByRole('button', { name: 'Editar despesa Conta do Projeto' }).click();
  await page.getByTestId('expense-total-input').fill('120');
  await page.getByRole('button', { name: 'Salvar despesa' }).click();
  await expect(page.getByTestId('expense-total-spent')).toHaveText('R$ 180,00');

  await page.getByRole('button', { name: 'Excluir despesa Jantar' }).click();
  await expect(page.getByTestId('expense-total-spent')).toHaveText('R$ 120,00');
  const transfers = page.getByTestId('transfer-instructions-list');
  await expect(transfers.getByRole('listitem').filter({ hasText: 'Warley' })).toContainText('R$ 40,00');

  await page.getByRole('button', { name: 'Excluir despesa Conta do Projeto' }).click();
  await expect(page.getByTestId('all-settled-banner')).toBeVisible();
  await page.getByTestId('back-to-home-btn').click();
  await page.reload();
  await page.getByTestId(openCapitolio).click();

  await expect(page.getByTestId('expense-total-spent')).toHaveText('R$ 0,00');
  await expect(page.getByTestId('all-settled-banner')).toBeVisible();
});

test('filtra despesas, baixa relatórios e restaura as despesas após recarregar', async ({ page }) => {
  await page.getByTestId(openCapitolio).click();
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  await page.getByLabel('Descrição da despesa').fill('Jantar');
  await page.getByLabel('Categoria', { exact: true }).selectOption('FOOD');
  await page.getByTestId('expense-total-input').fill('60');
  await page.getByRole('checkbox', { name: 'Incluir Carla Souza no rateio' }).uncheck();
  await page.getByRole('button', { name: 'Salvar despesa' }).click();

  const records = page.getByTestId('expense-list');
  await page.getByLabel('Filtrar por participante').selectOption('p_carla_1');
  await expect(records.getByRole('listitem')).toHaveCount(1);
  await expect(records).toContainText('Conta do Projeto');
  await page.getByLabel('Tipo de despesa').selectOption('FOOD');
  await expect(page.getByText('Nenhuma despesa corresponde aos filtros.')).toBeVisible();
  await page.getByLabel('Filtrar por participante').selectOption('p_warley_1');
  await expect(records).toContainText('Jantar');

  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Baixar CSV da lista' }).click(),
  ]);
  const csvContent = await readFile(await csv.path(), 'utf8');
  expect(csv.suggestedFilename()).toBe('splitpay-despesas.csv');
  expect(csvContent).toContain('Jantar,FOOD');
  expect(csvContent).not.toContain('Conta do Projeto');

  const [summary] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Baixar resumo em texto' }).click(),
  ]);
  expect(await readFile(await summary.path(), 'utf8')).toContain('Total gasto R$ 160,00');

  await page.getByTestId('back-to-home-btn').click();
  await page.reload();
  await page.getByTestId(openCapitolio).click();
  await expect(records.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByTestId('expense-total-spent')).toHaveText('R$ 160,00');
});

test('edita o nome de um participante preservando o vínculo e as transferências', async ({ page }) => {
  await page.getByTestId(openCapitolio).click();
  const participant = page.getByTestId('participant-item-p_warley_1');
  await participant.getByRole('button', { name: 'Editar Warley' }).click();
  const name = participant.getByRole('textbox', { name: 'Novo nome do participante' });
  await name.fill('Carla Souza');
  await participant.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(participant.getByRole('alert')).toBeVisible();

  await name.fill('Warley da viagem');
  await participant.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(participant.getByTestId('participant-name-p_warley_1')).toHaveText('Warley da viagem');
  await expect(participant.getByTestId('participant-linked-badge-p_warley_1')).toContainText('warley@splitpay.dev');
  const transfer = page.getByTestId(`transfer-item-p_warley_1-${ownerParticipantId}`);
  await expect(transfer).toContainText('Warley da viagem');
  await expect(transfer).toContainText('R$ 33,33');
  await page.getByTestId('back-to-home-btn').click();
  await page.reload();
  await page.getByTestId(openCapitolio).click();
  await expect(participant.getByTestId('participant-name-p_warley_1')).toHaveText('Warley da viagem');
});

test('registra, restaura e reverte uma quitação parcial sem exceder a dívida', async ({ page }) => {
  await page.getByTestId(openCapitolio).click();
  const transfer = page.getByTestId(`transfer-item-p_warley_1-${ownerParticipantId}`);
  await transfer.getByRole('button', { name: 'Registrar parte' }).click();
  const amount = transfer.getByRole('spinbutton', { name: 'Valor do pagamento parcial' });
  const register = transfer.getByRole('button', { name: 'Registrar pagamento' });
  await amount.fill('40');
  await register.click();
  await expect(transfer.getByRole('alert')).toContainText('não pode ultrapassar');
  await expect(page.getByTestId('settlements-history')).toHaveCount(0);

  await amount.fill('10');
  await register.click();
  await expect(transfer).toContainText('R$ 23,33');
  await expect(page.getByTestId('settlements-history')).toContainText('R$ 10,00');
  await page.getByTestId('back-to-home-btn').click();
  await page.reload();
  await page.getByTestId(openCapitolio).click();
  await expect(transfer).toContainText('R$ 23,33');
  await page.getByTestId('settlements-history').getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(transfer).toContainText('R$ 33,33');
});

test('converte uma despesa estrangeira antes do rateio e restaura o câmbio após recarga', async ({ page }) => {
  await page.getByTestId(openCapitolio).click();
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  await page.getByLabel('Descrição da despesa').fill('Museu em dólar');
  await page.getByTestId('expense-currency-select').selectOption('USD');
  await page.getByTestId('expense-total-input').fill('2.50');
  const save = page.getByRole('button', { name: 'Salvar despesa' });
  await expect(save).toBeDisabled();
  await expect(page.getByTestId('multi-currency-selector').getByRole('alert')).toContainText('taxa de câmbio');

  const rate = page.getByTestId('expense-exchange-rate-input');
  await rate.fill('5.40');
  await expect(page.getByTestId('currency-conversion-preview')).toContainText('R$ 13,50');
  await expect(page.getByTestId(`payer-amount-input-${ownerParticipantId}`)).toHaveValue('13.50');
  await save.click();

  const record = page.getByTestId('expense-list').getByRole('listitem').filter({ hasText: 'Museu em dólar' });
  await expect(record).toContainText('US$ 2,50 (câmbio 5,40)');
  await expect(page.getByTestId('expense-total-spent')).toHaveText('R$ 113,50');
  await page.getByTestId('back-to-home-btn').click();
  await page.reload();
  await page.getByTestId(openCapitolio).click();
  await page.getByRole('button', { name: 'Editar despesa Museu em dólar' }).click();
  await expect(page.getByTestId('expense-total-input')).toHaveValue('2.50');
  await expect(rate).toHaveValue('5.4');
  await expect(record).toContainText('R$ 13,50');
});

test('exibe rateio, total e transferências na moeda-base estrangeira do projeto', async ({ page }) => {
  await page.getByTestId('open-create-project-btn').click();
  await page.getByTestId('new-project-name-input').fill('Viagem em dólar');
  await page.getByTestId('new-project-currency-select').selectOption('USD');
  await page.getByTestId('submit-create-project-btn').click();
  await page.getByTestId('participant-name-input').fill('Diana');
  await page.getByTestId('add-participant-btn').click();
  await page.getByTestId('expense-total-input').fill('10');
  await page.getByRole('button', { name: 'Salvar despesa' }).click();

  await expect(page.getByTestId('expense-total-spent')).toHaveText(/US\$\s+10,00/);
  await expect(page.getByTestId('advanced-split-inputs')).toContainText(/US\$\s+5,00/);
  await expect(page.getByTestId('transfer-instructions-list')).toContainText(/US\$\s+5,00/);
});
