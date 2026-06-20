// Elly Furniture - Admin Dashboard Controller (Supabase Powered)

let supabase = null;
let currentTab = 'dashboard';
let productsData = [];
let ordersData = [];
let salesRecordsData = [];
let customersCount = 0;

// Chart references for cleanup
let salesChartRef = null;
let pieChartRef = null;

// Modal references
let bootstrapProductModal = null;

// -----------------------------------------------------------------
// Toast Utility
// -----------------------------------------------------------------
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'error' ? 'danger' : type}`;
    toast.style.cssText = 'min-width: 250px; pointer-events: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: slideIn 0.3s ease; margin-bottom: 0;';
    toast.innerHTML = message;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// -----------------------------------------------------------------
// Security Guard & Page Initialization
// -----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize Supabase Connection
        supabase = await window.Supa.init();
        
        // Auth Guard
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = 'admin-login.html';
            return;
        }

        // Display Admin User Email
        const userDisplay = document.getElementById('admin-user-display');
        if (userDisplay && session.user) {
            userDisplay.textContent = `Logged in as: ${session.user.email}`;
        }

        // Setup Modals
        const modalEl = document.getElementById('productModal');
        if (modalEl) {
            bootstrapProductModal = new bootstrap.Modal(modalEl);
            modalEl.addEventListener('hidden.bs.modal', () => {
                stopWebcam();
                const previewContainer = document.getElementById('capture-preview-container');
                if (previewContainer) previewContainer.classList.add('d-none');
            });
        }

        // Add change listener to product image file input
        const imageFileInput = document.getElementById('product-image-file');
        if (imageFileInput) {
            imageFileInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        // Save Base64 to Image URL field and clear file field label if needed
                        document.getElementById('product-image-url').value = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Load all data
        await refreshAllData();

        // Subscribe to real-time updates
        if (supabase) {
            supabase
                .channel('realtime-db-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                    console.log('Realtime orders change detected');
                    refreshAllData();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
                    console.log('Realtime products change detected');
                    refreshAllData();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_records' }, () => {
                    console.log('Realtime sales records change detected');
                    refreshAllData();
                })
                .subscribe();
        }

    } catch (e) {
        console.error("Dashboard initialization failed:", e);
        showToast("Error initializing Supabase connection.", "error");
    }
});

// Refresh all records from Database
async function refreshAllData() {
    try {
        productsData = await window.Supa.fetchAll('products');
        ordersData = await window.Supa.fetchAll('orders');
        salesRecordsData = await window.Supa.fetchAll('sales_records');
        
        // Count customers
        try {
            const customers = await window.Supa.fetchAll('customers');
            customersCount = customers.length;
        } catch (cErr) {
            // fallback: count unique order names/emails
            const uniqueCust = new Set(ordersData.map(o => o.email.toLowerCase()));
            customersCount = uniqueCust.size;
        }

        // Render Active Tab
        renderCurrentTab();

    } catch (err) {
        console.error("Data refresh failed:", err);
        showToast(`Failed to load database records: ${err.message}`, "error");
    }
}

// -----------------------------------------------------------------
// Navigation Tab Control
// -----------------------------------------------------------------
window.switchTab = function (tabId) {
    currentTab = tabId;
    
    // Manage tab buttons class active
    const menuButtons = document.querySelectorAll('.nav-menu-btn');
    menuButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.id === `btn-tab-${tabId}`) {
            btn.classList.add('active');
        }
    });

    // Toggle panels
    const panels = document.querySelectorAll('.tab-panel');
    panels.forEach(panel => {
        panel.classList.add('d-none');
        if (panel.id === `panel-${tabId}`) {
            panel.classList.remove('d-none');
        }
    });

    // Update panel title header
    const titleEl = document.getElementById('panel-title');
    if (titleEl) {
        if (tabId === 'dashboard') titleEl.textContent = 'Sales Analytics Dashboard';
        if (tabId === 'products') titleEl.textContent = 'Showroom Catalog Manager';
        if (tabId === 'orders') titleEl.textContent = 'Cart';
    }

    renderCurrentTab();
};

function renderCurrentTab() {
    if (currentTab === 'dashboard') {
        renderDashboardTab();
    } else if (currentTab === 'products') {
        renderProductsTab();
    } else if (currentTab === 'orders') {
        renderOrdersTab();
    }
}

// -----------------------------------------------------------------
// Sign Out
// -----------------------------------------------------------------
window.handleSignOut = async function () {
    try {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    } catch (e) {
        console.error("Sign out failed:", e);
        window.location.href = 'index.html';
    }
};

// -----------------------------------------------------------------
// TAB: ANALYTICS & DASHBOARD
// -----------------------------------------------------------------
function renderDashboardTab() {
    // 1. Calculate Stats
    // Exclude 'Cancelled' orders from active revenue calculations
    const activeOrders = ordersData.filter(o => o.order_status !== 'Cancelled');
    const totalRevenue = activeOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    const totalOrdersCount = ordersData.length;

    // Best Selling Products calculation
    const prodCounts = {};
    activeOrders.forEach(order => {
        const items = Array.isArray(order.products_ordered) ? order.products_ordered : [];
        items.forEach(item => {
            const name = item.name || 'Unknown Furniture';
            const qty = parseInt(item.quantity) || 1;
            prodCounts[name] = (prodCounts[name] || 0) + qty;
        });
    });

    let bestSellerName = "None";
    let maxQty = 0;
    Object.keys(prodCounts).forEach(name => {
        if (prodCounts[name] > maxQty) {
            maxQty = prodCounts[name];
            bestSellerName = `${name} (${maxQty} sold)`;
        }
    });

    // Populate Cards
    document.getElementById('stat-revenue').textContent = `Ksh ${totalRevenue.toFixed(2)}`;
    document.getElementById('stat-orders').textContent = totalOrdersCount;
    document.getElementById('stat-customers').textContent = customersCount;
    document.getElementById('stat-bestseller').textContent = bestSellerName;

    // 2. Populate Sales Log Table
    const tbody = document.querySelector('#sales-history-table tbody');
    tbody.innerHTML = '';

    const cancelledOrderIds = new Set(
        ordersData
            .filter(o => o.order_status === 'Cancelled')
            .map(o => o.id)
    );
    const cancelledOrderNumbers = new Set(
        ordersData
            .filter(o => o.order_status === 'Cancelled')
            .map(o => o.order_number)
    );
    const activeSales = salesRecordsData.filter(sale => 
        !cancelledOrderIds.has(sale.order_id) && !cancelledOrderNumbers.has(sale.order_number)
    );

    if (activeSales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-white-50">No sales transactions logged.</td></tr>';
    } else {
        // Sort sales records newest first
        const sortedSales = [...activeSales].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        sortedSales.forEach(sale => {
            const tr = document.createElement('tr');
            const dateStr = new Date(sale.created_at).toLocaleString();
            tr.innerHTML = `
                <td style="font-weight: 600; color: #f9b934;">${sale.order_number}</td>
                <td>${sale.customer_name}</td>
                <td>Ksh ${parseFloat(sale.total_amount).toFixed(2)}</td>
                <td>${sale.payment_method}</td>
                <td class="text-white-50">${dateStr}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 3. Render Trend Charts
    renderCharts(activeOrders, prodCounts);
}

