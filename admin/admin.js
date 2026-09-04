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

function navigateTo(page) {
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
    'settings': 'Settings'
  };
  document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';

  // Load page data
  if (page === 'dashboard') loadDashboard();
  if (page === 'products') loadProducts();
  if (page === 'orders') loadOrders();
  if (page === 'settings') loadSettings();
  if (page === 'add-product') resetProductForm();

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
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#999;">No products found</td></tr>';
    return;
  }

  tbody.innerHTML = allProducts.map(p => {
    const badgeHTML = p.badge
      ? `<span class="table-badge ${p.badge}">${p.badge}</span>`
      : '<span style="color:#ccc;">—</span>';

    return `
      <tr>
        <td><img src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.src='https://via.placeholder.com/44'"></td>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${esc(p.category)}</td>
        <td><strong style="color:#e74c3c;">৳${p.price.toLocaleString()}</strong>${p.originalPrice ? `<br><s style="color:#999;font-size:0.75rem;">৳${p.originalPrice.toLocaleString()}</s>` : ''}</td>
        <td>${badgeHTML}</td>
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
      bestSeller: document.getElementById('pBestSeller').checked
    };

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

      if (res.ok) {
        showToast(editId ? 'Product updated!' : 'Product added!', 'success');
        resetProductForm();
        navigateTo('products');
      } else {
        showToast('Failed to save product', 'error');
      }
    } catch (e) {
      showToast('Server error', 'error');
    }
  });
}

function editProduct(id) {
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

  document.getElementById('productFormTitle').textContent = 'Edit Product';
  document.getElementById('productFormBtn').innerHTML = '<i class="fas fa-save"></i> Update Product';

  // Show image preview
  if (product.image) {
    const preview = document.getElementById('pImagePreview');
    preview.src = product.image;
    preview.style.display = 'block';
  }

  navigateTo('add-product');
  document.getElementById('pageTitle').textContent = 'Edit Product';
}

function resetProductForm() {
  document.getElementById('productForm').reset();
  document.getElementById('editProductId').value = '';
  document.getElementById('productFormTitle').textContent = 'Add New Product';
  document.getElementById('productFormBtn').innerHTML = '<i class="fas fa-save"></i> Save Product';
  document.getElementById('pImagePreview').style.display = 'none';
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
      const preview = document.getElementById('sLogoPreview');
      preview.src = data.url;
      preview.style.display = 'block';
      showToast('Logo uploaded!', 'success');
    }
  } catch (e) {
    showToast('Upload failed', 'error');
  }
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

    if (settings.logoUrl) {
      document.getElementById('sLogoUrl').value = settings.logoUrl;
      const preview = document.getElementById('sLogoPreview');
      preview.src = settings.logoUrl;
      preview.style.display = 'block';
    }
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
      const statusColors = { pending: '#f39c12', confirmed: '#27ae60', delivered: '#3498db', cancelled: '#e74c3c' };
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
          <td><code>${esc(o.transaction_id)}</code></td>
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
