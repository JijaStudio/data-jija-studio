/*
  Jija Studio product catalogue
  Replace sample products, prices, descriptions, and image paths with your real stock.
  Products below are demo placeholders generated from editable product families.
  Set published: false to hide an item from the storefront until its photos are ready.
*/
// Demo placeholder products have been removed. Only real products should be listed here.
const products = [];

// Featured real product supplied by Jija Studio.
products.unshift({
  id: '121',
  name: 'Dusty Rose Floral Embroidered Kurta Set with Dupatta',
  category: "Ladies Wear",
  price: 2000,
  salePrice: 1200,
  image: 'images/placeholder-fashion.svg',
  images: ['images/placeholder-fashion.svg'],
  video: '',
  description: 'Elegant dusty rose / mauve pink three-piece ethnic set featuring floral embroidery on the kurta front, embroidered V-neckline, three-quarter sleeves, matching straight-fit pants, and a matching sheer embroidered dupatta. Suitable for festive celebrations, family gatherings, parties, and special occasions. Set includes 1 kurta, 1 pant, and 1 dupatta. Please confirm garment measurements and fabric composition before ordering.',
  sizes: ['M', 'L', 'XL', 'XXL'],
  colours: ['Dusty Rose', 'Mauve Pink'],
  stock: 8,
  rating: 0,
  reviewCount: 0,
  badge: '40% OFF',
  published: true,
  placeholder: false
});


// Apply admin catalogue overrides saved in this browser (GitHub Pages has no shared database).
try {
  const saved = JSON.parse(localStorage.getItem('jijaAdminProducts') || 'null');
  if (Array.isArray(saved)) {
    saved.forEach(item => {
      const index = products.findIndex(p => String(p.id) === String(item.id));
      if (index >= 0) products[index] = { ...products[index], ...item };
      else products.push(item);
    });
    for (let i = products.length - 1; i >= 0; i--) {
      if (products[i]._deleted) products.splice(i, 1);
    }
  }
} catch (error) { console.warn('Admin product settings could not be loaded.', error); }
