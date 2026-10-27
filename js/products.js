/*
  Jija Studio product catalogue
  Replace sample products, prices, descriptions, and image paths with your real stock.
  Products below are demo placeholders generated from editable product families.
  Set published: false to hide an item from the storefront until its photos are ready.
*/
// Demo placeholder products have been removed. Only real products should be listed here.
const products = [];

// Real products are added through the admin panel; no demo products are preloaded.

// Apply admin catalogue overrides saved in this browser (GitHub Pages has no shared database).
try {
  const saved = JSON.parse(localStorage.getItem('jijaAdminProducts') || 'null');
  if (Array.isArray(saved)) {
    saved.forEach(item => {
      if (!item || item.placeholder === true || String(item.id) === '121' || /demo|sample product|dusty rose floral embroidered kurta set with dupatta/i.test(String(item.name || ''))) return;
      const index = products.findIndex(p => String(p.id) === String(item.id));
      if (index >= 0) products[index] = { ...products[index], ...item };
      else products.push(item);
    });
    for (let i = products.length - 1; i >= 0; i--) {
      if (products[i]._deleted) products.splice(i, 1);
    }
  }
} catch (error) { console.warn('Admin product settings could not be loaded.', error); }
