/* ============================================
   PixelSub — Interactive Functionality
   Cart, Carousel, Search, Modals & More
   ============================================ */

// ============ Product Data (fallback for local file testing) ============
const fallbackProducts = [
  { id: 1, name: "ChatGPT Plus Subscription", category: "ai-tools", price: 650, originalPrice: 1200, image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=400&fit=crop", badge: "hot", description: "Access GPT-4o, DALL·E, and advanced features.", featured: true, bestSeller: true },
  { id: 2, name: "Canva Pro Premium", category: "graphics-tools", price: 150, originalPrice: 350, image: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=400&fit=crop", badge: "sale", description: "Unlock all Canva Pro features.", featured: true, bestSeller: true },
  { id: 6, name: "Office 365 Pro Plus", category: "software", price: 499, originalPrice: 650, image: "https://images.unsplash.com/photo-1633419461186-7d40a38105ec?w=400&h=400&fit=crop", badge: "sale", description: "Microsoft Office 365.", featured: true, bestSeller: true }
];

let products = [];

// ============ Category Data ============
const categories = [
  { id: "all", name: "All Products", icon: "fas fa-th-large", color: "#6c5ce7" },
  { id: "ai-tools", name: "AI Tools", icon: "fas fa-robot", color: "#00cec9" },
  { id: "writing-tools", name: "Writing Tools", icon: "fas fa-pen-fancy", color: "#fd79a8" },
  { id: "educational", name: "Educational", icon: "fas fa-graduation-cap", color: "#fdcb6e" },
  { id: "graphics-tools", name: "Graphics Tools", icon: "fas fa-palette", color: "#e17055" },
  { id: "graphics-resources", name: "Graphics Resources", icon: "fas fa-pen-nib", color: "#00b894" },
  { id: "software", name: "Software & Apps", icon: "fas fa-laptop-code", color: "#0984e3" },
  { id: "vpn", name: "Premium VPN", icon: "fas fa-shield-alt", color: "#6c5ce7" },
  { id: "streaming", name: "Streaming", icon: "fas fa-play-circle", color: "#e74c3c" },
  { id: "gaming", name: "Gaming", icon: "fas fa-gamepad", color: "#2ecc71" },
  { id: "marketing", name: "Marketing Tools", icon: "fas fa-chart-line", color: "#f39c12" },
  { id: "gift-cards", name: "Gift Cards", icon: "fas fa-gift", color: "#e84393" },
  { id: "web-elements", name: "Web Elements", icon: "fas fa-code", color: "#00cec9" }
];

// ============ Cart State ============
let cart = JSON.parse(localStorage.getItem('pixelsub_cart')) || [];

// ============ DOM Ready ============
document.addEventListener('DOMContentLoaded', async () => {
  // Try to load products from API
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      products = await res.json();
      products = products.filter(p => p.active !== false);
    } else {
      products = fallbackProducts;
    }
  } catch (e) {
    products = fallbackProducts;
  }

  initHeroCarousel();
  renderCategories();
  renderSpecialOffers();
  renderBestSellers();
  renderAllProducts();
  renderFeatures();
  initSearch();
  initCart();
  initScrollEffects();
  initMobileNav();
  updateCartUI();
});

