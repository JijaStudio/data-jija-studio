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

function isDemoProduct(p) { return !p || p.placeholder === true || String(p.id) === '121' || /demo|sample product|dusty rose floral embroidered kurta set with dupatta/i.test(String(p.name || '')); }

function applyAdminCatalogueAndPaymentSettings() {
  let savedProducts = null, settings = {};
  try { savedProducts = JSON.parse(localStorage.getItem('jijaAdminProducts') || 'null'); } catch {}
  try { settings = JSON.parse(localStorage.getItem('jijaAdminSettings') || '{}') || {}; } catch {}
  if (settings.upiId && /^[^\\s@]+@[^\\s@]+$/.test(settings.upiId)) STORE_CONFIG.upiId = settings.upiId;
  if (settings.upiName) STORE_CONFIG.upiName = settings.upiName;
  if (Array.isArray(savedProducts)) {
    const deleted = new Set(savedProducts.filter(p => p && p._deleted).map(p => String(p.id)));
    const custom = savedProducts.filter(p => p && !p._deleted && !isDemoProduct(p)), ids = new Set(custom.map(p => String(p.id)));
    for (let i = products.length - 1; i >= 0; i--) if (deleted.has(String(products[i].id)) || ids.has(String(products[i].id))) products.splice(i, 1);
    custom.filter(p => p.published !== false).forEach(p => { const item = {...p,id:String(p.id),image:p.image||(p.images&&p.images[0])||'images/placeholder-fashion.svg'}; item.images=Array.isArray(p.images)&&p.images.length?p.images:[item.image]; item.video=p.video||''; item.sizes=p.sizes||['One Size']; item.colours=p.colours||['Default']; item.price=Number(p.price)||0; item.salePrice=Number(p.salePrice)||item.price; item.stock=Number(p.stock)||0; item.rating=Number(p.rating)||0; item.reviewCount=Number(p.reviewCount)||0; item.published=p.published !== false; products.unshift(item); });
  }
}
const JIJA_PALETTES = {
  emerald: {'--green':'#174d38','--green-dark':'#103827','--green-soft':'#e7eee8','--beige':'#f4eee2','--beige-deep':'#e8dcc5','--gold':'#c6a04a','--ink':'#242820','--muted':'#72766e','--white':'#fffefa','--line':'#e8e3d9'},
  rose: {'--green':'#874b5d','--green-dark':'#653344','--green-soft':'#f3e5e9','--beige':'#fbf0f1','--beige-deep':'#eed5dc','--gold':'#c58a78','--ink':'#302329','--muted':'#806d73','--white':'#fffafb','--line':'#eadde1'},
  royal: {'--green':'#234b83','--green-dark':'#17365f','--green-soft':'#e4edf8','--beige':'#f1f5fb','--beige-deep':'#dce6f4','--gold':'#c5a45d','--ink':'#202a39','--muted':'#687587','--white':'#ffffff','--line':'#dfe6ef'},
  plum: {'--green':'#633d69','--green-dark':'#432749','--green-soft':'#eee5f0','--beige':'#f7f0f6','--beige-deep':'#e7d9e9','--gold':'#c9ad83','--ink':'#2b2430','--muted':'#776d7b','--white':'#fffaff','--line':'#e8deea'},
  terracotta: {'--green':'#9a4e36','--green-dark':'#713724','--green-soft':'#f5e7df','--beige':'#fbf0e6','--beige-deep':'#efd8c5','--gold':'#c89b56','--ink':'#30251f','--muted':'#806f64','--white':'#fffaf5','--line':'#eaded3'},
  diwali: {'--green':'#9d210e','--green-dark':'#651608','--green-soft':'#ffead0','--beige':'#fff4df','--beige-deep':'#f7d8a2','--gold':'#f0b429','--ink':'#422116','--muted':'#87644f','--white':'#fffaf0','--line':'#f0d9b6'},
  christmas: {'--green':'#14532d','--green-dark':'#082f1a','--green-soft':'#e0f0e4','--beige':'#f5f4eb','--beige-deep':'#e0e8dd','--gold':'#d7b56d','--ink':'#1d3025','--muted':'#6b7b70','--white':'#fffefa','--line':'#dce4dc'},
  gudipadwa: {'--green':'#176b45','--green-dark':'#10482e','--green-soft':'#e1f0df','--beige':'#fff7e7','--beige-deep':'#f8dfb4','--gold':'#d5a62b','--ink':'#273527','--muted':'#6d7661','--white':'#fffdf6','--line':'#eadfc9'},
  holi: {'--green':'#8b3fb0','--green-dark':'#64258a','--green-soft':'#f4e4ff','--beige':'#fff4fa','--beige-deep':'#fce7b2','--gold':'#f2b705','--ink':'#33203c','--muted':'#806b87','--white':'#fffaff','--line':'#ebd9f0'},
  ganesh: {'--green':'#b93822','--green-dark':'#812417','--green-soft':'#ffeadb','--beige':'#fff5e7','--beige-deep':'#f7d9b0','--gold':'#e9a11b','--ink':'#3e2a22','--muted':'#846b5b','--white':'#fffaf2','--line':'#eedac5'},
  navratri: {'--green':'#b91c35','--green-dark':'#74152a','--green-soft':'#fbe3e7','--beige':'#fff2ed','--beige-deep':'#eed9f5','--gold':'#e8bd48','--ink':'#3b2028','--muted':'#80656d','--white':'#fffaf8','--line':'#efd9df'},
  eid: {'--green':'#075e54','--green-dark':'#06443d','--green-soft':'#dff3ed','--beige':'#f5f7ec','--beige-deep':'#e3ead5','--gold':'#d8bd70','--ink':'#1d302d','--muted':'#667a73','--white':'#fffef7','--line':'#dfe6d8'},
  rakhi: {'--green':'#c04470','--green-dark':'#8e2c51','--green-soft':'#fbe6ee','--beige':'#fff2f6','--beige-deep':'#e9defc','--gold':'#d8ad55','--ink':'#3a2730','--muted':'#806b75','--white':'#fffafd','--line':'#eedce5'},
  sankranti: {'--green':'#168aad','--green-dark':'#11617a','--green-soft':'#e0f4fc','--beige':'#f0faff','--beige-deep':'#d6edfa','--gold':'#f5c542','--ink':'#203440','--muted':'#667d8a','--white':'#fffefe','--line':'#d7e9f1'},
  independence: {'--green':'#21834a','--green-dark':'#14552f','--green-soft':'#e0f2e6','--beige':'#fff9ed','--beige-deep':'#f8e0c3','--gold':'#f28c28','--ink':'#28342d','--muted':'#6e786f','--white':'#fffefa','--line':'#e6e1d4'},
  onam: {'--green':'#176b45','--green-dark':'#10482e','--green-soft':'#e2f0df','--beige':'#fffaf0','--beige-deep':'#eee4c8','--gold':'#d8b75a','--ink':'#2d3529','--muted':'#77796b','--white':'#fffefa','--line':'#e9e2d2'},
  pongal: {'--green':'#27734d','--green-dark':'#194c34','--green-soft':'#e5f0df','--beige':'#fff4d7','--beige-deep':'#f3d9b4','--gold':'#eab308','--ink':'#382a20','--muted':'#7d6a55','--white':'#fffaf0','--line':'#eadcc5'},
  wedding: {'--green':'#6d365e','--green-dark':'#482340','--green-soft':'#f4e4ee','--beige':'#fff6ee','--beige-deep':'#f1dce1','--gold':'#d7bd83','--ink':'#34252e','--muted':'#7f6a75','--white':'#fffaf7','--line':'#eadce1'},
  newyear: {'--green':'#24345f','--green-dark':'#111b3c','--green-soft':'#e5e9f3','--beige':'#f5f5f8','--beige-deep':'#dfe2eb','--gold':'#d8bd70','--ink':'#252a3a','--muted':'#747a8c','--white':'#fffefa','--line':'#e0e2e9'},
  monochrome: {'--green':'#282828','--green-dark':'#111111','--green-soft':'#eeeeeb','--beige':'#f4f1ea','--beige-deep':'#e5e0d6','--gold':'#a18a5a','--ink':'#242424','--muted':'#737373','--white':'#fffefa','--line':'#e2ded5'}
};
const FESTIVAL_PALETTE_KEYS={diwali:'diwali',christmas:'christmas',gudipadwa:'gudipadwa',holi:'holi',ganesh:'ganesh',navratri:'navratri',eid:'eid',rakhi:'rakhi',sankranti:'sankranti',independence:'independence',onam:'onam',pongal:'pongal',wedding:'wedding',newyear:'newyear'};
const FESTIVAL_DECORATIONS={diwali:'🪔 ✨ 🪷 ✨ 🪔',christmas:'🎄 ❄️ 🎅🏻 🎁 ⭐',gudipadwa:'🚩 🌿 🪔 🌼 🚩',holi:'🎨 🌈 💗 🌼 🎨',ganesh:'🐘 🪷 🪔 🌼 🐘',navratri:'💃 ✨ 🪔 🌺 💃',eid:'🌙 ✨ ⭐ 🕌 🌙',rakhi:'🎁 🌸 💝 ✨ 🎁',sankranti:'🪁 ☀️ 🪁 🌤️ 🪁',independence:'🇮🇳 ✨ 🇮🇳 ✨ 🇮🇳',onam:'🌼 🌿 🌼 🌿 🌼',pongal:'🌾 ☀️ 🪴 🌾 ☀️',wedding:'💍 ✨ 🌸 ✨ 💍',newyear:'✨ ⭐ 🎆 ⭐ ✨'};
function applyAdminVisualPreferences(settings) {
  const festival=settings.festivalTheme||'none';
  const paletteKey=FESTIVAL_PALETTE_KEYS[festival]||settings.colorPalette||'emerald';
  const palette = JIJA_PALETTES[paletteKey] || JIJA_PALETTES.emerald;
  Object.entries(palette).forEach(([name, value]) => document.documentElement.style.setProperty(name, value));
  document.documentElement.dataset.festivalTheme=FESTIVAL_DECORATIONS[festival]?'active':'none';
  const hero=document.querySelector('.hero');
  if(hero){
    let decor=hero.querySelector('.festival-decor');
    if(FESTIVAL_DECORATIONS[festival]){
      if(!decor){decor=document.createElement('div');decor.className='festival-decor';decor.setAttribute('aria-label','Festive decoration');hero.prepend(decor);}
      decor.textContent=FESTIVAL_DECORATIONS[festival];decor.hidden=false;
    }else if(decor){decor.hidden=true;}
  }
  document.documentElement.dataset.homeAnimation = ['none','fade','slide','zoom','rise','flip','blur','bounce','rotate','glow','color-pulse','gradient-flow','shimmer'].includes(settings.animationStyle) ? settings.animationStyle : 'fade';
}
let homepageAnimationObserver = null;
function setupHomepageAnimations() {
  const mode = document.documentElement.dataset.homeAnimation || 'fade';
  const targets = document.querySelectorAll('main .hero-copy, main .hero-visual, main .trust-item, main .section-heading, main .category-card, main .product-card, main .story-copy, main .newsletter-inner');
  if (homepageAnimationObserver) homepageAnimationObserver.disconnect();
  targets.forEach(node => {
    node.classList.remove('jija-animate', 'jija-animate-visible');
    node.style.animation = '';
  });
  if (mode === 'none' || !('IntersectionObserver' in window)) {
    targets.forEach(node => node.classList.add('jija-animate-visible'));
    return;
  }
  homepageAnimationObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('jija-animate-visible');
      homepageAnimationObserver.unobserve(entry.target);
    });
  }, {threshold:0.08});
  targets.forEach(node => {
    node.classList.add('jija-animate');
    homepageAnimationObserver.observe(node);
  });
}