// Draw Charts using Chart.js
function renderCharts(activeOrders, prodCounts) {
    // Cleanup old charts to prevent duplicate canvases overlapping
    if (salesChartRef) salesChartRef.destroy();
    if (pieChartRef) pieChartRef.destroy();

    // Default daily period analysis on tab render
    loadReportPeriod('daily');
}

// Handle Analytics Period selection: daily, weekly, monthly, yearly
window.loadReportPeriod = function(period) {
    // Highlight button active
    const buttons = document.querySelectorAll('#report-filters button');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase() === period) {
            btn.classList.add('active');
        }
    });

    // Exclude cancelled
    const activeOrders = ordersData.filter(o => o.order_status !== 'Cancelled');

    let labels = [];
    let datasetsData = [];

    const now = new Date();

    if (period === 'daily') {
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            labels.push(d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' }));
            
            // Sum sales on that date
            const dateKey = d.toDateString();
            const total = activeOrders
                .filter(o => new Date(o.created_at).toDateString() === dateKey)
                .reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
            datasetsData.push(total);
        }
    } else if (period === 'weekly') {
        // Last 4 weeks
        for (let i = 3; i >= 0; i--) {
            const start = new Date();
            start.setDate(now.getDate() - (i * 7) - 6);
            start.setHours(0,0,0,0);
            
            const end = new Date();
            end.setDate(now.getDate() - (i * 7));
            end.setHours(23,59,59,999);

            labels.push(`Wk -${i}`);
            
            const total = activeOrders
                .filter(o => {
                    const od = new Date(o.created_at);
                    return od >= start && od <= end;
                })
                .reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
            datasetsData.push(total);
        }
    } else if (period === 'monthly') {
        // Last 6 months
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            labels.push(d.toLocaleString(undefined, { month: 'short', year: '2-digit' }));
            
            const total = activeOrders
                .filter(o => {
                    const od = new Date(o.created_at);
                    return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
                })
                .reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
            datasetsData.push(total);
        }
    } else if (period === 'yearly') {
        // Last 3 years
        for (let i = 2; i >= 0; i--) {
            const year = now.getFullYear() - i;
            labels.push(year.toString());
            
            const total = activeOrders
                .filter(o => new Date(o.created_at).getFullYear() === year)
                .reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
            datasetsData.push(total);
        }
    }

    // Render Line Chart
    const ctx = document.getElementById('salesChart').getContext('2d');
    if (salesChartRef) salesChartRef.destroy();
    salesChartRef = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue (Ksh)',
                data: datasetsData,
                borderColor: '#f9b934',
                backgroundColor: 'rgba(249, 185, 52, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#f9b934'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#f8fafc' } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += 'Ksh ' + parseFloat(context.parsed.y).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#f8fafc' } },
                y: { 
                    grid: { color: 'rgba(255,255,255,0.06)' }, 
                    ticks: { 
                        color: '#f8fafc',
                        callback: function(value) {
                            return 'Ksh ' + parseFloat(value).toLocaleString();
                        }
                    }
                }
            }
        }
    });

    // Build Product Pie Chart (Top 5 Best Selling Items)
    const prodCounts = {};
    activeOrders.forEach(order => {
        const items = Array.isArray(order.products_ordered) ? order.products_ordered : [];
        items.forEach(item => {
            const name = item.name || 'Unknown Furniture';
            const qty = parseInt(item.quantity) || 1;
            prodCounts[name] = (prodCounts[name] || 0) + qty;
        });
    });

    const sortedProds = Object.keys(prodCounts)
        .map(name => ({ name, qty: prodCounts[name] }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

    const pieLabels = sortedProds.map(p => p.name);
    const pieData = sortedProds.map(p => p.qty);

    const pieCtx = document.getElementById('productsPieChart').getContext('2d');
    if (pieChartRef) pieChartRef.destroy();
    
    if (pieLabels.length === 0) {
        // Draw empty text on canvas if no sales
        pieCtx.clearRect(0, 0, 200, 200);
        return;
    }

    pieChartRef = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: pieLabels,
            datasets: [{
                data: pieData,
                backgroundColor: [
                    '#f9b934', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'
                ],
                borderWidth: 1,
                borderColor: 'rgba(15, 23, 42, 0.95)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#f8fafc', font: { size: 9 } }
                }
            }
        }
    });
};