// ============ Hero Carousel ============
function initHeroCarousel() {
  const track = document.getElementById('heroTrack');
  const dotsContainer = document.getElementById('heroDots');
  if (!track || !dotsContainer) return;

  const slides = [
    {
      gradient: "linear-gradient(135deg, #e74c3c 0%, #c0392b 60%, #a93226 100%)",
      title: "Premium Digital Products",
      subtitle: "Get access to top-tier tools at unbeatable prices",
      accent: "#ffffff"
    },
    {
      gradient: "linear-gradient(135deg, #2c3e50 0%, #34495e 60%, #1a252f 100%)",
      title: "ChatGPT Plus @ ৳650 Only",
      subtitle: "GPT-4o, DALL·E 3, Code Interpreter & more",
      accent: "#ffffff"
    },
    {
      gradient: "linear-gradient(135deg, #8e44ad 0%, #6c3483 60%, #5b2c6f 100%)",
      title: "Educational Combo Deals",
      subtitle: "Udemy + Coursera + Skillshare at best prices",
      accent: "#ffffff"
    }
  ];

  // Render slides
  track.innerHTML = slides.map((slide) => `
    <div class="hero-slide" style="background: ${slide.gradient};">
      <div class="hero-slide-content">
        <div class="hero-text-overlay">
          <h1 style="color: ${slide.accent}">${slide.title}</h1>
          <p>${slide.subtitle}</p>
          <a href="#all-products" class="btn btn-primary">Shop Now <i class="fas fa-arrow-right"></i></a>
        </div>
      </div>
    </div>
  `).join('');

  // Add slide styles
  const style = document.createElement('style');
  style.textContent = `
    .hero-slide-content { display: flex; align-items: center; justify-content: center; min-height: 340px; padding: 40px 20px; }
    .hero-text-overlay { text-align: center; max-width: 650px; }
    .hero-text-overlay h1 { font-family: 'Poppins', sans-serif; font-size: 2.6rem; font-weight: 800; margin-bottom: 12px; line-height: 1.15; text-shadow: 0 2px 15px rgba(0,0,0,0.2); }
    .hero-text-overlay p { font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 24px; }
    @media (max-width: 768px) { .hero-slide-content { min-height: 220px; } .hero-text-overlay h1 { font-size: 1.5rem; } .hero-text-overlay p { font-size: 0.9rem; } }
    @media (max-width: 480px) { .hero-slide-content { min-height: 180px; } .hero-text-overlay h1 { font-size: 1.2rem; } }
  `;
  document.head.appendChild(style);

  // Dots
  dotsContainer.innerHTML = slides.map((_, i) => `
    <button class="hero-dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Slide ${i + 1}"></button>
  `).join('');

  let currentSlide = 0;
  const totalSlides = slides.length;

  function goToSlide(index) {
    currentSlide = index;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    dotsContainer.querySelectorAll('.hero-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === currentSlide);
    });
  }

  dotsContainer.addEventListener('click', (e) => {
    const dot = e.target.closest('.hero-dot');
    if (dot) goToSlide(parseInt(dot.dataset.index));
  });

  let autoplay = setInterval(() => goToSlide((currentSlide + 1) % totalSlides), 4500);
  const carousel = document.querySelector('.hero-carousel');
  carousel.addEventListener('mouseenter', () => clearInterval(autoplay));
  carousel.addEventListener('mouseleave', () => {
    autoplay = setInterval(() => goToSlide((currentSlide + 1) % totalSlides), 4500);
  });

  let touchStartX = 0;
  carousel.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  carousel.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToSlide((currentSlide + 1) % totalSlides);
      else goToSlide((currentSlide - 1 + totalSlides) % totalSlides);
    }
  });
}

// ============ Render Categories ============
function renderCategories() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;
  grid.innerHTML = categories.map(cat => `
    <div class="category-card ${cat.id === 'all' ? 'active' : ''}" data-category="${cat.id}" onclick="filterByCategory('${cat.id}')">
      <div class="category-icon" style="color: ${cat.color}"><i class="${cat.icon}"></i></div>
      <h3>${cat.name}</h3>
    </div>
  `).join('');
}

// ============ Render Special Offers ============
function renderSpecialOffers() {
  const slider = document.getElementById('specialOfferSlider');
  if (!slider) return;
  const featured = products.filter(p => p.featured);
  slider.innerHTML = featured.map(p => createProductCard(p)).join('');
  initProductSlider();
}

// ============ Render Best Sellers ============
function renderBestSellers() {
  const grid = document.getElementById('bestSellersGrid');
  if (!grid) return;
  const best = products.filter(p => p.bestSeller);
  grid.innerHTML = best.map(p => createProductCard(p)).join('');
}