function applyAdminHomepageSettings() {
  let settings = {};
  try { settings = JSON.parse(localStorage.getItem('jijaAdminSettings') || '{}') || {}; } catch {}
  applyAdminVisualPreferences(settings);
  document.querySelectorAll('.brand-logo').forEach(img => { img.src = 'https://d2ol7oe51mr4n9.cloudfront.net/user_3K9B8QWO8ldsXECgkrcRH2T3svS/c8225bf7-f76c-467c-a11c-284b88b92c7b.png'; img.alt = 'Jija Studio logo'; });
  const threshold = Math.max(0, Number(settings.freeShippingThreshold ?? 3500) || 0);
  const shippingFee = Math.max(0, Number(settings.shippingFee ?? 50) || 0);
  const offerBanner = document.querySelector('#shipping-offer-banner');
  if (offerBanner) offerBanner.innerHTML = '<span class="shipping-offer-icon">🚚</span><span><strong>Free delivery on orders above ' + money(threshold) + '</strong><small>Orders below ' + money(threshold) + ' have a flat ' + money(shippingFee) + ' delivery charge.</small></span>';
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
  if (Array.isArray(settings.collectionCards)) {
    const grid=document.querySelector('.category-grid');
    if(grid){
      const cards=settings.collectionCards.filter(card=>card&&String(card.title||'').trim()&&String(card.category||'').trim());
      if(cards.length){
        grid.innerHTML=cards.map((card,i)=>{
          const title=escapeHTML(String(card.title||'').trim());
          const subtitle=escapeHTML(String(card.subtitle||'').trim());
          const category=String(card.category||'').trim();
          const image=String(card.image||'images/placeholder-fashion.svg').trim();
          return '<a class="category-card" data-collection-card="'+i+'" href="shop.html?category='+encodeURIComponent(category)+'"><img data-collection-image="'+i+'" src="'+escapeHTML(image)+'" alt="'+title+' collection" loading="lazy"><div><h3 data-collection-title="'+i+'">'+title+'</h3><p data-collection-subtitle="'+i+'">'+subtitle+'</p></div></a>';
        }).join('');
        grid.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{if(!img.dataset.fallbackApplied){img.dataset.fallbackApplied='true';img.src='images/placeholder-fashion.svg';}}, {once:true}));
      }
    }
  }
  const visual = document.querySelector('.hero-visual');
  if (visual && settings.bannerSrc) {
    const heroGrid = visual.closest('.hero-grid');
    if (heroGrid) heroGrid.classList.add('has-admin-banner');
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

window.addEventListener('jija:firebase-data-loaded', () => {
  try { applyAdminCatalogueAndPaymentSettings(); applyAdminHomepageSettings(); setupHome(); setupShop(); }
  catch (error) { console.error('Could not refresh Jija Studio from Firebase data.', error); }
});

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
  const sizeStock = product.stockBySize && typeof product.stockBySize === 'object' ? product.stockBySize : {};
  const hasSizeStock = Object.keys(sizeStock).length > 0;
  const cardStock = trackedStock(product); const hasSizeStock = Object.keys(cardStock||{}).length > 0; const sizeStockHTML = hasSizeStock ? `<p class="size-stock-summary">${(product.sizes && product.sizes.length && !(product.sizes.length===1&&product.sizes[0]==='One Size') ? product.sizes : Object.keys(cardStock)).map(size => { const qty = Math.max(0,Math.floor(Number(cardStock[size] ?? 0))); const unit = isSareeProduct(product) ? (qty === 1 ? ' saree available' : ' sarees available') : (qty === 1 ? ' item available' : ' items available'); return `<span class="${qty > 0 ? 'size-in-stock' : 'size-out-stock'}">${escapeHTML(size)}: ${qty > 0 ? qty + unit : 'Out of stock'}</span>`; }).join('')}</p>` : '';
  return `<article class="product-card">
    <a class="product-image-wrap" href="product.html?id=${encodeURIComponent(product.id)}" aria-label="View ${escapeHTML(product.name)}">
      <img src="${escapeHTML(product.image)}" alt="Sample placeholder image for ${escapeHTML(product.name)} from Jija Studio" loading="lazy">
      ${product.badge ? `<span class="product-badge">${escapeHTML(product.badge)}</span>` : ''}${product.price > 0 && product.salePrice > 0 && product.salePrice < product.price ? `<span class="product-discount">${Math.round((product.price-product.salePrice)/product.price*100)}% OFF</span>` : ''}
      <button class="product-wishlist" type="button" data-wishlist="${escapeHTML(product.id)}" aria-label="Add ${escapeHTML(product.name)} to wishlist" aria-pressed="false">♡</button><button class="quick-add" type="button" data-add="${product.id}" aria-label="Add ${escapeHTML(product.name)} to cart">＋</button>
    </a>
    <div class="product-info"><p class="product-category">${escapeHTML(product.category)}</p>
      <a class="product-name" href="product.html?id=${encodeURIComponent(product.id)}">${escapeHTML(product.name)}</a>
      <div class="price-line"><strong>${money(product.salePrice || product.price)}</strong>${product.salePrice && product.salePrice < product.price ? `<del>${money(product.price)}</del><span class="discount-inline">${Math.round((product.price-product.salePrice)/product.price*100)}% OFF</span>` : ''}</div>
      ${sizeStockHTML}
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
  const wishlistIds=readWishlist();container.querySelectorAll('[data-wishlist]').forEach(button=>{const id=String(button.dataset.wishlist);const saved=wishlistIds.includes(id);button.setAttribute('aria-pressed',String(saved));button.textContent=saved?'♥':'♡';button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleWishlist(id);button.setAttribute('aria-pressed',String(readWishlist().includes(id)));button.textContent=readWishlist().includes(id)?'♥':'♡';renderWishlist();});});
  container.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation();
    const product=findProduct(button.dataset.add);
    const stockMap=product?.stockBySize&&typeof product.stockBySize==='object'?product.stockBySize:null;
    if(stockMap&&Object.keys(stockMap).length){
      const sizes=Array.isArray(product.sizes)?product.sizes:Object.keys(stockMap);
      const available=sizes.find(size=>Number(stockMap[size]??0)>0);
      if(!available){showToast('This product is currently out of stock');return;}
      if(sizes.length>1){location.href='product.html?id='+encodeURIComponent(product.id);return;}
      addToCart(product.id,1,available);
    }else addToCart(button.dataset.add,1);
    button.textContent = '✓';
    setTimeout(() => { if (button.isConnected) button.textContent = '＋'; }, 900);
  }));
}
function trackedStock(product) {
  const map = product && product.stockBySize && typeof product.stockBySize === 'object' ? product.stockBySize : {};
  if (Object.keys(map).length) return map;
  // If a product has defined sizes but no size inventory, treat every size as out of stock.
  const sizes = Array.isArray(product?.sizes) ? product.sizes.filter(Boolean) : [];
  if (sizes.length && !(sizes.length === 1 && sizes[0] === 'One Size')) return Object.fromEntries(sizes.map(size => [size, 0]));
  // Single-quantity products (notably sarees) must have an explicit positive stock value.
  const rawStock = product?.stock;
  const quantity = rawStock === null || rawStock === undefined || String(rawStock).trim() === '' ? 0 : Number(rawStock);
  return { 'One Size': Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0 };
}
function availableForCart(product, size) {
  const map = trackedStock(product);
  if (!map) return Infinity;
  const key = Object.prototype.hasOwnProperty.call(map, size) ? size : (Object.keys(map).length === 1 ? Object.keys(map)[0] : size);
  return Math.max(0, Math.floor(Number(map[key] ?? 0)));
}
function isSareeProduct(product) {
  return /saree|sari/i.test(String(product?.category || ''));
}
function contactForExtraSarees(product, requested, available) {
  const message = 'Hello Jija Studio! I am interested in ' + product.name + '. Your website shows ' + available + ' saree(s) available, but I need ' + requested + '. Could your team please check whether more are available?';
  window.open(whatsappLink(message), '_blank', 'noopener,noreferrer');
}
function cartQuantityForSize(cart, productId, size) {
  return cart.filter(item => String(item.id) === String(productId) && String(item.size || 'One Size') === String(size || 'One Size'))
    .reduce((sum,item) => sum + Math.max(0, Math.floor(Number(item.quantity) || 0)), 0);
}
function validateCartStock(cart, notify = false) {
  const requested = new Map();
  for (const item of cart) {
    const product = findProduct(item.id);
    if (!product || !trackedStock(product)) continue;
    const size = String(item.size || 'One Size');
    const key = String(product.id) + '|' + size;
    requested.set(key, (requested.get(key) || 0) + Math.max(0, Math.floor(Number(item.quantity) || 0)));
  }
  for (const [key, quantity] of requested) {
    const splitAt = key.indexOf('|');
    const product = findProduct(key.slice(0, splitAt));
    const size = key.slice(splitAt + 1);
    const available = availableForCart(product, size);
    if (available <= 0 || quantity > available) {
      if (notify) showToast(available <= 0 ? size + ' is out of stock. Remove it from your bag.' : 'Only ' + available + ' dress' + (available === 1 ? '' : 'es') + ' available in size ' + size + '. Please reduce your quantity.');
      return false;
    }
  }
  return true;
}
function addToCart(id, quantity = 1, size = '', colour = '') {
  const product = findProduct(id); if (!product) return;
  const cart = getCart();
  const map = trackedStock(product);
  if (map) {
    if (!size) {
      const availableSize = (product.sizes || Object.keys(map)).find(s => availableForCart(product, s) > 0);
      if (!availableSize) { showToast('This product is out of stock'); return; }
      size = availableSize;
    }
    const available = availableForCart(product, size);
    const current = cartQuantityForSize(cart, product.id, size);
    if (available <= 0 || current + quantity > available) {
      if (isSareeProduct(product) && current + quantity > available) {
        showToast(available <= 0 ? 'Saree stock is currently unavailable. Contact our team on WhatsApp to ask about availability.' : 'Only ' + available + ' saree(s) are currently available. Contact our team on WhatsApp to ask for more.');
        if (confirm('Only ' + available + ' saree(s) are currently available. Would you like to contact our team on WhatsApp to ask about more?')) contactForExtraSarees(product,current + quantity,available);
      } else {
        showToast(available <= 0 ? size + ' is out of stock' : 'Only ' + available + ' item(s) available in size ' + size);
      }
      return;
    }
  }
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

 
const WISHLIST_KEY='jijaWishlist';
function readWishlist(){try{return JSON.parse(localStorage.getItem(WISHLIST_KEY)||'[]').map(String);}catch{return [];}}
function toggleWishlist(id){const ids=readWishlist();const next=ids.includes(String(id))?ids.filter(x=>x!==String(id)):[...ids,String(id)];localStorage.setItem(WISHLIST_KEY,JSON.stringify(next));}
function renderWishlist(){const root=document.querySelector('#wishlist-products');if(!root)return;const ids=readWishlist();const items=ids.map(id=>findProduct(id)).filter(Boolean);if(!items.length){root.innerHTML='<p class="empty-state">Your wishlist is empty. Tap the heart on a product to save it here.</p>';return;}renderProducts(root,items);}
function renderHomepageReviews(){const root=document.querySelector('#homepage-reviews');if(!root)return;let settings={};try{settings=JSON.parse(localStorage.getItem('jijaAdminSettings')||'{}')||{};}catch{}const reviews=Array.isArray(settings.reviews)?settings.reviews:[];root.innerHTML=reviews.length?reviews.map(r=>'<article class="review-card"><div class="review-stars" aria-label="'+Math.max(1,Math.min(5,Number(r.rating)||5))+' out of 5 stars">'+('★'.repeat(Math.max(1,Math.min(5,Number(r.rating)||5))))+('☆'.repeat(5-Math.max(1,Math.min(5,Number(r.rating)||5))))+'</div><h3>'+escapeHTML(r.name||'Customer')+'</h3><p>'+escapeHTML(r.text||'')+'</p></article>').join(''):'<p>No reviews published yet. We welcome your feedback!</p>';}
function setupWishlistAndReviews(){renderWishlist();renderHomepageReviews();window.addEventListener('jija:reviews-updated',renderHomepageReviews);const form=document.querySelector('#review-form');form?.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(form);const name=String(data.get('reviewName')||'').trim(),rating=String(data.get('reviewRating')||'5'),text=String(data.get('reviewText')||'').trim();if(!name||!text)return;const message='Hello Jija Studio! I would like to submit a customer review.\\n\\nName: '+name+'\\nRating: '+rating+'/5\\nReview: '+text+'\\n\\nPlease review this feedback before publishing it.';const number=STORE_CONFIG.whatsappNumber||'919673960373';window.open('https://wa.me/'+number+'?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');const status=document.querySelector('#review-form-status');if(status)status.textContent='WhatsApp opened with your review. Send it to the store for review and publication.';form.reset();});}

function setupHome() {
  setupHomepageAnimations();
  renderProducts(document.querySelector('#featured-products'), products.filter(p => p.published !== false).slice(0, 8));
  const search = document.querySelector('#hero-search');
  if (search) search.addEventListener('submit', event => { event.preventDefault(); const q = search.querySelector('input').value.trim(); location.href = `shop.html?q=${encodeURIComponent(q)}`; });
}
function setupShop() {
  const grid = document.querySelector('#shop-grid'); if (!grid) return;
  const search = document.querySelector('#shop-search'); const category = document.querySelector('#category-filter'); const subcategory = document.querySelector('#subcategory-filter'); const sort = document.querySelector('#sort-filter'); const count = document.querySelector('#results-count');
  let settings = {};
  try { settings = JSON.parse(localStorage.getItem('jijaAdminSettings') || '{}') || {}; } catch {}
  const params = new URLSearchParams(location.search);
  const allCategories = [...new Set([...products.map(p => p.category).filter(Boolean), ...(settings.categories || []), ...Object.keys(settings.subcategories || {}), ...(Array.isArray(settings.collectionCards) ? settings.collectionCards.map(card => card && card.category).filter(Boolean) : [])])].sort();
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
  <div class="detail-price">${money(product.salePrice || product.price)} ${product.salePrice > 0 && product.salePrice < product.price ? `<del>${money(product.price)}</del><span class="save-tag">${Math.round((product.price-product.salePrice)/product.price*100)}% OFF · Save ${money(product.price-product.salePrice)}</span>` : ''}</div>
  <p class="detail-description">${escapeHTML(product.description)}</p><p class="stock-note" id="detail-stock-note">${trackedStock(product) ? (product.sizes.length > 1 ? 'Choose a size to see availability.' : (availableForCart(product,product.sizes[0] || 'One Size') > 0 ? availableForCart(product,product.sizes[0] || 'One Size') + (isSareeProduct(product) ? ' sarees available' : ' items available') : 'Out of stock')) : (product.stock > 0 ? 'In stock' : 'Out of stock')}</p>
  ${product.sizes.length > 1 || product.sizes[0] !== 'One Size' ? `<label class="field-label" for="product-size">Choose size</label><select id="product-size" class="form-control">${product.sizes.map(s=>{const tracked=!!trackedStock(product);const qty=tracked?availableForCart(product,s):null;return `<option value="${escapeHTML(s)}" ${tracked&&qty<=0?'disabled':''}>${escapeHTML(s)}</option>`;}).join('')}</select>` : ''}
  <label class="field-label" for="product-colour">Colour</label><select id="product-colour" class="form-control">${product.colours.map(c=>`<option>${escapeHTML(c)}</option>`).join('')}</select>
  <div class="detail-actions"><button class="button button-primary" id="detail-add">Add to bag</button><a class="button button-outline" target="_blank" rel="noopener" href="${whatsappLink(`Hello Jija Studio, I am interested in ${product.name} (Product ID: ${product.id}). Please share details.`)}">Ask on WhatsApp</a></div>
  <div class="product-assurance"><p>🚚 <strong>Estimated delivery:</strong> ${escapeHTML(product.deliveryTime || '3–5 days')}</p><p>↩ <strong>Returns:</strong> ${product.returnPolicy==='returnable'?'Returnable':product.returnPolicy==='exchange-only'?'Exchange only':'Non-returnable'}</p><p>💳 <strong>Payment:</strong> ${product.paymentPolicy==='online-cod'?'Online payment or Cash on Delivery':product.paymentPolicy==='cod-only'?'Cash on Delivery only':'Online payment only'}</p><p>♡ Need help? Our team can assist on WhatsApp</p></div></div>`;
  const addButton=document.querySelector('#detail-add');const sizeSelect=document.querySelector('#product-size');const stockNote=document.querySelector('#detail-stock-note');const trackedSizes=!!trackedStock(product);if(!sizeSelect&&trackedSizes&&availableForCart(product,'One Size')<=0){addButton.disabled=true;addButton.textContent='Out of stock';}if(sizeSelect&&trackedSizes){const refreshAvailability=()=>{const size=sizeSelect.value;const qty=availableForCart(product,size);const opt=sizeSelect.selectedOptions[0];if(stockNote)stockNote.textContent=qty>0?qty+(isSareeProduct(product)?(qty===1?' saree available':' sarees available'):(qty===1?' item available':' items available'))+' in this size':'Out of stock';addButton.disabled=!opt||opt.disabled;addButton.textContent=addButton.disabled?'Out of stock':'Add to bag';};if(sizeSelect.options.length&&sizeSelect.selectedOptions[0]?.disabled){const available=[...sizeSelect.options].find(o=>!o.disabled);if(available)sizeSelect.value=available.value;}sizeSelect.addEventListener('change',refreshAvailability);refreshAvailability();}addButton.addEventListener('click', () => addToCart(product.id, 1, sizeSelect?.value || 'One Size', document.querySelector('#product-colour')?.value || ''));
  root.querySelectorAll('[data-gallery-image]').forEach(button => button.addEventListener('click', () => { const idx=Number(button.dataset.galleryImage); const main=root.querySelector('#detail-main-image'); if(main&&galleryImages[idx]) main.src=galleryImages[idx]; root.querySelectorAll('[data-gallery-image]').forEach(b=>b.classList.toggle('active',b===button)); }));
  renderProducts(document.querySelector('#related-products'), products.filter(p => p.category === product.category && p.id !== product.id).slice(0,4));
}
function setupCart() {
  const root = document.querySelector('#cart-items'); if (!root) return;
  const subtotalNode = document.querySelector('#cart-subtotal'); const totalNode = document.querySelector('#cart-total'); const empty = document.querySelector('#cart-empty'); const summary = document.querySelector('#cart-summary'); const shippingNode=document.querySelector('#cart-shipping'); const shippingNote=document.querySelector('#shipping-offer-note'); let shippingSettings={}; try{shippingSettings=JSON.parse(localStorage.getItem('jijaAdminSettings')||'{}')||{};}catch{} const freeThreshold=Math.max(0,Number(shippingSettings.freeShippingThreshold??3500)||0), flatShippingFee=Math.max(0,Number(shippingSettings.shippingFee??50)||0);
  function draw() {
    let cart = getCart().filter(item => findProduct(item.id));
    // Repair any stale cart quantities after stock was edited in the admin panel.
    let cartWasAdjusted = false;
    cart = cart.map(item => { const p=findProduct(item.id); const available=availableForCart(p,item.size); if (available !== Infinity && Number(item.quantity)>available) { cartWasAdjusted=true; return {...item,quantity:available}; } return item; }).filter(item=>Number(item.quantity)>0);
    if (cartWasAdjusted) { saveCart(cart); showToast('Your bag was updated to match available stock.'); }
    if (!cart.length) { root.innerHTML = ''; empty.hidden = false; summary.hidden = true; if(subtotalNode)subtotalNode.textContent=money(0); if(shippingNode)shippingNode.textContent='—'; if(shippingNote)shippingNote.textContent='Free delivery above '+money(freeThreshold)+'. Below that, delivery is '+money(flatShippingFee)+'.'; if(totalNode)totalNode.textContent=money(0); updateCartCount(); return; }
    empty.hidden = true; summary.hidden = false;
    root.innerHTML = cart.map(item => { const p = findProduct(item.id); const price = p.salePrice || p.price; return `<article class="cart-item"><img src="${escapeHTML(p.image)}" alt="Sample placeholder image for ${escapeHTML(p.name)}"/><div class="cart-item-info"><a href="product.html?id=${p.id}" class="cart-item-title">${escapeHTML(p.name)}</a><p class="cart-item-meta">${escapeHTML(item.size || 'One Size')}${item.colour ? ` · ${escapeHTML(item.colour)}` : ''}</p><strong>${money(price)}</strong><button class="text-button remove-item" data-remove="${escapeHTML(item.key)}">Remove</button></div><div class="quantity-control"><button type="button" data-qty="${escapeHTML(item.key)}" data-delta="-1" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button type="button" data-qty="${escapeHTML(item.key)}" data-delta="1" aria-label="Increase quantity">＋</button></div><strong class="line-total">${money(price * item.quantity)}</strong></article>`; }).join('');
    const subtotal = cart.reduce((sum,item) => { const p = findProduct(item.id); return sum + (p.salePrice || p.price) * item.quantity; },0);
    const shipping=subtotal>=freeThreshold?0:flatShippingFee; subtotalNode.textContent = money(subtotal); if(shippingNode)shippingNode.textContent=shipping===0?'FREE':money(shipping); if(shippingNote)shippingNote.textContent=subtotal>=freeThreshold?'You qualify for free delivery!':'Add '+money(Math.max(0,freeThreshold-subtotal))+' more to unlock free delivery.'; totalNode.textContent = money(subtotal+shipping); updateCartCount();
    root.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => { saveCart(getCart().filter(i => i.key !== btn.dataset.remove)); draw(); }));
    root.querySelectorAll('[data-qty]').forEach(btn => { const cartNow=getCart(); const item=cartNow.find(i=>i.key===btn.dataset.qty); const p=item&&findProduct(item.id); const available=item&&p?availableForCart(p,item.size):Infinity; if(item&&Number(btn.dataset.delta)>0&&available!==Infinity&&cartQuantityForSize(cartNow,item.id,item.size)>=available) {btn.disabled=true;btn.title='Maximum available stock reached';} btn.addEventListener('click',()=>{const latest=getCart();const target=latest.find(i=>i.key===btn.dataset.qty);if(!target)return;const product=findProduct(target.id);const delta=Number(btn.dataset.delta);if(delta>0){const limit=availableForCart(product,target.size);if(limit!==Infinity&&cartQuantityForSize(latest,target.id,target.size)+delta>limit){showToast('Only '+limit+' item'+(limit===1?'':'s')+' available in size '+target.size);return;}}target.quantity+=delta;saveCart(latest.filter(i=>i.quantity>0));draw();}); });
  }
  draw();
  const upi = document.querySelector('#upi-id'); if (upi) upi.textContent = STORE_CONFIG.upiId;
  const copy = document.querySelector('#copy-upi'); copy?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(STORE_CONFIG.upiId); showToast('UPI ID copied'); } catch { showToast('Please copy the UPI ID shown above'); } });
  const form = document.querySelector('#checkout-form');
  form?.addEventListener('submit', event => {
    event.preventDefault(); const cart = getCart(); if (!cart.length) { showToast('Your bag is empty'); return; }
    if (!validateCartStock(cart,true)) { draw(); return; }
    const data = new FormData(form); const name = String(data.get('customerName') || '').trim(); const phone = String(data.get('customerPhone') || '').trim(); const address = String(data.get('customerAddress') || '').trim(); const pin = String(data.get('customerPin') || '').trim();
    if (!name || !phone || !address || !pin) { showToast('Please complete all delivery details'); return; }
    const lines = cart.map(item => { const p = findProduct(item.id); return `• ${p.name} (${item.size || 'One Size'}${item.colour ? ', '+item.colour : ''}) × ${item.quantity} — ${money((p.salePrice || p.price) * item.quantity)}`; });
    const subtotal = cart.reduce((sum,item) => sum + (findProduct(item.id).salePrice || findProduct(item.id).price) * item.quantity,0); const shipping=subtotal>=freeThreshold?0:flatShippingFee; const total=subtotal+shipping;
    const message = `Hello Jija Studio! I'd like to place an order.\n\nORDER ITEMS\n${lines.join('\n')}\n\nSubtotal: ${money(subtotal)}\nDelivery: ${shipping===0?'FREE':money(shipping)}\nTotal including delivery: ${money(total)}\n\nCUSTOMER DETAILS\nName: ${name}\nPhone: ${phone}\nAddress: ${address}\nPIN code: ${pin}\n\nPlease confirm availability, shipping charges and payment instructions. I understand this message is an order request, not a confirmed payment.`;
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
    applyAdminCatalogueAndPaymentSettings(); applyAdminHomepageSettings(); setupGlobalUI(); setupWishlistAndReviews(); setupHome(); setupShop(); setupProduct(); setupCart(); setupContact();
    document.querySelectorAll('[data-check-pin]').forEach(form => form.addEventListener('submit', event => { event.preventDefault(); const pin = form.querySelector('input').value.trim(); const output = form.querySelector('[data-pin-result]'); output.textContent = /^\d{6}$/.test(pin) ? 'PIN code format looks valid. Actual delivery availability must be confirmed by the store.' : 'Please enter a valid 6-digit Indian PIN code.'; }));
  } catch (error) {
    console.error('Jija Studio storefront initialisation failed:', error);
    const grids = document.querySelectorAll('#featured-products, #shop-grid, #related-products');
    grids.forEach(grid => { if (!grid.children.length) grid.innerHTML = '<div class="empty-state"><h3>We are having trouble loading this collection.</h3><p>Please refresh the page. If the problem continues, check that both js/products.js and js/main.js are uploaded in the website folder.</p><a class="button button-primary" href="shop.html">Try the shop page</a></div>'; });
  }
});