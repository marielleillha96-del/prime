import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { deliveryPaymentSummary } from '../public/shared/contract-utils.js';
import { renderAcquisitionContractHtml } from '../src/contracts/template.js';

const schedule = { amountValue: 'R$ 50.000,00', downPayment: 'R$ 10.000,00', downPaymentDate: '2026-10-12',
  remainingPayment: 'R$ 40.000,00', remainingPaymentDate: '2026-10-20' };

test('contract displays both payments with their amounts and dates', () => {
  const notes = deliveryPaymentSummary(schedule);
  const html = renderAcquisitionContractHtml({ amountValue: 50000, paymentMethod: 'Pix', paymentNotes: notes });
  for (const text of ['Entrada + restante na entrega', '10.000,00', '40.000,00', '12/10/2026', '20/10/2026', 'a ser pago na entrega']) {
    assert.ok(html.includes(text), text);
  }
});

test('rejects missing, invalid or inconsistent payments', () => {
  for (const changes of [{ downPayment: '' }, { remainingPayment: 0 }, { remainingPayment: -1 },
    { remainingPayment: 'inválido' }, { remainingPayment: 30000 }, { downPaymentDate: '' },
    { remainingPaymentDate: '' }, { remainingPaymentDate: '2026-02-30' }, { remainingPaymentDate: '2026-10-11' }]) {
    assert.throws(() => deliveryPaymentSummary({ ...schedule, ...changes }));
  }
  assert.doesNotThrow(() => deliveryPaymentSummary({ ...schedule, amountValue: 0.3, downPayment: 0.1, remainingPayment: 0.2 }));
});

test('payment selector enables only fields for the chosen option', () => {
  const element = () => ({ classList: { toggle() {} }, closest() { return this; }, addEventListener() {}, value: '', required: false, disabled: false });
  const ids = Object.fromEntries(['contractCatalogSelect', 'contractVehicleDescription', 'contractInstallments',
    'contractDownPayment', 'contractInstallmentCount', 'contractInstallmentValue', 'contractDownPaymentDate',
    'contractInstallmentDay', 'contractRemainingPayment', 'contractRemainingPaymentDate',
    'contractInstallmentCountLabel', 'contractInstallmentValueLabel'].map(id => [id, element()]));
  const selector = { value: 'cash', addEventListener() {} };
  const context = vm.createContext({ document: { getElementById: id => ids[id] }, contractPaymentNotes: selector });
  const html = fs.readFileSync(new URL('../public/admin.html', import.meta.url), 'utf8');
  const start = html.indexOf('      const catalogSelect =');
  const end = html.indexOf('      const paymentSummary =', start);
  vm.runInContext(html.slice(start, end), context);
  const sync = () => vm.runInContext('syncPaymentFields()', context);
  for (const mode of ['delivery', 'installments', 'annual', 'cash']) {
    selector.value = mode;
    sync();
    assert.equal(ids.contractDownPayment.required, mode !== 'cash');
    assert.equal(ids.contractRemainingPayment.required, mode === 'delivery');
    assert.equal(ids.contractRemainingPaymentDate.disabled, mode !== 'delivery');
    assert.equal(ids.contractInstallmentCount.required, ['annual', 'installments'].includes(mode));
    assert.equal(ids.contractInstallmentDay.required, mode === 'installments');
  }
});