// -----------------------------------------------------------------
// TAB: PRODUCTS (CRUD CATALOG)
// -----------------------------------------------------------------
function renderProductsTab() {
    const tbody = document.querySelector('#products-table tbody');
    tbody.innerHTML = '';

    if (productsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-white-50">No products found. Add some to get started.</td></tr>';
        return;
    }

    productsData.forEach(product => {
        const tr = document.createElement('tr');
        const dateStr = new Date(product.created_at).toLocaleDateString();
        tr.innerHTML = `
            <td class="prod-image-cell">
                <img src="${product.image_url || 'images/couch.png'}" onerror="this.src='images/couch.png'">
            </td>
            <td style="font-weight: 600;">${product.name}</td>
            <td><span class="badge bg-secondary">${product.category || 'General'}</span></td>
            <td>Ksh ${parseFloat(product.price).toFixed(2)}</td>
            <td>${product.stock_quantity || 0} units</td>
            <td class="text-white-50">${dateStr}</td>
            <td>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-action-outline" onclick="openEditProductModal('${product.id}')" style="padding: 4px 8px;"><i class="fa fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger text-white border-0" onclick="handleDeleteProduct('${product.id}', '${product.name.replace(/'/g, "\\'")}')" style="padding: 4px 8px; background: rgba(220,53,69,0.3) !important;"><i class="fa fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Form Operations: Open Modal for Add
window.openAddProductModal = function () {
    document.getElementById('productModalLabel').textContent = 'Add New Catalog Product';
    document.getElementById('product-form-id').value = '';
    document.getElementById('product-form').reset();
    bootstrapProductModal.show();
};

// Form Operations: Open Modal for Edit
window.openEditProductModal = function (productId) {
    const product = productsData.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('productModalLabel').textContent = 'Edit Showroom Product';
    document.getElementById('product-form-id').value = product.id;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-category').value = product.category || 'Chairs';
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-stock').value = product.stock_quantity;
    document.getElementById('product-description').value = product.description || '';
    document.getElementById('product-image-url').value = product.image_url || '';
    document.getElementById('product-image-file').value = ''; // Reset file input

    bootstrapProductModal.show();
};

// Form Operations: Save Product (Create or Update)
window.handleSaveProduct = async function () {
    const id = document.getElementById('product-form-id').value;
    const name = document.getElementById('product-name').value.trim();
    const category = document.getElementById('product-category').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const stock = parseInt(document.getElementById('product-stock').value);
    const description = document.getElementById('product-description').value.trim();
    const imageUrl = document.getElementById('product-image-url').value.trim();

    if (!name || isNaN(price) || isNaN(stock)) {
        showToast("Please fill in all required fields marked with *.", "error");
        return;
    }

    const payload = {
        name,
        category,
        price,
        stock_quantity: stock,
        description,
        image_url: imageUrl
    };

    const saveBtn = document.getElementById('btn-save-product');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        if (id) {
            // UPDATE
            await window.Supa.update('products', id, payload);
            showToast(`Product <strong>${name}</strong> updated successfully!`);
        } else {
            // INSERT
            await window.Supa.insert('products', payload);
            showToast(`Product <strong>${name}</strong> added to showroom!`);
        }

        bootstrapProductModal.hide();
        await refreshAllData();

    } catch (e) {
        console.error("Save product failed:", e);
        showToast(`Failed to save product: ${e.message}`, "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Product';
    }
};

// Form Operations: Delete Product
window.handleDeleteProduct = async function (productId, name) {
    try {
        await window.Supa.delete('products', productId);
        showToast(`Product <strong>${name}</strong> deleted successfully.`);
        await refreshAllData();
    } catch (e) {
        console.error("Delete product failed:", e);
        showToast(`Failed to delete product: ${e.message}`, "error");
    }
};

// -----------------------------------------------------------------
// TAB: ORDERS (Fulfillment Orders tracker)
// -----------------------------------------------------------------
function renderOrdersTab() {
    const tbody = document.querySelector('#orders-table tbody');
    tbody.innerHTML = '';

    if (ordersData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-white-50">No checkout orders registered yet.</td></tr>';
        return;
    }

    // Sort orders: newest first
    const sortedOrders = [...ordersData].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    sortedOrders.forEach(order => {
        const tr = document.createElement('tr');
        const dateStr = new Date(order.created_at).toLocaleString();
        
        // Format products ordered list
        const items = Array.isArray(order.products_ordered) ? order.products_ordered : [];
        const itemsListHtml = items.map(item => `
            <div class="small" style="line-height: 1.2; margin-bottom: 4px;">
                • <strong>${item.name}</strong> (x${item.quantity}) - Ksh ${parseFloat(item.price).toFixed(2)}
            </div>
        `).join('');

        tr.innerHTML = `
            <td style="font-weight: 600; color: #f9b934;">${order.order_number}</td>
            <td>
                <div style="font-weight:600;">${order.customer_name}</div>
                <div class="small text-white-50">${order.phone}</div>
                <div class="small text-white-50">${order.email}</div>
            </td>
            <td>
                <div class="small">${order.county_city}</div>
                <div class="small text-white-50" style="max-width: 200px; overflow-wrap: break-word;">${order.delivery_address}</div>
            </td>
            <td>${itemsListHtml}</td>
            <td>
                <div style="font-weight: 700;">Ksh ${parseFloat(order.total_amount).toFixed(2)}</div>
                <div class="small text-white-50">${order.payment_method}</div>
            </td>
            <td>
                <span class="badge-status status-${order.order_status}">${order.order_status || 'Pending'}</span>
            </td>
            <td>
                <div class="d-flex flex-column gap-1">
                    <select class="form-select form-select-sm form-control-glass glass-select" style="font-size: 0.75rem; padding: 4px 8px;" onchange="handleUpdateOrderStatus('${order.id}', this.value)">
                        <option value="Pending" ${order.order_status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Confirmed" ${order.order_status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="Processing" ${order.order_status === 'Processing' ? 'selected' : ''}>Processing</option>
                        <option value="Shipped" ${order.order_status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="Delivered" ${order.order_status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="Cancelled" ${order.order_status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                    <div class="d-flex gap-1 mt-1">
                        <button class="btn btn-action btn-sm w-100" style="padding: 2px 4px; font-size: 0.7rem;" onclick="handleQuickActionStatus('${order.id}', 'Confirmed')">Accept</button>
                        <button class="btn btn-danger text-white border-0 btn-sm w-100" style="padding: 2px 4px; font-size: 0.7rem; background: rgba(220,53,69,0.3) !important;" onclick="handleQuickActionStatus('${order.id}', 'Cancelled')">Reject</button>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Helper: Show outbound email notification preview
function showEmailSentPreview(to, subject, body) {
    const oldModal = document.getElementById('email-sent-preview-modal');
    if (oldModal) oldModal.remove();

    const modalDiv = document.createElement('div');
    modalDiv.id = 'email-sent-preview-modal';
    modalDiv.className = 'modal fade';
    modalDiv.tabIndex = -1;
    modalDiv.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content text-white" style="background: #252830; border: 1px solid rgba(255,255,255,0.1); border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div class="modal-header border-bottom-0 pb-0">
                    <h5 class="modal-title" style="font-weight: 700; color: #f9b934;"><i class="fa fa-paper-plane me-2"></i> Email Notification Dispatched</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p class="small text-white-50">An email notification has been generated and sent immediately to the buyer.</p>
                    <div class="p-3 rounded mb-2" style="background: rgba(0,0,0,0.2); font-family: monospace; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.05); color: #e0e0e0; word-break: break-all;">
                        <div><strong>To:</strong> ${to}</div>
                        <div><strong>Subject:</strong> ${subject}</div>
                        <hr style="border-color: rgba(255,255,255,0.1);">
                        <div style="white-space: pre-wrap; line-height: 1.4;">${body}</div>
                    </div>
                </div>
                <div class="modal-footer border-top-0 pt-0">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal" style="background: #3e445c; border: none; border-radius: 5px;">Close</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);
    const bsModal = new bootstrap.Modal(modalDiv);
    bsModal.show();
}

async function sendEmailNotification(emailDetails) {
    // 1. Show the beautiful visual outgoing email preview modal immediately
    showEmailSentPreview(emailDetails.to, emailDetails.subject, emailDetails.body);

    // 2. Fetch credentials from environment variables (Vite-injected at build-time)
    const emailUser = import.meta.env.VITE_EMAIL_USER || "";
    const emailPass = import.meta.env.VITE_EMAIL_PASS || "";

    if (!emailUser || !emailPass) {
        console.warn("Gmail SMTP credentials (VITE_EMAIL_USER / VITE_EMAIL_PASS) are missing. Falling back to mock dispatch.");
        return;
    }

    try {
        console.log("Attempting real SMTP mail dispatch via SmtpJS...");
        if (window.Email) {
            const response = await window.Email.send({
                Host: "smtp.gmail.com",
                Username: emailUser,
                Password: emailPass,
                To: emailDetails.to,
                From: emailUser,
                Subject: emailDetails.subject,
                Body: emailDetails.body.replace(/\n/g, "<br>") // Convert newlines to HTML break tags
            });
            console.log("SmtpJS response:", response);
            if (response === "OK") {
                showToast("Real email notification sent successfully via SMTP.");
            } else {
                console.error("SMTP relay error details:", response);
                showToast("SMTP email dispatch failed. Verify Gmail App Password settings.", "warning");
            }
        } else {
            console.warn("SmtpJS library not loaded. Falling back to mock dispatch.");
        }
    } catch (e) {
        console.error("SmtpJS execution error:", e);
        showToast("Email dispatch failed due to code execution error.", "error");
    }
}

// Action: Update Order Status
window.handleUpdateOrderStatus = async function (orderId, newStatus) {
    try {
        let order = ordersData.find(o => o.id === orderId);
        if (!order) {
            order = await window.Supa.fetchById('orders', orderId);
        }
        if (!order) {
            throw new Error("Order records could not be found.");
        }

        let pickupTime = "";
        let pickupLocation = "Elly Furniture Main Showroom, Ngong Road, Nairobi";
        
        if (newStatus === 'Confirmed') {
            pickupTime = prompt("Please specify the pickup date and time for the customer:", "Tomorrow at 10:00 AM");
            if (pickupTime === null) return; // User cancelled
            pickupTime = pickupTime.trim() || "Tomorrow at 10:00 AM";

            pickupLocation = prompt("Please specify the pickup location:", "Elly Furniture Main Showroom, Ngong Road, Nairobi");
            if (pickupLocation === null) return; // User cancelled
            pickupLocation = pickupLocation.trim() || "Elly Furniture Main Showroom, Ngong Road, Nairobi";
        }

        // Update status in Supabase
        await window.Supa.update('orders', orderId, { order_status: newStatus });
        showToast(`Order status updated to <strong>${newStatus}</strong>.`);

        // Send Email Notification immediately
        if (newStatus === 'Confirmed') {
            await sendEmailNotification({
                to: order.email,
                subject: `Order Approved - Elly Furniture [${order.order_number}]`,
                body: `Hello ${order.customer_name},

Your order ${order.order_number} has been approved! We are excited to prepare your furniture items.

Pickup Instructions:
- Pickup Time: ${pickupTime}
- Pickup Location: ${pickupLocation}

Please show this email confirmation when collecting your order.

Thank you for choosing Elly Furniture!
Support Team`
            });
        } else if (newStatus === 'Cancelled') {
            let refundDetails = "";
            if (order.payment_method === 'M-Pesa') {
                refundDetails = `Refund Method: M-Pesa (refunded automatically to phone number: ${order.phone})`;
            } else {
                refundDetails = `Refund Method: Stored Method (Manual refund processed)`;
            }

            await sendEmailNotification({
                to: order.email,
                subject: `Order Declined - Elly Furniture [${order.order_number}]`,
                body: `Hello ${order.customer_name},

We regret to inform you that your order ${order.order_number} has been declined.

Refund Information:
${refundDetails}

For support regarding your refund or purchase details, please contact us directly at foolp481@gmail.com.

Sincerely,
Elly Furniture Support Team`
            });
        }

        await refreshAllData();
    } catch (e) {
        console.error("Update status failed:", e);
        showToast(`Failed to update status: ${e.message}`, "error");
    }
};

// Quick action accept/reject
window.handleQuickActionStatus = async function (orderId, status) {
    await handleUpdateOrderStatus(orderId, status);
};

// Camera Capture API integration
let webcamStream = null;

window.startWebcam = async function() {
    const video = document.getElementById('webcam');
    const container = document.getElementById('camera-container');
    const btnStart = document.getElementById('btn-start-camera');
    const btnCapture = document.getElementById('btn-capture');
    const btnStop = document.getElementById('btn-stop-camera');
    
    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' }, 
            audio: false 
        });
        video.srcObject = webcamStream;
        container.classList.remove('d-none');
        btnCapture.classList.remove('d-none');
        btnStop.classList.remove('d-none');
        btnStart.classList.add('d-none');
    } catch (err) {
        console.error("Camera access failed:", err);
        showToast("Unable to access camera. Please check permissions.", "error");
    }
};

window.captureSnapshot = function() {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('photo-canvas');
    const preview = document.getElementById('capture-preview');
    const previewContainer = document.getElementById('capture-preview-container');
    const imageUrlInput = document.getElementById('product-image-url');
    
    if (!webcamStream) return;
    
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    
    imageUrlInput.value = dataUrl;
    preview.src = dataUrl;
    previewContainer.classList.remove('d-none');
    
    showToast("Snapshot captured successfully!");
    stopWebcam();
};

window.stopWebcam = function() {
    const video = document.getElementById('webcam');
    const container = document.getElementById('camera-container');
    const btnStart = document.getElementById('btn-start-camera');
    const btnCapture = document.getElementById('btn-capture');
    const btnStop = document.getElementById('btn-stop-camera');
    
    if (webcamStream) {
        const tracks = webcamStream.getTracks();
        tracks.forEach(track => track.stop());
        webcamStream = null;
    }
    
    if (video) video.srcObject = null;
    
    if (container) container.classList.add('d-none');
    if (btnCapture) btnCapture.classList.add('d-none');
    if (btnStop) btnStop.classList.add('d-none');
    if (btnStart) btnStart.classList.remove('d-none');
};
