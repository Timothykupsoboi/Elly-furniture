// Elly Furniture - Customer Side Application Engine (Supabase Powered)

(function () {
    'use strict';

    // -------------------------------------------------------------
    // Helper: Toast Notifications
    // -------------------------------------------------------------
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
        
        // Add animation style keyframe if not present
        if (!document.getElementById('toast-animation-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-animation-styles';
            style.innerHTML = `
                @keyframes slideIn {
                    from { transform: translateX(120%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // -------------------------------------------------------------
    // State Management: Cart Logic (Saved in localStorage)
    // -------------------------------------------------------------
    const Cart = {
        getItems() {
            try {
                const data = localStorage.getItem('elly_cart');
                return data ? JSON.parse(data) : [];
            } catch (e) {
                console.error("Cart retrieval failed:", e);
                return [];
            }
        },

        saveItems(items) {
            localStorage.setItem('elly_cart', JSON.stringify(items));
            this.updateHeaderBadge();
        },

        addItem(product, qty = 1) {
            const items = this.getItems();
            const existing = items.find(item => item.product_id === product.id);
            if (existing) {
                existing.quantity += qty;
            } else {
                items.push({
                    product_id: product.id,
                    name: product.name,
                    price: parseFloat(product.price),
                    quantity: qty,
                    image_url: product.image_url
                });
            }
            this.saveItems(items);
            showToast("Item successfully added to cart");
        },

        removeItem(productId) {
            let items = this.getItems();
            items = items.filter(item => item.product_id !== productId);
            this.saveItems(items);
            showToast('Item removed from cart.');
        },

        updateQuantity(productId, quantity) {
            const items = this.getItems();
            const item = items.find(item => item.product_id === productId);
            if (item) {
                item.quantity = Math.max(1, parseInt(quantity) || 1);
            }
            this.saveItems(items);
        },

        clear() {
            localStorage.removeItem('elly_cart');
            this.updateHeaderBadge();
        },

        getTotals() {
            const items = this.getItems();
            let count = 0;
            let amount = 0;
            items.forEach(item => {
                count += item.quantity;
                amount += item.price * item.quantity;
            });
            return { count, amount };
        },

        updateHeaderBadge() {
            const cartLinks = document.querySelectorAll('a[href="cart.html"]');
            const totals = this.getTotals();
            cartLinks.forEach(link => {
                const oldBadge = link.querySelector('.cart-badge');
                if (oldBadge) oldBadge.remove();

                if (totals.count > 0) {
                    const badge = document.createElement('span');
                    badge.className = 'cart-badge badge bg-danger text-white rounded-pill ms-1';
                    badge.style.cssText = 'font-size: 0.75rem; vertical-align: top; padding: 0.25em 0.45em;';
                    badge.textContent = totals.count;
                    link.appendChild(badge);
                }
            });
        }
    };

    // -------------------------------------------------------------
    // Page Initializers
    // -------------------------------------------------------------
    
    // Page: Home (index.html)
    async function initHomePage() {
        const productRow = document.querySelector('.product-section .row');
        if (!productRow) return;

        try {
            await window.Supa.init();
            const products = await window.Supa.fetchAll('products');
            
            // Filter to top 3 products
            const featured = products.slice(0, 3);
            if (featured.length === 0) {
                // If no products, we can show a placeholder or notice
                return;
            }

            // Remove columns 2, 3, 4 (keep first title column)
            const columns = Array.from(productRow.children);
            columns.forEach((col, idx) => {
                if (idx > 0) col.remove();
            });

            // Append dynamic products
            featured.forEach(product => {
                const col = document.createElement('div');
                col.className = 'col-12 col-md-4 col-lg-3 mb-5 mb-md-0';
                col.innerHTML = `
                    <div class="product-item" style="cursor: pointer; position: relative; border: 1px solid rgba(0,0,0,0.05); padding: 20px; border-radius: 10px; background: #fff; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <img src="${product.image_url || 'images/couch.png'}" class="img-fluid product-thumbnail" style="max-height: 180px; object-fit: contain; width: 100%; margin-bottom: 15px;">
                            <h3 class="product-title" style="font-weight: 600; font-size: 1.1rem; color: #2f2f2f;">${product.name}</h3>
                            <p style="font-size: 0.85rem; color: #6a6a6a; min-height: 40px; margin-bottom: 10px;">${product.description || ''}</p>
                        </div>
                        <div>
                            <strong class="product-price" style="font-size: 1.25rem; color: #2f2f2f; display: block; margin-bottom: 15px;">Ksh ${parseFloat(product.price).toFixed(2)}</strong>
                        </div>
                        <span class="icon-cross btn-add-to-cart">
                            <img src="images/cross.svg" class="img-fluid">
                        </span>
                    </div>
                `;

                // Add to cart event
                col.querySelector('.btn-add-to-cart').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    Cart.addItem(product);
                });

                productRow.appendChild(col);
            });

        } catch (e) {
            console.error("Home page products loading failed:", e);
        }
    }

    // Page: Shop (shop.html)
    async function initShopPage() {
        const productRow = document.querySelector('.untree_co-section .row');
        if (!productRow) return;

        productRow.innerHTML = '<div class="col-12 text-center py-5"><h4>Loading products catalog...</h4></div>';

        try {
            await window.Supa.init();
            const products = await window.Supa.fetchAll('products');
            
            productRow.innerHTML = '';

            if (products.length === 0) {
                productRow.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <div class="p-5 border rounded bg-light">
                            <h3>No Products Found</h3>
                            <p>We are currently setting up our showroom catalog. Please visit us again shortly.</p>
                            <a href="index.html" class="btn btn-primary">Go to Home</a>
                        </div>
                    </div>`;
                return;
            }

            products.forEach(product => {
                const col = document.createElement('div');
                col.className = 'col-12 col-md-4 col-lg-3 mb-5';
                col.innerHTML = `
                    <div class="product-item" style="cursor: pointer; position: relative; border: 1px solid rgba(0,0,0,0.05); padding: 20px; border-radius: 10px; background: #fff; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <img src="${product.image_url || 'images/couch.png'}" class="img-fluid product-thumbnail" style="max-height: 180px; object-fit: contain; width: 100%; margin-bottom: 15px;">
                            <h3 class="product-title" style="font-weight: 600; font-size: 1.1rem; color: #2f2f2f;">${product.name}</h3>
                            <p style="font-size: 0.85rem; color: #6a6a6a; min-height: 40px; margin-bottom: 10px;">${product.description || ''}</p>
                        </div>
                        <div>
                            <strong class="product-price" style="font-size: 1.25rem; color: #2f2f2f; display: block; margin-bottom: 15px;">Ksh ${parseFloat(product.price).toFixed(2)}</strong>
                            <button class="btn btn-primary btn-sm w-100 btn-add-to-cart" style="border-radius: 30px; font-weight: 600; font-size: 0.85rem; padding: 10px 15px;">+ Add to Cart</button>
                        </div>
                    </div>
                `;

                col.querySelector('.btn-add-to-cart').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    Cart.addItem(product);
                });

                productRow.appendChild(col);
            });

        } catch (e) {
            console.error("Shop page products loading failed:", e);
            productRow.innerHTML = `<div class="col-12 text-center py-5 text-danger"><h4>Failed to load products: ${e.message}</h4></div>`;
        }
    }

    // Page: Cart (cart.html)
    function initCartPage() {
        const tbody = document.querySelector('.site-blocks-table tbody');
        if (!tbody) return;

        const cartContainer = document.querySelector('.site-blocks-table');
        const emptyAlert = document.createElement('div');
        emptyAlert.id = 'empty-cart-alert';
        emptyAlert.className = 'text-center py-5 border rounded bg-white mb-5';
        emptyAlert.innerHTML = `
            <h3>Your Shopping Cart is Empty</h3>
            <p class="mb-4">You have no items in your cart. Start shopping to add furniture!</p>
            <a href="shop.html" class="btn btn-primary">Shop Our Catalog</a>`;
        emptyAlert.style.display = 'none';
        cartContainer.parentNode.insertBefore(emptyAlert, cartContainer);

        function renderCartTable() {
            const items = Cart.getItems();
            tbody.innerHTML = '';
            
            if (items.length === 0) {
                cartContainer.style.display = 'none';
                emptyAlert.style.display = 'block';
                // Hide checkout sum blocks
                const cartSummaryBlock = document.querySelector('.site-blocks-table').parentNode.nextElementSibling;
                if (cartSummaryBlock) cartSummaryBlock.style.display = 'none';

                // Reset totals to zero when empty
                const totalsContainer = document.querySelector('.col-md-6.pl-5');
                if (totalsContainer) {
                    const subtotalValEl = totalsContainer.querySelector('.row.mb-3 strong.text-black');
                    const totalValEl = totalsContainer.querySelector('.row.mb-5 strong.text-black');
                    if (subtotalValEl) subtotalValEl.textContent = `Ksh 0.00`;
                    if (totalValEl) totalValEl.textContent = `Ksh 0.00`;
                }
                return;
            }

            cartContainer.style.display = 'block';
            emptyAlert.style.display = 'none';
            const cartSummaryBlock = document.querySelector('.site-blocks-table').parentNode.nextElementSibling;
            if (cartSummaryBlock) cartSummaryBlock.style.display = 'flex';

            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="product-thumbnail">
                        <img src="${item.image_url || 'images/couch.png'}" alt="Image" class="img-fluid" style="max-height: 80px; object-fit: contain;">
                    </td>
                    <td class="product-name">
                        <h2 class="h5 text-black">${item.name}</h2>
                    </td>
                    <td>Ksh ${item.price.toFixed(2)}</td>
                    <td>
                        <div class="input-group mb-3 d-flex align-items-center quantity-container" style="max-width: 120px; margin: auto;">
                            <div class="input-group-prepend">
                                <button class="btn btn-outline-black btn-decrease" type="button">&minus;</button>
                            </div>
                            <input type="text" class="form-control text-center quantity-amount" value="${item.quantity}" readonly>
                            <div class="input-group-append">
                                <button class="btn btn-outline-black btn-increase" type="button">&plus;</button>
                            </div>
                        </div>
                    </td>
                    <td>Ksh ${(item.price * item.quantity).toFixed(2)}</td>
                    <td><button type="button" class="btn btn-black btn-sm btn-remove">X</button></td>
                `;

                // Wire decrease button
                tr.querySelector('.btn-decrease').addEventListener('click', () => {
                    if (item.quantity > 1) {
                        Cart.updateQuantity(item.product_id, item.quantity - 1);
                        renderCartTable();
                    }
                });

                // Wire increase button
                tr.querySelector('.btn-increase').addEventListener('click', () => {
                    Cart.updateQuantity(item.product_id, item.quantity + 1);
                    renderCartTable();
                });

                // Wire remove button
                tr.querySelector('.btn-remove').addEventListener('click', () => {
                    Cart.removeItem(item.product_id);
                    renderCartTable();
                });

                tbody.appendChild(tr);
            });

            // Update Totals
            const totals = Cart.getTotals();
            const subtotalEls = document.querySelectorAll('.site-blocks-table + div, .row strong.text-black');
            
            // Find Subtotal and Total element containers in Totals Card
            // The Totals are inside a col-md-6 pl-5 block
            const totalsContainer = document.querySelector('.col-md-6.pl-5');
            if (totalsContainer) {
                const subtotalValEl = totalsContainer.querySelector('.row.mb-3 strong.text-black');
                const totalValEl = totalsContainer.querySelector('.row.mb-5 strong.text-black');
                if (subtotalValEl) subtotalValEl.textContent = `Ksh ${totals.amount.toFixed(2)}`;
                if (totalValEl) totalValEl.textContent = `Ksh ${totals.amount.toFixed(2)}`;
            }
        }

        renderCartTable();

        // Wire Delete Cart Button
        const deleteCartBtn = document.getElementById('btn-delete-cart');
        if (deleteCartBtn) {
            deleteCartBtn.addEventListener('click', (e) => {
                e.preventDefault();
                Cart.clear();
                renderCartTable();
                showToast("Cart cleared successfully.");
            });
        }
        
        // Wire Continue Shopping Button
        const continueBtn = document.getElementById('btn-continue-shopping');
        if (continueBtn) {
            continueBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'shop.html';
            });
        }
    }

    // Page: Checkout (checkout.html)
    function initCheckoutPage() {
        const orderTableBody = document.querySelector('.site-block-order-table tbody');
        if (!orderTableBody) return;

        const items = Cart.getItems();
        if (items.length === 0) {
            showToast("Your cart is empty. Redirecting to shop...", "warning");
            setTimeout(() => { window.location.href = 'shop.html'; }, 2000);
            return;
        }

        // Render Checkout Summary Table
        orderTableBody.innerHTML = '';
        let subtotal = 0;

        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.name} <strong class="mx-2">x</strong> ${item.quantity}</td>
                <td>Ksh ${(item.price * item.quantity).toFixed(2)}</td>
            `;
            orderTableBody.appendChild(tr);
            subtotal += item.price * item.quantity;
        });

        // Subtotal row
        const subtotalTr = document.createElement('tr');
        subtotalTr.innerHTML = `
            <td class="text-black font-weight-bold"><strong>Cart Subtotal</strong></td>
            <td class="text-black">Ksh ${subtotal.toFixed(2)}</td>
        `;
        orderTableBody.appendChild(subtotalTr);

        // Grand total row
        const totalTr = document.createElement('tr');
        totalTr.innerHTML = `
            <td class="text-black font-weight-bold"><strong>Order Total</strong></td>
            <td class="text-black font-weight-bold"><strong>Ksh ${subtotal.toFixed(2)}</strong></td>
        `;
        orderTableBody.appendChild(totalTr);

        // Customize Payment Methods section (remove default bank/cheque, replace with M-Pesa & Cash on Delivery)
        const yourOrderBox = orderTableBody.closest('.p-3.p-lg-5');
        if (yourOrderBox) {
            // Find place order button and payment option wrappers
            const payWrappers = yourOrderBox.querySelectorAll('.border.p-3.mb-3, .border.p-3.mb-5');
            payWrappers.forEach(w => w.remove());

            const placeOrderBtnGroup = yourOrderBox.querySelector('.form-group');
            if (placeOrderBtnGroup) {
                // Insert M-Pesa and Cash on Delivery choices before button group
                const paymentGroup = document.createElement('div');
                paymentGroup.className = 'mb-4';
                paymentGroup.innerHTML = `
                    <h3 class="h6 mb-3 text-black font-weight-bold">Payment Methods</h3>
                    
                    <div class="form-check border p-3 rounded mb-3" style="cursor: pointer;">
                        <input class="form-check-input" type="radio" name="payment_method" id="pay_mpesa" value="M-Pesa" checked style="margin-left: 0;">
                        <label class="form-check-label font-weight-bold text-black ms-4" for="pay_mpesa" style="cursor: pointer;">
                            M-Pesa
                        </label>
                        <div class="mt-2 text-muted small ms-4">
                            Pay securely using Safaricom M-Pesa. A payment request will be registered, and you will finalize on delivery or dynamic prompt.
                        </div>
                    </div>
                    
                    <div class="form-check border p-3 rounded mb-3" style="cursor: pointer;">
                        <input class="form-check-input" type="radio" name="payment_method" id="pay_cod" value="Cash on Delivery" style="margin-left: 0;">
                        <label class="form-check-label font-weight-bold text-black ms-4" for="pay_cod" style="cursor: pointer;">
                            Cash on Delivery
                        </label>
                        <div class="mt-2 text-muted small ms-4">
                            Pay in cash when your furniture items are safely delivered to your doorstep.
                        </div>
                    </div>
                `;
                placeOrderBtnGroup.parentNode.insertBefore(paymentGroup, placeOrderBtnGroup);

                // Setup checkout placement
                const placeBtn = placeOrderBtnGroup.querySelector('button');
                if (placeBtn) {
                    // Remove standard onclick redirects
                    placeBtn.removeAttribute('onclick');
                    placeBtn.type = 'button';
                    
                    placeBtn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await handleCheckoutSubmit(placeBtn);
                    });
                }
            }
        }
    }

    // Checkout form handler
    async function handleCheckoutSubmit(submitBtn) {
        // Collect form fields
        const fname = document.getElementById('c_fname')?.value.trim();
        const lname = document.getElementById('c_lname')?.value.trim();
        const email = document.getElementById('c_email_address')?.value.trim();
        const phone = document.getElementById('c_phone')?.value.trim();
        const address = document.getElementById('c_address')?.value.trim();
        const countyCity = document.getElementById('c_state_country')?.value.trim();

        // Validation
        if (!fname || !lname || !email || !phone || !address || !countyCity) {
            showToast("Please fill in all required billing information.", "error");
            return;
        }

        const fullName = `${fname} ${lname}`;
        
        // Select payment method
        const paymentRadio = document.querySelector('input[name="payment_method"]:checked');
        const paymentMethod = paymentRadio ? paymentRadio.value : 'Cash on Delivery';

        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing your order...';

        try {
            await window.Supa.init();
            
            const cartItems = Cart.getItems();
            const totals = Cart.getTotals();
            const orderNum = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

            // 1. Check if customer exists by phone, upsert record in customers
            // Fetch customer by phone
            let customerObj = null;
            try {
                const { data: customerMatch, error: customerErr } = await window.Supa.client
                    .from('customers')
                    .select('*')
                    .eq('phone', phone)
                    .maybeSingle();

                if (customerMatch) {
                    // Update details
                    const { data: updatedCustomer } = await window.Supa.client
                        .from('customers')
                        .update({
                            full_name: fullName,
                            email: email,
                            county_city: countyCity,
                            delivery_address: address
                        })
                        .eq('id', customerMatch.id)
                        .select();
                    
                    if (updatedCustomer && updatedCustomer.length > 0) {
                        customerObj = updatedCustomer[0];
                    }
                } else {
                    // Insert customer
                    const { data: insertedCustomer } = await window.Supa.client
                        .from('customers')
                        .insert({
                            full_name: fullName,
                            phone: phone,
                            email: email,
                            county_city: countyCity,
                            delivery_address: address
                        })
                        .select();

                    if (insertedCustomer && insertedCustomer.length > 0) {
                        customerObj = insertedCustomer[0];
                    }
                }
            } catch (err) {
                console.warn("Failed to update/insert customer records, proceeding directly with order:", err);
            }

            // 2. Save order to Supabase orders table
            const orderPayload = {
                order_number: orderNum,
                customer_name: fullName,
                phone: phone,
                email: email,
                county_city: countyCity,
                delivery_address: address,
                products_ordered: cartItems,
                quantity: totals.count,
                total_amount: totals.amount,
                payment_method: paymentMethod,
                order_status: 'Pending'
            };

            const insertedOrders = await window.Supa.insert('orders', orderPayload);
            if (!insertedOrders || insertedOrders.length === 0) {
                throw new Error("Unable to save order record in Supabase.");
            }
            const orderId = insertedOrders[0].id;

            // 3. Save sale entry to sales_records table
            const salePayload = {
                order_id: orderId,
                order_number: orderNum,
                customer_name: fullName,
                total_amount: totals.amount,
                payment_method: paymentMethod
            };
            
            await window.Supa.insert('sales_records', salePayload);

            // 4. Clear Cart and Redirect
            Cart.clear();
            showToast("Order placed successfully!", "success");
            
            setTimeout(() => {
                window.location.href = `thankyou.html?order=${orderNum}`;
            }, 1000);

        } catch (e) {
            console.error("Order completion failed:", e);
            showToast(`Order submission failed: ${e.message || e}`, "error");
            submitBtn.disabled = false;
            submitBtn.textContent = 'Place Order';
        }
    }

    // Page: Thank You (thankyou.html)
    function initThankYouPage() {
        const leadText = document.querySelector('.untree_co-section p.lead');
        if (!leadText) return;

        const params = new URLSearchParams(window.location.search);
        const orderNum = params.get('order');
        if (orderNum) {
            leadText.innerHTML = `Your order <strong>${orderNum}</strong> was successfully completed. Thank you for choosing Elly Furniture!`;
        }
    }

    // -------------------------------------------------------------
    // Route Router and Auto-init
    // -------------------------------------------------------------
    function router() {
        // Run badge updates on all pages
        Cart.updateHeaderBadge();

        const path = window.location.pathname.toLowerCase();
        if (path.endsWith('index.html') || path.endsWith('/index') || path.endsWith('/') || path === '') {
            initHomePage();
        } else if (path.endsWith('shop.html') || path.endsWith('/shop')) {
            initShopPage();
        } else if (path.endsWith('cart.html') || path.endsWith('/cart')) {
            initCartPage();
        } else if (path.endsWith('checkout.html') || path.endsWith('/checkout')) {
            initCheckoutPage();
        } else if (path.endsWith('thankyou.html') || path.endsWith('/thankyou')) {
            initThankYouPage();
        }
    }

    document.addEventListener('DOMContentLoaded', router);

})(window);