// ============ Render All Products ============
function renderAllProducts(filter = 'all') {
  const grid = document.getElementById('allProductsGrid');
  if (!grid) return;
  const filtered = filter === 'all' ? products : products.filter(p => p.category === filter);
  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:50px;color:#999;"><i class="fas fa-search" style="font-size:2rem;margin-bottom:12px;display:block;opacity:0.4;"></i><p>No products found in this category.</p></div>`;
    return;
  }
  grid.innerHTML = filtered.map(p => createProductCard(p)).join('');
}

// ============ Create Product Card ============
function createProductCard(product) {
  const badgeHTML = product.badge ? `
    <div class="product-badges">
      <span class="badge badge-${product.badge}">${product.badge === 'sale' ? 'Sale!' : product.badge === 'hot' ? '🔥 Hot' : '✨ New'}</span>
    </div>
  ` : '';

  const priceHTML = product.originalPrice ? `
    <span class="original-price">৳${product.originalPrice.toLocaleString()}</span>
    <span class="current-price">৳${product.price.toLocaleString()}</span>
  ` : `<span class="current-price">৳${product.price.toLocaleString()}</span>`;

  const productUrl = `product.html?id=${product.id}`;

  return `
    <div class="product-card" data-id="${product.id}" data-category="${product.category}">
      <div class="product-image" onclick="window.location.href='${productUrl}'">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        ${badgeHTML}
        <div class="product-actions">
          <button class="product-action-btn" onclick="event.stopPropagation(); openQuickView(${product.id})" title="Quick View">
            <i class="fas fa-eye"></i>
          </button>
          <button class="product-action-btn add-to-cart-btn" onclick="event.stopPropagation(); addToCart(${product.id})" title="Add to Cart">
            <i class="fas fa-cart-plus"></i>
          </button>
        </div>
      </div>
      <div class="product-info">
        <h4><a href="${productUrl}">${product.name}</a></h4>
        <div class="product-price">${priceHTML}</div>
        <button class="buy-now-btn" onclick="event.stopPropagation(); buyNow(${product.id})">
          <i class="fas fa-bolt"></i> Buy Now
        </button>
      </div>
    </div>
  `;
}

// ============ Filter by Category ============
function filterByCategory(categoryId) {
  document.querySelectorAll('.category-card').forEach(card => {
    card.classList.toggle('active', card.dataset.category === categoryId);
  });
  const section = document.getElementById('all-products');
  if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => renderAllProducts(categoryId), 300);
}

// ============ Product Slider ============
function initProductSlider() {
  const container = document.querySelector('.product-slider-container');
  if (!container) return;
  const slider = container.querySelector('.product-slider');
  const prevBtn = container.querySelector('.slider-prev');
  const nextBtn = container.querySelector('.slider-next');
  if (!slider || !prevBtn || !nextBtn) return;

  let scrollPos = 0;
  const cardWidth = 260;

  prevBtn.addEventListener('click', () => {
    scrollPos = Math.max(scrollPos - cardWidth, 0);
    slider.style.transform = `translateX(-${scrollPos}px)`;
  });
  nextBtn.addEventListener('click', () => {
    const maxScroll = slider.scrollWidth - container.offsetWidth;
    scrollPos = Math.min(scrollPos + cardWidth, maxScroll);
    slider.style.transform = `translateX(-${scrollPos}px)`;
  });

  let isDragging = false, startX = 0, startScroll = 0;
  slider.addEventListener('mousedown', (e) => { isDragging = true; startX = e.pageX; startScroll = scrollPos; slider.style.cursor = 'grabbing'; });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const diff = startX - e.pageX;
    const maxScroll = slider.scrollWidth - container.offsetWidth;
    scrollPos = Math.max(0, Math.min(startScroll + diff, maxScroll));
    slider.style.transform = `translateX(-${scrollPos}px)`;
  });
  document.addEventListener('mouseup', () => { isDragging = false; slider.style.cursor = 'grab'; });
}

