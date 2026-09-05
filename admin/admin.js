// ===== Admin Panel JavaScript =====

let allProducts = [];
let allOrders = [];

// Escape untrusted text before putting it in innerHTML. Order fields come
// straight from customers, so they must never be treated as markup.
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initLogin();
  initNavigation();
  initSidebar();
  initProductForm();
  initSettingsForm();
  initPasswordForm();
});

// ===== Auth =====
async function checkAuth() {
  try {
    const res = await fetch('/api/auth-check');
    const data = await res.json();
    if (data.authenticated) {
      showAdmin();
    }
  } catch (e) { /* not logged in */ }
}

function initLogin() {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    const errorEl = document.getElementById('loginError');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        showAdmin();
      } else {
        errorEl.textContent = 'Invalid username or password';
      }
    } catch (e) {
      errorEl.textContent = 'Server error. Please try again.';
    }
  });
}

async function logout() {
  await fetch('/api/logout');
  document.getElementById('adminApp').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginPass').value = '';
}

function showAdmin() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminApp').style.display = 'flex';
  loadDashboard();
}

// ===== Navigation =====
function initNavigation() {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });
}

// `resetForm` is false when arriving from editProduct(), which has already
// filled the form — resetting here would wipe the id and save a new product.
function navigateTo(page, { resetForm = true } = {}) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  // Update title
  const titles = {
    'dashboard': 'Dashboard',
    'products': 'Products',
    'orders': 'Orders',
    'add-product': 'Add Product',
    'banners': 'Banners',
    'settings': 'Settings'
  };
  document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';

  // Load page data
  if (page === 'dashboard') loadDashboard();
  if (page === 'products') loadProducts();
  if (page === 'orders') loadOrders();
  if (page === 'settings') loadSettings();
  if (page === 'banners') loadBanners();
  if (page === 'add-product' && resetForm) resetProductForm();

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('active');
}

// ===== Sidebar Mobile =====
function initSidebar() {
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
  });
  document.getElementById('sidebarClose').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('active');
  });
}

// ===== Dashboard =====
async function loadDashboard() {
  try {
    const res = await fetch('/api/products');
    allProducts = await res.json();

    document.getElementById('statProducts').textContent = allProducts.length;
    const cats = new Set(allProducts.map(p => p.category));
    document.getElementById('statCategories').textContent = cats.size;
    document.getElementById('statFeatured').textContent = allProducts.filter(p => p.featured).length;
    document.getElementById('statBestSellers').textContent = allProducts.filter(p => p.bestSeller).length;

    const outOfStock = allProducts.filter(p => p.inStock === false).length;
    document.getElementById('statInStock').textContent = allProducts.length - outOfStock;
    document.getElementById('statOutStock').textContent = outOfStock;
  } catch (e) {
    showToast('Failed to load dashboard', 'error');
  }
}

// ===== Products Table =====
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    allProducts = await res.json();
    renderProductsTable();
  } catch (e) {
    showToast('Failed to load products', 'error');
  }
}

