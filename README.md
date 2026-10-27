# Jija Studio Storefront

A responsive static e-commerce storefront prototype for Jija Studio, built with plain HTML, CSS, and vanilla JavaScript.

## Pages
- `index.html` — Home page
- `shop.html` — Product browsing and filters
- `product.html` — Product details (uses a query string)
- `cart.html` — Shopping cart
- `about.html` — About the shop
- `contact.html` — Contact page

## Assets and scripts
- `css/style.css` — Responsive styling
- `js/products.js` — Demo product data
- `js/main.js` — Storefront interactions
- `images/` — Brand logo and placeholder product artwork

## Run locally
Open `index.html` in a browser. No build tools, npm, or framework are required.

## Notes
This is a static demo storefront. Cart state is stored in the browser with localStorage. Payment, delivery PIN checks, user accounts, and order notifications require real integrations before production use. Replace the demo product imagery and placeholder checkout details before launch.

## Deploy with GitHub Pages
In the repository, open **Settings → Pages**, select **Deploy from a branch**, choose `main` and the `/ (root)` folder, then save.