// ============ Render Features ============
function renderFeatures() {
  const grid = document.getElementById('featuresGrid');
  if (!grid) return;
  const features = [
    { icon: "fas fa-bolt", title: "Instant Delivery", desc: "Get your products delivered within 1-10 minutes via email after purchase." },
    { icon: "fas fa-headset", title: "24/7 Support", desc: "Our dedicated support team is available around the clock to help you." },
    { icon: "fas fa-shield-alt", title: "Secure Payment", desc: "Pay safely with bKash, Nagad, Rocket, or major bank transfers." },
    { icon: "fas fa-undo", title: "Money-back Guarantee", desc: "Not satisfied? Get a full refund within 24 hours of purchase." }
  ];
  grid.innerHTML = features.map(f => `
    <div class="feature-card">
      <div class="feature-icon"><i class="${f.icon}"></i></div>
      <h3>${f.title}</h3>
      <p>${f.desc}</p>
    </div>
  `).join('');
}

// ============ Search ============
function initSearch() {
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  if (!input || !results) return;

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    if (query.length < 2) { results.classList.remove('active'); return; }

    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query)
    );

    if (filtered.length > 0) {
      results.innerHTML = filtered.slice(0, 6).map(p => `
        <div class="search-result-item" onclick="window.location.href='product.html?id=${p.id}'">
          <img src="${p.image}" alt="${p.name}">
          <div class="sr-info">
            <h4>${p.name}</h4>
            <p>৳${p.price.toLocaleString()}</p>
          </div>
        </div>
      `).join('');
    } else {
      results.innerHTML = `<div class="search-no-results">No products found for "${query}"</div>`;
    }
    results.classList.add('active');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar')) results.classList.remove('active');
  });
}

// ============ Cart System ============
function initCart() {
  const cartBtn = document.getElementById('cartBtn');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartClose = document.getElementById('cartClose');
  if (cartBtn) cartBtn.addEventListener('click', openCart);
  if (cartOverlay) cartOverlay.addEventListener('click', closeCart);
  if (cartClose) cartClose.addEventListener('click', closeCart);
}

function openCart() {
  document.getElementById('cartOverlay').classList.add('active');
  document.getElementById('cartSidebar').classList.add('active');
  document.body.style.overflow = 'hidden';
  renderCartItems();
}

function closeCart() {
  document.getElementById('cartOverlay').classList.remove('active');
  document.getElementById('cartSidebar').classList.remove('active');
  document.body.style.overflow = '';
}

function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const existing = cart.find(item => item.id === productId);
  if (existing) existing.qty += 1;
  else cart.push({ id: productId, qty: 1 });
  saveCart();
  updateCartUI();
  showToast(`${product.name} added to cart!`, 'success');
  const badge = document.querySelector('.cart-badge');
  if (badge) { badge.style.animation = 'pulse 0.3s ease'; setTimeout(() => badge.style.animation = '', 300); }
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart(); updateCartUI(); renderCartItems();
}

function updateQty(productId, delta) {
  const item = cart.find(item => item.id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) { removeFromCart(productId); return; }
  saveCart(); updateCartUI(); renderCartItems();
}

function saveCart() { localStorage.setItem('pixelsub_cart', JSON.stringify(cart)); }

function updateCartUI() {
  const badge = document.querySelector('.cart-badge');
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  if (badge) { badge.textContent = totalItems; badge.classList.toggle('show', totalItems > 0); }
}