function renderProductsTable() {
  const tbody = document.getElementById('productsTableBody');
  if (!allProducts.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#999;">No products found</td></tr>';
    return;
  }

  tbody.innerHTML = allProducts.map(p => {
    const badgeHTML = p.badge
      ? `<span class="table-badge ${p.badge}">${p.badge}</span>`
      : '<span style="color:#ccc;">—</span>';

    return `
      <tr>
        <td><img src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.src='https://via.placeholder.com/44'"></td>
        <td><strong>${esc(p.name)}</strong>${p.showFirst ? ' <span class="pin-tag"><i class="fas fa-thumbtack"></i> first</span>' : ''}</td>
        <td>${esc(p.category)}</td>
        <td><strong style="color:#1560f0;">৳${p.price.toLocaleString()}</strong>${p.originalPrice ? `<br><s style="color:#999;font-size:0.75rem;">৳${p.originalPrice.toLocaleString()}</s>` : ''}</td>
        <td>${badgeHTML}</td>
        <td>
          <button class="stock-toggle ${p.inStock === false ? 'out' : 'in'}"
                  onclick="toggleStock(${p.id})"
                  title="Click to switch">
            ${p.inStock === false ? 'Stock Out' : 'In Stock'}
          </button>
        </td>
        <td>${p.featured ? '<i class="fas fa-star" style="color:#f39c12;"></i>' : '—'}</td>
        <td>
          <div class="table-actions">
            <button class="table-btn edit" onclick="editProduct(${p.id})" title="Edit"><i class="fas fa-pen"></i></button>
            <button class="table-btn delete" onclick="deleteProduct(${p.id})" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ===== Repeatable rows: plans, FAQs, reviews =====
// Each section is a list of rows read straight from the DOM on save, so there
// is no separate state to keep in sync.

function addPlanRow(plan = {}) {
  const row = document.createElement('div');
  row.className = 'repeat-row plan-row';
  row.innerHTML = `
    <input type="text" class="plan-validity" placeholder="1 Month *" value="${esc(plan.validity)}">
    <input type="text" class="plan-package" placeholder="Shared" value="${esc(plan.packageType)}">
    <input type="text" class="plan-sublabel" placeholder="30 days access" value="${esc(plan.sublabel)}">
    <input type="number" class="plan-price" placeholder="Price" min="0" step="1" value="${plan.price ?? ''}">
    <input type="number" class="plan-original" placeholder="Was" min="0" step="1" value="${plan.originalPrice ?? ''}">
    <button type="button" class="repeat-remove" title="Remove"><i class="fas fa-trash"></i></button>
  `;
  row.querySelector('.repeat-remove').addEventListener('click', () => {
    row.remove();
    refreshEmptyStates();
  });
  document.getElementById('planRows').appendChild(row);
  refreshEmptyStates();
}

function addFaqRow(faq = {}) {
  const row = document.createElement('div');
  row.className = 'repeat-row faq-row';
  row.innerHTML = `
    <div class="repeat-stack">
      <input type="text" class="faq-question" placeholder="Question" value="${esc(faq.question)}">
      <textarea class="faq-answer" placeholder="Answer">${esc(faq.answer)}</textarea>
    </div>
    <button type="button" class="repeat-remove" title="Remove"><i class="fas fa-trash"></i></button>
  `;
  row.querySelector('.repeat-remove').addEventListener('click', () => {
    row.remove();
    refreshEmptyStates();
  });
  document.getElementById('faqRows').appendChild(row);
  refreshEmptyStates();
}

function addReviewRow(review = {}) {
  const rating = review.rating ?? 5;
  const row = document.createElement('div');
  row.className = 'repeat-row review-row';
  row.innerHTML = `
    <div class="repeat-stack">
      <div class="repeat-inline">
        <input type="text" class="review-author" placeholder="Reviewer name" value="${esc(review.author)}">
        <select class="review-rating">
          ${[5, 4, 3, 2, 1].map(n =>
            `<option value="${n}" ${n === rating ? 'selected' : ''}>${'★'.repeat(n)} ${n}</option>`
          ).join('')}
        </select>
      </div>
      <textarea class="review-body" placeholder="Review text">${esc(review.body)}</textarea>
    </div>
    <button type="button" class="repeat-remove" title="Remove"><i class="fas fa-trash"></i></button>
  `;
  row.querySelector('.repeat-remove').addEventListener('click', () => {
    row.remove();
    refreshEmptyStates();
  });
  document.getElementById('reviewRows').appendChild(row);
  refreshEmptyStates();
}

function refreshEmptyStates() {
  const sections = [
    ['planRows', 'No plans — the product sells at its single price above.'],
    ['faqRows', 'No questions added.'],
    ['reviewRows', 'No reviews added.']
  ];
  for (const [id, message] of sections) {
    const box = document.getElementById(id);
    if (!box) continue;
    const existing = box.querySelector('.repeat-empty');
    const hasRows = box.querySelector('.repeat-row');
    if (hasRows && existing) existing.remove();
    if (!hasRows && !existing) {
      const p = document.createElement('p');
      p.className = 'repeat-empty';
      p.textContent = message;
      box.appendChild(p);
    }
  }
}

function clearRepeatRows() {
  ['planRows', 'faqRows', 'reviewRows'].forEach(id => {
    const box = document.getElementById(id);
    if (box) box.innerHTML = '';
  });
  refreshEmptyStates();
}

// ===== Banners =====
async function loadBanners() {
  const box = document.getElementById('bannerRows');
  box.innerHTML = '';
  try {
    const res = await fetch('/api/banners');
    if (res.ok) {
      const banners = await res.json();
      banners.forEach(addBannerRow);
    }
  } catch (e) {
    showToast('Failed to load banners', 'error');
  }
  refreshBannerEmpty();
}

function addBannerRow(banner = {}) {
  const row = document.createElement('div');
  row.className = 'repeat-row banner-row';
  row.innerHTML = `
    <div class="banner-thumb">
      <img class="banner-preview" src="${esc(banner.image)}"
           style="${banner.image ? '' : 'display:none;'}" alt="">
      <span class="banner-thumb-empty" style="${banner.image ? 'display:none;' : ''}">
        <i class="fas fa-image"></i>
      </span>
    </div>
    <div class="repeat-stack">
      <div class="image-upload-wrap">
        <input type="file" class="banner-file" accept="image/*">
        <div class="image-upload-label"><i class="fas fa-cloud-upload-alt"></i> Upload Image</div>
      </div>
      <input type="text" class="banner-image" placeholder="Or paste an image URL" value="${esc(banner.image)}">
      <input type="text" class="banner-link" placeholder="Link on click (optional)" value="${esc(banner.link)}">
      <input type="text" class="banner-alt" placeholder="Describe the image (for accessibility)" value="${esc(banner.altText)}">
    </div>
    <div class="banner-actions">
      <button type="button" class="repeat-remove banner-up" title="Move up"><i class="fas fa-arrow-up"></i></button>
      <button type="button" class="repeat-remove banner-down" title="Move down"><i class="fas fa-arrow-down"></i></button>
      <button type="button" class="repeat-remove" title="Remove"><i class="fas fa-trash"></i></button>
    </div>
  `;

  const urlInput = row.querySelector('.banner-image');
  const preview = row.querySelector('.banner-preview');
  const placeholder = row.querySelector('.banner-thumb-empty');

  function showPreview(url) {
    if (url) {
      preview.src = url;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
    } else {
      preview.removeAttribute('src');
      preview.style.display = 'none';
      placeholder.style.display = '';
    }
  }

  urlInput.addEventListener('input', () => showPreview(urlInput.value.trim()));

  row.querySelector('.banner-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        urlInput.value = data.url;
        showPreview(data.url);
        showToast('Image uploaded — save banners to apply', 'success');
      } else {
        showToast(data.error || 'Upload failed', 'error');
      }
    } catch (err) {
      showToast('Upload failed', 'error');
    }
  });

  row.querySelector('.banner-up').addEventListener('click', () => {
    const prev = row.previousElementSibling;
    if (prev?.classList.contains('banner-row')) prev.before(row);
  });
  row.querySelector('.banner-down').addEventListener('click', () => {
    const next = row.nextElementSibling;
    if (next?.classList.contains('banner-row')) next.after(row);
  });
  row.querySelector('.banner-actions .repeat-remove:last-child').addEventListener('click', () => {
    row.remove();
    refreshBannerEmpty();
  });

  document.getElementById('bannerRows').appendChild(row);
  refreshBannerEmpty();
}

function refreshBannerEmpty() {
  const box = document.getElementById('bannerRows');
  if (!box) return;
  const existing = box.querySelector('.repeat-empty');
  const hasRows = box.querySelector('.banner-row');
  if (hasRows && existing) existing.remove();
  if (!hasRows && !existing) {
    const p = document.createElement('p');
    p.className = 'repeat-empty';
    p.textContent = 'No banners — the homepage shows its default slides.';
    box.appendChild(p);
  }
}

async function saveBanners() {
  const banners = [...document.querySelectorAll('#bannerRows .banner-row')].map(row => ({
    image: row.querySelector('.banner-image').value.trim(),
    link: row.querySelector('.banner-link').value.trim(),
    altText: row.querySelector('.banner-alt').value.trim()
  }));

  const incomplete = banners.filter(b => !b.image).length;
  if (incomplete) {
    showToast(`${incomplete} banner${incomplete === 1 ? '' : 's'} have no image and will be skipped`, 'error');
  }

  try {
    const res = await fetch('/api/banners', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banners })
    });
    if (res.ok) {
      showToast('Banners saved!', 'success');
      loadBanners();
    } else if (res.status === 401) {
      showToast('Session expired — log in again', 'error');
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || 'Failed to save banners', 'error');
    }
  } catch (e) {
    showToast('Server error', 'error');
  }
}

function collectPlans() {
  return [...document.querySelectorAll('#planRows .plan-row')].map(row => ({
    validity: row.querySelector('.plan-validity').value.trim(),
    packageType: row.querySelector('.plan-package').value.trim(),
    sublabel: row.querySelector('.plan-sublabel').value.trim(),
    price: row.querySelector('.plan-price').value,
    originalPrice: row.querySelector('.plan-original').value || null
  })).filter(p => p.validity);
}

function collectFaqs() {
  return [...document.querySelectorAll('#faqRows .faq-row')].map(row => ({
    question: row.querySelector('.faq-question').value.trim(),
    answer: row.querySelector('.faq-answer').value.trim()
  })).filter(f => f.question);
}

function collectReviews() {
  return [...document.querySelectorAll('#reviewRows .review-row')].map(row => ({
    author: row.querySelector('.review-author').value.trim(),
    rating: parseInt(row.querySelector('.review-rating').value, 10),
    body: row.querySelector('.review-body').value.trim()
  })).filter(r => r.author);
}

// Flips a product's stock state straight from the table, so marking something
// sold out does not mean opening the edit form.
async function toggleStock(id) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

  const next = product.inStock === false;

  try {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...product, inStock: next })
    });

    if (res.ok) {
      product.inStock = next;
      renderProductsTable();
      showToast(`${product.name} is now ${next ? 'in stock' : 'stock out'}`, 'success');
    } else if (res.status === 401) {
      showToast('Session expired — log in again', 'error');
    } else {
      showToast('Could not update stock', 'error');
    }
  } catch (e) {
    showToast('Server error', 'error');
  }
}

// ===== Product Form =====
function initProductForm() {
  document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('editProductId').value;

    const productData = {
      name: document.getElementById('pName').value,
      category: document.getElementById('pCategory').value,
      price: parseFloat(document.getElementById('pPrice').value),
      originalPrice: document.getElementById('pOriginalPrice').value || null,
      image: document.getElementById('pImage').value,
      badge: document.getElementById('pBadge').value || null,
      description: document.getElementById('pDescription').value,
      featured: document.getElementById('pFeatured').checked,
      bestSeller: document.getElementById('pBestSeller').checked,
      showFirst: document.getElementById('pShowFirst').checked,
      inStock: document.getElementById('pInStock').checked
    };

    const plans = collectPlans();
    const invalidPlan = plans.find(p => !(Number(p.price) >= 0));
    if (invalidPlan) {
      showToast(`Plan "${invalidPlan.validity}" needs a price`, 'error');
      return;
    }

    try {
      let res;
      if (editId) {
        res = await fetch(`/api/products/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData)
        });
      } else {
        res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData)
        });
      }

      if (!res.ok) {
        showToast(res.status === 401 ? 'Session expired — log in again' : 'Failed to save product', 'error');
        return;
      }

      // Plans, FAQs and reviews attach to the product, so they are saved after
      // it exists — a new product has no id until now.
      const saved = await res.json();
      const productId = editId || saved.id;
      const failed = await saveRelated(productId, plans, collectFaqs(), collectReviews());

      if (failed.length) {
        showToast(`Product saved, but ${failed.join(' and ')} failed`, 'error');
      } else {
        showToast(editId ? 'Product updated!' : 'Product added!', 'success');
      }

      resetProductForm();
      navigateTo('products');
    } catch (e) {
      showToast('Server error', 'error');
    }
  });
}

