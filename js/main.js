/* Jija Studio storefront interactions — plain JavaScript, no framework required. */

// IMPORTANT: replace these placeholders before launch. Use country code, digits only.
const STORE_CONFIG = {
  storeName: 'Jija Studio',
  whatsappNumber: '919673960373', // Jija Studio WhatsApp number
  phoneDisplay: '+91 96739 60373',
  upiId: 'yourname@upi', // PLACEHOLDER: replace with your verified UPI ID
  upiName: 'Jija Studio',
  currency: 'INR'
};

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const getCart = () => { try { return JSON.parse(window.localStorage.getItem('jijaCart') || '[]'); } catch { return []; } };
const saveCart = cart => { try { window.localStorage.setItem('jijaCart', JSON.stringify(cart)); } catch (error) { console.warn('Cart could not be saved in this browser context.', error); } updateCartCount(); };
const findProduct = id => products.find(product => product.id === String(id));
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function updateCartCount() {
  const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('[data-cart-count]').forEach(node => { node.textContent = count; node.setAttribute('aria-label', `${count} items in cart`); });
}
function whatsappLink(message = 'Hello Jija Studio! I have a question about your products.') {
  return `https://wa.me/${STORE_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function applyAdminCatalogueAndPaymentSettings() {
  let savedProducts = null, settings = {};
  try { savedProducts = JSON.parse(localStorage.getItem('jijaAdminProducts') || 'null'); } catch {}
  try { settings = JSON.parse(localStorage.getItem('jijaAdminSettings') || '{}') || {}; } catch {}
  if (settings.upiId && /^[^\\s@]+@[^\\s@]+$/.test(settings.upiId)) STORE_CONFIG.upiId = settings.upiId;
  if (settings.upiName) STORE_CONFIG.upiName = settings.upiName;
  if (Array.isArray(savedProducts)) {
    const deleted = new Set(savedProducts.filter(p => p && p._deleted).map(p => String(p.id)));
    const custom = savedProducts.filter(p => p && !p._deleted), ids = new Set(custom.map(p => String(p.id)));
    for (let i = products.length - 1; i >= 0; i--) if (deleted.has(String(products[i].id)) || ids.has(String(products[i].id))) products.splice(i, 1);
    custom.filter(p => p.published !== false).forEach(p => { const item = {...p,id:String(p.id),image:p.image||(p.images&&p.images[0])||'images/placeholder-fashion.svg'}; item.images=Array.isArray(p.images)&&p.images.length?p.images:[item.image]; item.video=p.video||''; item.sizes=p.sizes||['One Size']; item.colours=p.colours||['Default']; item.price=Number(p.price)||0; item.salePrice=Number(p.salePrice)||item.price; item.stock=Number(p.stock)||0; item.rating=Number(p.rating)||0; item.reviewCount=Number(p.reviewCount)||0; products.unshift(item); });
  }
}
function applyAdminHomepageSettings() {
  let settings = {};
  try { settings = JSON.parse(localStorage.getItem('jijaAdminSettings') || '{}') || {}; } catch {}
  const announcement = document.querySelector('[data-admin-announcement]');
  if (announcement && settings.announcement) announcement.textContent = settings.announcement;
  if (settings.whatsappNumber && /^\d{10}$/.test(settings.whatsappNumber)) {
    STORE_CONFIG.whatsappNumber = '91' + settings.whatsappNumber;
    STORE_CONFIG.phoneDisplay = '+91 ' + settings.whatsappNumber.slice(0, 5) + ' ' + settings.whatsappNumber.slice(5);
  }
  const hero = document.querySelector('.hero');
  if (hero && settings.heroTitle) {
    const h = hero.querySelector('h1');
    if (h) h.innerHTML = escapeHTML(settings.heroTitle).replace(/\n/g, '<br>');
  }
  if (hero && settings.heroSubtitle) {
    const p = hero.querySelector('.hero-copy > p:not(.eyebrow)');
    if (p) p.textContent = settings.heroSubtitle;
  }
  const editableText = {
    '[data-admin-collections-title]': settings.collectionsTitle,
    '[data-admin-collections-subtitle]': settings.collectionsSubtitle,
    '[data-admin-featured-title]': settings.featuredTitle,
    '[data-admin-featured-subtitle]': settings.featuredSubtitle,
    '[data-admin-story-title]': settings.storyTitle,
    '[data-admin-story-copy]': settings.storyCopy,
    '[data-admin-contact-title]': settings.contactTitle,
    '[data-admin-contact-copy]': settings.contactCopy
  };
  Object.entries(editableText).forEach(([selector, value]) => {
    const node = document.querySelector(selector);
    if (node && value) node.textContent = value;
  });
  const visual = document.querySelector('.hero-visual');
  if (visual && settings.bannerSrc) {
    visual.innerHTML = settings.bannerType === 'video'
      ? '<video class="admin-hero-video" autoplay muted loop playsinline><source src="' + escapeHTML(settings.bannerSrc) + '"></video>'
      : '<img src="' + escapeHTML(settings.bannerSrc) + '" alt="' + escapeHTML(settings.bannerAlt || 'Jija Studio featured banner') + '">';
  }
  if (hero && settings.couponCode) {
    let coupon = document.querySelector('[data-home-coupon]');
    if (!coupon) { coupon = document.createElement('div'); coupon.setAttribute('data-home-coupon',''); coupon.className = 'home-coupon'; hero.querySelector('.hero-copy')?.appendChild(coupon); }
    coupon.textContent = settings.couponEnabled === false ? '' : (settings.couponText || 'Use coupon') + ' ' + settings.couponCode + (settings.couponDiscount ? ' · ' + settings.couponDiscount : '');
    coupon.hidden = settings.couponEnabled === false;
  }
}

function setupGlobalUI() {
  updateCartCount();
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open'); toggle.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('[data-whatsapp]').forEach(link => link.href = whatsappLink());
  document.querySelectorAll('[data-year]').forEach(node => node.textContent = new Date().getFullYear());
  document.querySelectorAll('[data-phone]').forEach(node => node.textContent = STORE_CONFIG.phoneDisplay);
}

function productCard(product) {
  return `<article class="product-card">
    <a class="product-image-wrap" href="product.html?id=${encodeURIComponent(product.id)}" aria-label="View ${escapeHTML(product.name)}">
      <img src="${escapeHTML(product.image)}" alt="Sample placeholder image for ${escapeHTML(product.name)} from Jija Studio" loading="lazy">
      ${product.badge ? `<span class="product-badge">${escapeHTML(product.badge)}</span>` : ''}
      <button class="quick-add" type="button" data-add="${product.id}" aria-label="Add ${escapeHTML(product.name)} to cart">＋</button>
    </a>
    <div class="product-info"><p class="product-category">${escapeHTML(product.category)}</p>
      <a class="product-name" href="product.html?id=${encodeURIComponent(product.id)}">${escapeHTML(product.name)}</a>
      <div class="price-line"><strong>${money(product.salePrice || product.price)}</strong>${product.salePrice && product.salePrice < product.price ? `<del>${money(product.price)}</del>` : ''}</div>
      <p class="rating">★ ${product.rating.toFixed(1)} <span>(${product.reviewCount} reviews)</span></p>
    </div>
  </article>`;
}
function renderProducts(container, list) {
  if (!container) return;
  container.innerHTML = list.length ? list.map(productCard).join('') : '<div class="empty-state"><span>✦</span><h3>No products found</h3><p>Try changing your search or filters.</p></div>';
  // Keep the storefront usable when a product image path is missing or a file was renamed.
  container.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', () => {
      if (!img.dataset.fallbackApplied) {
        img.dataset.fallbackApplied = 'true';
        img.src = 'images/placeholder-fashion.svg';
        img.alt = 'Jija Studio sample product placeholder';
      }
    }, { once: true });
  });
  container.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation(); addToCart(button.dataset.add, 1); button.textContent = '✓';
    setTimeout(() => { if (button.isConnected) button.textContent = '＋'; }, 900);
  }));
}
function addToCart(id, quantity = 1, size = '', colour = '') {
  const product = findProduct(id); if (!product) return;
  const cart = getCart();
  const key = `${product.id}|${size}|${colour}`;
  const existing = cart.find(item => item.key === key);
  if (existing) existing.quantity += quantity;
  else cart.push({ key, id: product.id, quantity, size, colour });
  saveCart(cart); showToast(`${product.name} added to your bag`);
}
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role','status'); document.body.appendChild(toast); }
  toast.textContent = message; toast.classList.add('visible'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

function setupHome() {
  renderProducts(document.querySelector('#featured-products'), products.filter(p => p.published).slice(0, 8));
  const search = document.querySelector('#hero-search');
  if (search) search.addEventListener('submit', event => { event.preventDefault(); const q = search.querySelector('input').value.trim(); location.href = `shop.html?q=${encodeURIComponent(q)}`; });
}
function setupShop() {
  const grid = document.querySelector('#shop-grid'); if (!grid) return;
  const search = document.querySelector('#shop-search'); const category = document.querySelector('#category-filter'); const subcategory = document.querySelector('#subcategory-filter'); const sort = document.querySelector('#sort-filter'); const count = document.querySelector('#results-count');
  let settings = {};
  try { settings = JSON.parse(localStorage.getItem('jijaAdminSettings') || '{}') || {}; } catch {}
  const params = new URLSearchParams(location.search);
  const allCategories = [...new Set([...products.map(p => p.category).filter(Boolean), ...(settings.categories || []), ...Object.keys(settings.subcategories || {})])].sort();
  if (category) {
    const requested = params.get('category') || 'all';
    category.innerHTML = '<option value="all">All categories</option>' + allCategories.map(name => '<option value="' + escapeHTML(name) + '">' + escapeHTML(name) + '</option>').join('');
    category.value = allCategories.includes(requested) ? requested : 'all';
  }
  function fillSubcategories() {
    if (!subcategory) return;
    const parent = category?.value || 'all';
    const names = parent === 'all'
      ? [...new Set([...products.map(p => p.subcategory).filter(Boolean), ...Object.values(settings.subcategories || {}).flat()])]
      : [...new Set([...(settings.subcategories?.[parent] || []), ...products.filter(p => p.category === parent).map(p => p.subcategory).filter(Boolean)])];
    const requested = params.get('subcategory') || 'all';
    subcategory.innerHTML = '<option value="all">All subcategories</option>' + names.sort().map(name => '<option value="' + escapeHTML(name) + '">' + escapeHTML(name) + '</option>').join('');
    subcategory.value = names.includes(requested) ? requested : 'all';
  }
  fillSubcategories();
  function filter() {
    let list = products.filter(p => p.published !== false);
    const q = (search?.value || '').toLowerCase().trim(); const cat = category?.value || 'all'; const sub = subcategory?.value || 'all';
    if (q) list = list.filter(p => `${p.name} ${p.category} ${p.subcategory || ''} ${p.description}`.toLowerCase().includes(q));
    if (cat !== 'all') list = list.filter(p => p.category === cat);
    if (sub !== 'all') list = list.filter(p => p.subcategory === sub);
    if (sort?.value === 'price-low') list.sort((a,b) => (a.salePrice || a.price) - (b.salePrice || b.price));
    if (sort?.value === 'price-high') list.sort((a,b) => (b.salePrice || b.price) - (a.salePrice || a.price));
    if (sort?.value === 'name') list.sort((a,b) => a.name.localeCompare(b.name));
    renderProducts(grid, list); if (count) count.textContent = `${list.length} styles to discover`;
  }
  [search, subcategory, sort].forEach(control => control?.addEventListener(control === search ? 'input' : 'change', filter));
  category?.addEventListener('change', () => { fillSubcategories(); filter(); });
  filter();
}
function setupProduct() {
  const root = document.querySelector('#product-detail'); if (!root) return;
  const product = findProduct(new URLSearchParams(location.search).get('id'));
  if (!product) { root.innerHTML = '<div class="empty-state"><h2>Product not found</h2><p>This product may have been moved.</p><a class="button button-primary" href="shop.html">Explore the shop</a></div>'; return; }
  const galleryImages = Array.isArray(product.images) && product.images.length ? product.images : [product.image];
  product.sizes = Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ['One Size'];
  product.colours = Array.isArray(product.colours) && product.colours.length ? product.colours : ['Default'];
  const imageNote = product.placeholder ? '<p class="image-note">Sample image — replace with the actual product photo before launch.</p>' : '';
  const galleryHTML = '<div class="detail-gallery"><img class="detail-main-image" id="detail-main-image" src="' + escapeHTML(galleryImages[0] || product.image) + '" alt="' + escapeHTML(product.name) + '" />' +
    (galleryImages.length > 1 ? '<div class="detail-thumbnails">' + galleryImages.map((src,i) => '<button type="button" class="detail-thumb' + (i===0?' active':'') + '" data-gallery-image="' + i + '" aria-label="View product image ' + (i+1) + '"><img src="' + escapeHTML(src) + '" alt=""></button>').join('') + '</div>' : '') +
    (product.video ? '<video class="detail-product-video" controls playsinline preload="metadata" src="' + escapeHTML(product.video) + '"></video>' : '') + imageNote + '</div>';
  root.innerHTML = galleryHTML + `<div class="detail-copy"><p class="eyebrow">${escapeHTML(product.category)}</p><h1>${escapeHTML(product.name)}</h1><p class="rating">★ ${product.rating.toFixed(1)} <span>(${product.reviewCount} sample reviews)</span></p>
  <div class="detail-price">${money(product.salePrice || product.price)} ${product.salePrice < product.price ? `<del>${money(product.price)}</del><span class="save-tag">Special price</span>` : ''}</div>
  <p class="detail-description">${escapeHTML(product.description)}</p><p class="stock-note">${product.stock > 0 ? `✓ In stock (${product.stock} shown in demo)` : 'Currently unavailable'}</p>
  ${product.sizes.length > 1 || product.sizes[0] !== 'One Size' ? `<label class="field-label" for="product-size">Choose size</label><select id="product-size" class="form-control">${product.sizes.map(s=>`<option>${escapeHTML(s)}</option>`).join('')}</select>` : ''}
  <label class="field-label" for="product-colour">Colour</label><select id="product-colour" class="form-control">${product.colours.map(c=>`<option>${escapeHTML(c)}</option>`).join('')}</select>
  <div class="detail-actions"><button class="button button-primary" id="detail-add">Add to bag</button><a class="button button-outline" target="_blank" rel="noopener" href="${whatsappLink(`Hello Jija Studio, I am interested in ${product.name} (Product ID: ${product.id}). Please share details.`)}">Ask on WhatsApp</a></div>
  <div class="product-assurance"><p>✦ Thoughtfully selected styles</p><p>↗ Shipping details confirmed at order</p><p>♡ Need help? Our team can assist on WhatsApp</p></div></div>`;
  document.querySelector('#detail-add').addEventListener('click', () => addToCart(product.id, 1, document.querySelector('#product-size')?.value || 'One Size', document.querySelector('#product-colour')?.value || ''));
  root.querySelectorAll('[data-gallery-image]').forEach(button => button.addEventListener('click', () => { const idx=Number(button.dataset.galleryImage); const main=root.querySelector('#detail-main-image'); if(main&&galleryImages[idx]) main.src=galleryImages[idx]; root.querySelectorAll('[data-gallery-image]').forEach(b=>b.classList.toggle('active',b===button)); }));
  renderProducts(document.querySelector('#related-products'), products.filter(p => p.category === product.category && p.id !== product.id).slice(0,4));
}
function setupCart() {
  const root = document.querySelector('#cart-items'); if (!root) return;
  const subtotalNode = document.querySelector('#cart-subtotal'); const totalNode = document.querySelector('#cart-total'); const empty = document.querySelector('#cart-empty'); const summary = document.querySelector('#cart-summary');
  function draw() {
    const cart = getCart().filter(item => findProduct(item.id));
    if (!cart.length) { root.innerHTML = ''; empty.hidden = false; summary.hidden = true; if(subtotalNode)subtotalNode.textContent=money(0); if(totalNode)totalNode.textContent=money(0); updateCartCount(); return; }
    empty.hidden = true; summary.hidden = false;
    root.innerHTML = cart.map(item => { const p = findProduct(item.id); const price = p.salePrice || p.price; return `<article class="cart-item"><img src="${escapeHTML(p.image)}" alt="Sample placeholder image for ${escapeHTML(p.name)}"/><div class="cart-item-info"><a href="product.html?id=${p.id}" class="cart-item-title">${escapeHTML(p.name)}</a><p class="cart-item-meta">${escapeHTML(item.size || 'One Size')}${item.colour ? ` · ${escapeHTML(item.colour)}` : ''}</p><strong>${money(price)}</strong><button class="text-button remove-item" data-remove="${escapeHTML(item.key)}">Remove</button></div><div class="quantity-control"><button type="button" data-qty="${escapeHTML(item.key)}" data-delta="-1" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button type="button" data-qty="${escapeHTML(item.key)}" data-delta="1" aria-label="Increase quantity">＋</button></div><strong class="line-total">${money(price * item.quantity)}</strong></article>`; }).join('');
    const subtotal = cart.reduce((sum,item) => { const p = findProduct(item.id); return sum + (p.salePrice || p.price) * item.quantity; },0);
    subtotalNode.textContent = money(subtotal); totalNode.textContent = money(subtotal); updateCartCount();
    root.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => { saveCart(getCart().filter(i => i.key !== btn.dataset.remove)); draw(); }));
    root.querySelectorAll('[data-qty]').forEach(btn => btn.addEventListener('click', () => { const cartNow = getCart(); const item = cartNow.find(i => i.key === btn.dataset.qty); if (item) item.quantity += Number(btn.dataset.delta); saveCart(cartNow.filter(i => i.quantity > 0)); draw(); }));
  }
  draw();
  const upi = document.querySelector('#upi-id'); if (upi) upi.textContent = STORE_CONFIG.upiId;
  const copy = document.querySelector('#copy-upi'); copy?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(STORE_CONFIG.upiId); showToast('UPI ID copied'); } catch { showToast('Please copy the UPI ID shown above'); } });
  const form = document.querySelector('#checkout-form');
  form?.addEventListener('submit', event => {
    event.preventDefault(); const cart = getCart(); if (!cart.length) { showToast('Your bag is empty'); return; }
    const data = new FormData(form); const name = String(data.get('customerName') || '').trim(); const phone = String(data.get('customerPhone') || '').trim(); const address = String(data.get('customerAddress') || '').trim(); const pin = String(data.get('customerPin') || '').trim();
    if (!name || !phone || !address || !pin) { showToast('Please complete all delivery details'); return; }
    const lines = cart.map(item => { const p = findProduct(item.id); return `• ${p.name} (${item.size || 'One Size'}${item.colour ? ', '+item.colour : ''}) × ${item.quantity} — ${money((p.salePrice || p.price) * item.quantity)}`; });
    const total = cart.reduce((sum,item) => sum + (findProduct(item.id).salePrice || findProduct(item.id).price) * item.quantity,0);
    const message = `Hello Jija Studio! I'd like to place an order.\n\nORDER ITEMS\n${lines.join('\n')}\n\nTotal: ${money(total)}\n\nCUSTOMER DETAILS\nName: ${name}\nPhone: ${phone}\nAddress: ${address}\nPIN code: ${pin}\n\nPlease confirm availability, shipping charges and payment instructions. I understand this message is an order request, not a confirmed payment.`;
    window.open(whatsappLink(message), '_blank', 'noopener,noreferrer');
    const status = document.querySelector('#checkout-message'); if(status) { status.hidden = false; status.textContent = 'WhatsApp opened with your order request. Send the message to the store and wait for confirmation. Your cart has not been cleared.'; }
  });
}
function setupContact() {
  document.querySelectorAll('[data-store-phone]').forEach(el => el.textContent = STORE_CONFIG.phoneDisplay);
  const form = document.querySelector('#contact-form'); form?.addEventListener('submit', event => { event.preventDefault(); const data = new FormData(form); const message = `Hello Jija Studio!\nName: ${data.get('name')}\nPhone: ${data.get('phone')}\nMessage: ${data.get('message')}`; window.open(whatsappLink(message), '_blank', 'noopener,noreferrer'); });
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    applyAdminCatalogueAndPaymentSettings(); applyAdminHomepageSettings(); setupGlobalUI(); setupHome(); setupShop(); setupProduct(); setupCart(); setupContact();
    document.querySelectorAll('[data-check-pin]').forEach(form => form.addEventListener('submit', event => { event.preventDefault(); const pin = form.querySelector('input').value.trim(); const output = form.querySelector('[data-pin-result]'); output.textContent = /^\d{6}$/.test(pin) ? 'PIN code format looks valid. Actual delivery availability must be confirmed by the store.' : 'Please enter a valid 6-digit Indian PIN code.'; }));
  } catch (error) {
    console.error('Jija Studio storefront initialisation failed:', error);
    const grids = document.querySelectorAll('#featured-products, #shop-grid, #related-products');
    grids.forEach(grid => { if (!grid.children.length) grid.innerHTML = '<div class="empty-state"><h3>We are having trouble loading this collection.</h3><p>Please refresh the page. If the problem continues, check that both js/products.js and js/main.js are uploaded in the website folder.</p><a class="button button-primary" href="shop.html">Try the shop page</a></div>'; });
  }
});