function renderCartItems() {
  const container = document.getElementById('cartItems');
  const subtotalEl = document.getElementById('cartSubtotal');
  if (!container) return;
  if (cart.length === 0) {
    container.innerHTML = `<div class="cart-empty"><i class="fas fa-shopping-cart"></i><p>Your cart is empty</p></div>`;
    if (subtotalEl) subtotalEl.textContent = '৳0';
    return;
  }
  let subtotal = 0;
  container.innerHTML = cart.map(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) return '';
    subtotal += product.price * item.qty;
    return `
      <div class="cart-item">
        <div class="cart-item-image"><img src="${product.image}" alt="${product.name}"></div>
        <div class="cart-item-info">
          <h4>${product.name}</h4>
          <div class="cart-item-price">৳${product.price.toLocaleString()}</div>
          <div class="cart-item-controls">
            <button class="qty-btn" onclick="updateQty(${product.id}, -1)"><i class="fas fa-minus"></i></button>
            <span class="cart-item-qty">${item.qty}</span>
            <button class="qty-btn" onclick="updateQty(${product.id}, 1)"><i class="fas fa-plus"></i></button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="removeFromCart(${product.id})"><i class="fas fa-trash-alt"></i></button>
      </div>
    `;
  }).join('');
  if (subtotalEl) subtotalEl.textContent = `৳${subtotal.toLocaleString()}`;
}

// ============ Quick View Modal ============
function openQuickView(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const modal = document.getElementById('quickViewModal');
  if (!modal) return;
  const categoryName = categories.find(c => c.id === product.category)?.name || product.category;
  modal.querySelector('.modal-image img').src = product.image;
  modal.querySelector('.modal-image img').alt = product.name;
  modal.querySelector('.modal-details h2').textContent = product.name;
  const priceEl = modal.querySelector('.modal-price');
  priceEl.innerHTML = product.originalPrice
    ? `৳${product.price.toLocaleString()} <span class="original">৳${product.originalPrice.toLocaleString()}</span>`
    : `৳${product.price.toLocaleString()}`;
  modal.querySelector('.modal-desc').textContent = product.description;
  modal.querySelector('.modal-category span').textContent = categoryName;
  modal.querySelector('.modal-add-to-cart').onclick = () => { addToCart(product.id); closeQuickView(); };
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeQuickView() {
  const modal = document.getElementById('quickViewModal');
  if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
}

// ============ Scroll Effects ============
function initScrollEffects() {
  const header = document.querySelector('.header');
  const scrollTopBtn = document.getElementById('scrollTop');
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    if (currentScroll > 100) {
      header.classList.add('scrolled');
      if (currentScroll > lastScroll && currentScroll > 200) header.classList.add('hidden');
      else header.classList.remove('hidden');
    } else { header.classList.remove('scrolled'); header.classList.remove('hidden'); }
    if (scrollTopBtn) scrollTopBtn.classList.toggle('visible', currentScroll > 400);
    lastScroll = currentScroll;
  });
  if (scrollTopBtn) scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ============ Mobile Navigation ============
function initMobileNav() {
  const toggle = document.getElementById('menuToggle');
  const overlay = document.getElementById('mobileNavOverlay');
  const nav = document.getElementById('mobileNav');
  const close = document.getElementById('mobileNavClose');
  function closeNav() { overlay.classList.remove('active'); nav.classList.remove('active'); document.body.style.overflow = ''; }
  if (toggle) toggle.addEventListener('click', () => { overlay.classList.add('active'); nav.classList.add('active'); document.body.style.overflow = 'hidden'; });
  if (overlay) overlay.addEventListener('click', closeNav);
  if (close) close.addEventListener('click', closeNav);
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));
}

// ============ Toast Notifications ============
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ============ Checkout ============
function goToCheckout() {
  if (cart.length === 0) { showToast('Your cart is empty!', 'error'); return; }
  closeCart();
  window.location.href = 'checkout.html';
}

// ============ Buy Now (Direct Checkout) ============
function buyNow(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  // Set cart to only this product
  cart = [{ id: productId, qty: 1 }];
  localStorage.setItem('pixelsub_cart', JSON.stringify(cart));
  window.location.href = 'checkout.html';
}