// Saves the three related lists. Returns the names of any that failed so the
// product save is not reported as fully successful when part of it did not land.
async function saveRelated(productId, plans, faqs, reviews) {
  const calls = [
    ['plans', `/api/products/${productId}/plans`, { plans }],
    ['FAQs', `/api/products/${productId}/faqs`, { faqs }],
    ['reviews', `/api/products/${productId}/reviews`, { reviews }]
  ];

  const failed = [];
  for (const [name, url, body] of calls) {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) failed.push(name);
    } catch (e) {
      failed.push(name);
    }
  }
  return failed;
}

async function editProduct(id) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

  document.getElementById('editProductId').value = product.id;
  document.getElementById('pName').value = product.name;
  document.getElementById('pCategory').value = product.category;
  document.getElementById('pPrice').value = product.price;
  document.getElementById('pOriginalPrice').value = product.originalPrice || '';
  document.getElementById('pImage').value = product.image || '';
  document.getElementById('pBadge').value = product.badge || '';
  document.getElementById('pDescription').value = product.description || '';
  document.getElementById('pFeatured').checked = product.featured;
  document.getElementById('pBestSeller').checked = product.bestSeller;
  document.getElementById('pShowFirst').checked = product.showFirst === true;
  document.getElementById('pInStock').checked = product.inStock !== false;

  document.getElementById('productFormTitle').textContent = 'Edit Product';
  document.getElementById('productFormBtn').innerHTML = '<i class="fas fa-save"></i> Update Product';

  // Show image preview
  if (product.image) {
    const preview = document.getElementById('pImagePreview');
    preview.src = product.image;
    preview.style.display = 'block';
  }

  navigateTo('add-product', { resetForm: false });
  document.getElementById('pageTitle').textContent = 'Edit Product';

  // The list endpoint omits plans/FAQs/reviews, so fetch the full record.
  clearRepeatRows();
  try {
    const res = await fetch(`/api/products/${id}`);
    if (res.ok) {
      const full = await res.json();
      (full.plans || []).forEach(addPlanRow);
      (full.faqs || []).forEach(addFaqRow);
      (full.reviews || []).forEach(addReviewRow);
      refreshEmptyStates();
    }
  } catch (e) {
    showToast('Could not load plans and FAQs', 'error');
  }
}

