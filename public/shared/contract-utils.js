export const formatBRL = value => Number(value || 0).toLocaleString("pt-BR", {style: "currency", currency: "BRL"});
export function parseBRL(value) {
 if (typeof value === 'number') return value;
 let s = String(value || '').replace('R$', '').trim();
 if (s.includes(',')) s = s.split('.').join('').replace(',', '.');
 else if (s.split('.').slice(1).every(p => p.length === 3)) s = s.split('.').join('');
 return Number(s);
}
export const fullAddress = u => u ? [u.address, u.number, u.complement, u.district, u.city, u.state, u.cep].filter(Boolean).join(", ") : "";
export function deliveryPaymentSummary({ amountValue, downPayment, downPaymentDate, remainingPayment, remainingPaymentDate }) {
 const entry = parseBRL(downPayment), remaining = parseBRL(remainingPayment), total = parseBRL(amountValue);
 if (![entry, remaining, total].every(value => Number.isFinite(value) && value > 0)) {
  throw new Error('Informe valores válidos para a entrada, o restante na entrega e o total do contrato.');
 }
 if (Math.round(entry * 100) + Math.round(remaining * 100) !== Math.round(total * 100)) {
  throw new Error('A entrada mais o restante na entrega deve ser igual ao valor do contrato.');
 }
 const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
 if (!validDate(downPaymentDate) || !validDate(remainingPaymentDate)) {
  throw new Error('Informe a data da entrada e a data do pagamento do restante na entrega.');
 }
 if (remainingPaymentDate < downPaymentDate) {
  throw new Error('A data do restante na entrega não pode ser anterior à data da entrada.');
 }
 const dateBR = value => value.split('-').reverse().join('/');
 return `Entrada + restante na entrega. Entrada de ${formatBRL(entry)}, com pagamento em ${dateBR(downPaymentDate)}, e restante de ${formatBRL(remaining)}, a ser pago na entrega, em ${dateBR(remainingPaymentDate)}.`;
}
const small = ['dezenove','dezoito','dezessete','dezesseis','quinze','catorze','treze','doze','onze','dez','nove','oito','sete','seis','cinco','quatro','três','dois','um','zero'].reverse();
const tens = ['noventa','oitenta','setenta','sessenta','cinquenta','quarenta','trinta','vinte','',''].reverse();
const hundreds = ['novecentos','oitocentos','setecentos','seiscentos','quinhentos','quatrocentos','trezentos','duzentos','cento',''].reverse();
function integerWords(n) {
 if (n < 20) return small[n];
 if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' e '+small[n%10] : '');
 if (n === 100) return 'cem';
 if (n < 1000) return hundreds[Math.floor(n/100)] + (n%100 ? ' e '+integerWords(n%100) : '');
 const scale = n >= 1000000000 ? 1000000000 : n >= 1000000 ? 1000000 : 1000;
 const head = Math.floor(n/scale), rest = n%scale;
 const label = scale === 1000 ? (head===1 ? 'mil' : integerWords(head)+' mil') : integerWords(head)+(scale===1000000 ? (head===1?' milhão':' milhões') : (head===1?' bilhão':' bilhões'));
 return label + (rest ? (rest < 100 || rest%100===0 ? ' e ' : ', ')+integerWords(rest) : '');
}
export function amountWords(value) {
 const cents = Math.round(parseBRL(value)*100);
 if (!Number.isSafeInteger(cents) || cents < 0 || cents >= 100000000000000) return '';
 const reais = Math.floor(cents/100), fraction = cents%100;
 const main = reais ? integerWords(reais)+(reais%1000000===0?' de reais':reais===1?' real':' reais') : '';
 return main + (fraction ? (main?' e ':'')+integerWords(fraction)+(fraction===1?' centavo':' centavos') : main?'':'zero reais');
}
