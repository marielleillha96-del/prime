(() => {
  const category = document.getElementById('homeCategory');
  const query = document.getElementById('homeQuery');
  const count = document.getElementById('homeSearchCount');
  let items = null;
  const update = () => {
    if (items) count.textContent = `(${items.filter((item) => window.primeCatalogMatches(item, category.value, query.value)).length})`;
  };
  category.addEventListener('change', update);
  query.addEventListener('input', update);
  fetch('/api/catalog/items?section=catalogo')
    .then((response) => { if (!response.ok) throw new Error('Catalog unavailable'); return response.json(); })
    .then((data) => { if (Array.isArray(data.items)) { items = data.items; update(); } })
    .catch(() => { count.textContent = ''; });
})();