function resetProductForm() {
  document.getElementById('productForm').reset();
  // form.reset() restores the `checked` attribute, so In stock stays ticked for
  // a new product — but set it explicitly rather than relying on that.
  document.getElementById('pInStock').checked = true;
  document.getElementById('editProductId').value = '';
  document.getElementById('productFormTitle').textContent = 'Add New Product';
  document.getElementById('productFormBtn').innerHTML = '<i class="fas fa-save"></i> Save Product';
  document.getElementById('pImagePreview').style.display = 'none';
  clearRepeatRows();
}

// ===== Image Upload =====
async function previewImage(input) {
  if (!input.files || !input.files[0]) return;

  const file = input.files[0];
  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.url) {
      document.getElementById('pImage').value = data.url;
      const preview = document.getElementById('pImagePreview');
      preview.src = data.url;
      preview.style.display = 'block';
      showToast('Image uploaded!', 'success');
    }
  } catch (e) {
    showToast('Upload failed', 'error');
  }
}

async function previewLogo(input) {
  if (!input.files || !input.files[0]) return;

  const file = input.files[0];
  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.url) {
      document.getElementById('sLogoUrl').value = data.url;
      showLogoPreview(data.url);
      showToast('Logo uploaded — save settings to apply it', 'success');
    } else {
      showToast(data.error || 'Upload failed', 'error');
    }
  } catch (e) {
    showToast('Upload failed', 'error');
  }
}

