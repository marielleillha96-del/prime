// Run against a disposable local database initialized with supabase/001_init.sql.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';

if (!process.env.DATABASE_URL || !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) {
  throw Error('Use a disposable local DATABASE_URL');
}
const { pool } = await import('../src/auth/db.js');
pool.options.ssl = false;
const repository = await import('../src/admin/repository.js');
const { default: handler } = await import('../api/admin.js');
const { signAccessToken } = await import('../src/auth/security.js');

try {
  await repository.ensureAdminSchema();
  const actor = (await pool.query(`insert into public.app_users
    (full_name,email,whatsapp,cpf,cep,address,number,district,password_hash,role)
    values ('Test admin',$1,'test',$1,'test','test','1','test','test','admin') returning *`,
  [`catalog-test-${randomUUID()}`])).rows[0];
  const call = async (method, body) => {
    const req = { method, body, headers: { authorization: `Bearer ${signAccessToken(actor)}` }, query: { action: 'catalog-items' } };
    const res = { setHeader() {}, end(body) { this.body = JSON.parse(body); } };
    await handler(req, res);
    assert.ok(res.statusCode < 300, JSON.stringify(res.body));
    return res.body.item;
  };
  const base = { title: 'S10', slug: 's10', category: 'Picapes', yearLabel: '2024/2024', price: 50000,
    sections: ['catalogo', 'destaques', 'relacionados'], galleryImages: [], description: 'Descrição original' };
  const first = await call('POST', base);
  const second = await call('POST', { ...base, yearLabel: '2025/2025' });
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.slug, second.slug);
  const concurrent = await Promise.all([call('POST', base), call('POST', base)]);
  assert.equal(new Set([first, second, ...concurrent].map(item => item.slug)).size, 4);

  await call('PUT', { ...base, id: second.id, slug: second.slug, title: 'S10 atualizada', price: 65000, description: 'Nova descrição' });
  const detail = await repository.findPublicCatalogItemBySlug(second.slug);
  assert.equal(detail.title, 'S10 atualizada');
  assert.equal(Number(detail.price), 65000);
  assert.equal(detail.description, 'Nova descrição');
  assert.equal((await repository.listPublicCatalogItems({ section: 'destaques' })).find(item => item.id === second.id).title, detail.title);

  // A default vehicle must stay deleted even when another function instance starts.
  const { DEFAULT_CATALOG_ITEMS } = await import('../src/admin/default-catalog.js');
  const defaultItem = await call('POST', { ...base, slug: DEFAULT_CATALOG_ITEMS[0].slug });
  await call('DELETE', { id: defaultItem.id });
  const fresh = await import(`../src/admin/repository.js?instance=${randomUUID()}`);
  assert.equal(await fresh.findPublicCatalogItemBySlug(defaultItem.slug), null);
  assert.ok(!(await fresh.listPublicCatalogItems()).some(item => item.slug === defaultItem.slug));
  assert.ok(!(await fresh.getAdminDashboardData()).catalogItems.some(item => item.slug === defaultItem.slug));

  // Exercise the actual admin form listeners: year differentiation and stable edit links.
  const html = fs.readFileSync(new URL('../public/admin.html', import.meta.url), 'utf8');
  const elements = Object.fromEntries(['title', 'yearLabel', 'slug'].map(name => [name,
    { value: '', dataset: {}, addEventListener(type, listener) { this.listener = listener; } }]));
  const context = vm.createContext({ catalogForm: { elements }, editingCatalogId: null });
  const slugStart = html.indexOf('      const slugify =');
  vm.runInContext(html.slice(slugStart, html.indexOf('      const onlyDigits', slugStart)), context);
  const syncStart = html.indexOf('      const syncCatalogSlug =');
  vm.runInContext(html.slice(syncStart, html.indexOf('      catalogOpenCreateButton', syncStart)), context);
  elements.title.value = 'GM S10';
  elements.yearLabel.value = '2024/2024';
  elements.title.listener();
  assert.equal(elements.slug.value, 'gm-s10-2024-2024');
  elements.yearLabel.value = '2025/2025';
  elements.yearLabel.listener();
  assert.equal(elements.slug.value, 'gm-s10-2025-2025');
  elements.title.value = 'GM S10 2025/2025';
  elements.title.listener();
  assert.equal(elements.slug.value, 'gm-s10-2025-2025');
  context.editingCatalogId = second.id;
  elements.title.value = 'Novo título';
  elements.title.listener();
  assert.equal(elements.slug.value, 'gm-s10-2025-2025');
  context.editingCatalogId = null;
  elements.slug.value = 'endereco-personalizado';
  elements.slug.listener();
  elements.title.listener();
  assert.equal(elements.slug.value, 'endereco-personalizado');
  console.log('PASS: cadastro com nomes iguais, concorrência, edição pública, exclusão persistente e links do formulário.');
} finally {
  await pool.end();
}
