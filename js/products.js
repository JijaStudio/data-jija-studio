/*
  Jija Studio product catalogue
  Replace sample products, prices, descriptions, and image paths with your real stock.
  Products below are demo placeholders generated from editable product families.
  Set published: false to hide an item from the storefront until its photos are ready.
*/
const productFamilies = [
  { category: 'Ladies Wear', names: ['Anaya Floral Kurti','Aarohi Festive Kurta Set','Meera Everyday Kurti','Saanvi Embroidered Suit','Ira Cotton Kurti','Avani Ethnic Co-ord'], image: 'images/placeholder-fashion.svg', min: 499, max: 2499, sizes: ['S','M','L','XL','XXL'], colours: ['Emerald','Maroon','Beige','Rose'] },
  { category: 'Sarees', names: ['Paithani Heritage Saree','Kashvi Festive Saree','Mogra Silk-Feel Saree','Rajwada Traditional Saree','Gulabi Occasion Saree'], image: 'images/placeholder-fashion.svg', min: 999, max: 4999, sizes: ['Free Size'], colours: ['Green','Wine','Gold','Pink'] },
  { category: 'Kids Wear', names: ['Tara Party Frock','Little Maharani Dress','Ishani Festive Set','Chiku Cotton Outfit','Myra Celebration Frock'], image: 'images/placeholder-kids.svg', min: 299, max: 1799, sizes: ['1-2Y','3-4Y','5-6Y','7-8Y'], colours: ['Pink','Mint','Yellow','Peach'] },
  { category: 'Jewellery', names: ['Aabha Gold-Tone Jhumka','Sitara Festive Earrings','Kundan Glow Necklace','Chandrika Pendant Set','Moti Pearl Drops'], image: 'images/placeholder-jewellery.svg', min: 149, max: 1499, sizes: ['One Size'], colours: ['Gold','Pearl','Green'] },
  { category: 'Bangles', names: ['Rajni Bridal Bangle Set','Gulnaar Glass Bangles','Kesar Festive Kada','Mira Everyday Bangles'], image: 'images/placeholder-jewellery.svg', min: 99, max: 999, sizes: ['2.4','2.6','2.8','2.10'], colours: ['Gold','Green','Red','Pink'] },
  { category: 'Accessories', names: ['Kashmiri Embroidered Potli','Aarika Hair Accessory Set','Ethnic Mini Sling Bag','Festive Clutch Purse'], image: 'images/placeholder-fashion.svg', min: 199, max: 1299, sizes: ['One Size'], colours: ['Gold','Green','Pink'] }
];

// This array is the main catalogue used by every page. Replace sample data with real product data.
const products = [];
let nextProductId = 1;
productFamilies.forEach((family, familyIndex) => {
  for (let i = 0; i < 20; i++) {
    const name = family.names[i % family.names.length] + (i >= family.names.length ? ` ${Math.floor(i / family.names.length) + 1}` : '');
    const price = family.min + ((i * 137 + familyIndex * 83) % Math.max(100, family.max - family.min));
    const salePrice = i % 3 === 0 ? Math.round(price * 0.85) : price;
    products.push({
      id: String(nextProductId++), name, category: family.category,
      price: Math.round(price / 10) * 10, salePrice: Math.round(salePrice / 10) * 10,
      image: family.image, images: [family.image], video: '',
      description: `A thoughtfully selected ${family.category.toLowerCase()} style from Jija Studio. Please check the available options and product details before ordering. This is sample catalogue content and should be replaced with verified product information.`,
      sizes: family.sizes, colours: family.colours, stock: 8 + (i % 17),
      rating: 4.2 + ((i % 7) / 10), reviewCount: 8 + i * 3,
      badge: i % 3 === 0 ? 'Special price' : (i % 5 === 0 ? 'Bestseller' : ''),
      published: true, placeholder: true
    });
  }
});
// The six editable product families create 120 sample catalogue items for the demo.