function showLogoPreview(url) {
  const preview = document.getElementById('sLogoPreview');
  const clearBtn = document.getElementById('sLogoClear');
  if (url) {
    preview.src = url;
    preview.style.display = 'block';
    if (clearBtn) clearBtn.style.display = 'inline-flex';
  } else {
    preview.removeAttribute('src');
    preview.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
  }
}

// Clears the logo so the storefront falls back to the default icon.
function clearLogo() {
  document.getElementById('sLogoUrl').value = '';
  document.getElementById('sLogoFile').value = '';
  showLogoPreview('');
  showToast('Logo cleared — save settings to apply', 'success');
}

// ===== Delete Product =====
let deleteTargetId = null;

function deleteProduct(id) {
  deleteTargetId = id;
  document.getElementById('deleteModal').classList.add('active');
  document.getElementById('confirmDeleteBtn').onclick = confirmDelete;
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('active');
  deleteTargetId = null;
}

async function confirmDelete() {
  if (!deleteTargetId) return;

  try {
    const res = await fetch(`/api/products/${deleteTargetId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Product deleted', 'success');
      closeDeleteModal();
      loadProducts();
    } else if (res.status === 401) {
      showToast('Session expired — please log in again', 'error');
      closeDeleteModal();
    } else {
      showToast('Delete failed', 'error');
    }
  } catch (e) {
    showToast('Delete failed', 'error');
  }
}

// ===== Settings =====
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const settings = await res.json();

    document.getElementById('sSiteName').value = settings.siteName || '';
    document.getElementById('sSiteDesc').value = settings.siteDescription || '';
    document.getElementById('sWhatsapp').value = settings.whatsapp || '';
    document.getElementById('sFacebook').value = settings.facebook || '';
    document.getElementById('sInstagram').value = settings.instagram || '';
    document.getElementById('sYoutube').value = settings.youtube || '';
    document.getElementById('sBkash').value = settings.bkashNumber || '';
    document.getElementById('sNagad').value = settings.nagadNumber || '';
    document.getElementById('sRocket').value = settings.rocketNumber || '';

    document.getElementById('sLogoUrl').value = settings.logoUrl || '';
    showLogoPreview(settings.logoUrl || '');
  } catch (e) {
    showToast('Failed to load settings', 'error');
  }
}

function initSettingsForm() {
  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const settings = {
      siteName: document.getElementById('sSiteName').value,
      siteDescription: document.getElementById('sSiteDesc').value,
      logoUrl: document.getElementById('sLogoUrl').value,
      whatsapp: document.getElementById('sWhatsapp').value,
      facebook: document.getElementById('sFacebook').value,
      instagram: document.getElementById('sInstagram').value,
      youtube: document.getElementById('sYoutube').value,
      bkashNumber: document.getElementById('sBkash').value,
      nagadNumber: document.getElementById('sNagad').value,
      rocketNumber: document.getElementById('sRocket').value
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        showToast('Settings saved!', 'success');
      } else if (res.status === 401) {
        showToast('Session expired — log in again', 'error');
      } else {
        showToast('Failed to save settings', 'error');
      }
    } catch (e) {
      showToast('Failed to save', 'error');
    }
  });
}

// ===== Change Password =====
function initPasswordForm() {
  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const current = document.getElementById('currentPass').value;
    const newPass = document.getElementById('newPass').value;

    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: newPass })
      });

      if (res.ok) {
        showToast('Password changed!', 'success');
        document.getElementById('passwordForm').reset();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed', 'error');
      }
    } catch (e) {
      showToast('Server error', 'error');
    }
  });
}

// ===== Helpers =====
function visitSite() {
  window.open('/', '_blank');
}

function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${esc(msg)}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== Orders =====
async function loadOrders() {
  try {
    const res = await fetch('/api/orders');
    const orders = await res.json();
    document.getElementById('orderCount').textContent = `${orders.length} orders`;

    const tbody = document.getElementById('ordersTableBody');
    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:#999;">No orders yet</td></tr>';
      return;
    }

    // Keep the raw orders around so row actions can look up values by id
    // instead of smuggling customer-controlled text through onclick attributes.
    allOrders = orders;

    tbody.innerHTML = orders.map(o => {
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      const itemNames = items ? items.map(i => `${i.name} x${i.qty}`).join(', ') : '';
      const date = new Date(o.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
      const statusColors = { pending: '#f39c12', confirmed: '#27ae60', delivered: '#3498db', cancelled: '#1560f0' };
      const statusColor = statusColors[o.status] || '#999';

      return `
        <tr>
          <td><strong>#${o.id}</strong></td>
          <td>
            <strong>${esc(o.customer_name)}</strong><br>
            <small style="color:#999;">${esc(o.customer_phone)}</small>
          </td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(itemNames)}">${esc(itemNames)}</td>
          <td><strong>৳${parseFloat(o.total || 0).toLocaleString()}</strong></td>
          <td>${esc((o.payment_method || '').toUpperCase())}</td>
          <td>
            <code>${esc(o.transaction_id)}</code>
            ${o.sender_number ? `<br><small style="color:#999;">from ${esc(o.sender_number)}</small>` : ''}
          </td>
          <td>
            <select onchange="updateOrderStatus(${o.id}, this.value)" style="padding:4px 8px;border-radius:6px;border:2px solid ${statusColor};color:${statusColor};font-weight:600;font-size:0.8rem;background:#fff;cursor:pointer;">
              <option value="pending" ${o.status==='pending'?'selected':''}>⏳ Pending</option>
              <option value="confirmed" ${o.status==='confirmed'?'selected':''}>✅ Confirmed</option>
              <option value="delivered" ${o.status==='delivered'?'selected':''}>📦 Delivered</option>
              <option value="cancelled" ${o.status==='cancelled'?'selected':''}>❌ Cancelled</option>
            </select>
          </td>
          <td style="font-size:0.8rem;">${date}</td>
          <td>
            <button onclick="viewOrderWhatsApp(${o.id})" class="btn-icon" title="WhatsApp">
              <i class="fab fa-whatsapp" style="color:#25D366;"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    showToast('Failed to load orders', 'error');
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    showToast(`Order #${orderId} → ${status}`, 'success');
  } catch (e) {
    showToast('Failed to update', 'error');
  }
}

function viewOrderWhatsApp(id) {
  const order = allOrders.find(o => o.id === id);
  if (!order) return;

  const phone = String(order.customer_phone || '').replace(/[^0-9]/g, '');
  if (!phone) {
    showToast('This order has no phone number', 'error');
    return;
  }

  const total = parseFloat(order.total || 0).toLocaleString();
  const msg = encodeURIComponent(
    `Hi ${order.customer_name || ''}, your Order #${id} (৳${total}) has been confirmed! Thank you for choosing PixelSub.`
  );
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
}
