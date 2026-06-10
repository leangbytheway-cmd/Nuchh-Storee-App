const API_URL = "PASTE_YOUR_APPS_SCRIPT_API_URL_HERE";

let stockProducts = [];
let orderItems = [];
let historySearchTimer = null;

document.addEventListener("DOMContentLoaded", async () => {
  showLoading("Loading dashboard...");

  try {
    await loadDashboard();
  } finally {
    hideLoading();
  }
});

document.addEventListener("input", event => {
  if (event.target && event.target.id === "deliveryFee") {
    renderOrderItems();
  }
});

function showLoading(text = "Loading...") {
  const overlay = document.getElementById("loadingOverlay");
  const loadingText = document.getElementById("loadingText");

  if (!overlay || !loadingText) return;

  loadingText.innerText = text;
  overlay.classList.add("active");
}

function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");

  if (!overlay) return;

  overlay.classList.remove("active");
}

function showPage(id, button) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  document.getElementById(id).classList.add("active");

  document.querySelectorAll(".nav button").forEach(btn => {
    btn.classList.remove("active");
  });

  if (button) button.classList.add("active");
}

function showMessage(id, text, type = "success") {
  const box = document.getElementById(id);

  if (!box) return;

  box.innerHTML = `<div class="message ${type}">${escapeHtml(text)}</div>`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function apiGet(params) {
  const url = `${API_URL}?${new URLSearchParams(params).toString()}`;
  const response = await fetch(url);
  return response.json();
}

async function apiPost(body) {
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(body)
  });

  return response.json();
}

/* =========================
   DASHBOARD
========================= */

async function loadDashboard() {
  try {
    const result = await apiGet({ action: "dashboard" });

    if (!result.success) return;

    document.getElementById("todayRevenue").innerText =
      "$" + formatMoney(result.todayReport.grossTotal);

    document.getElementById("monthRevenue").innerText =
      "$" + formatMoney(result.monthReport.grossTotal);

    stockProducts = result.stock || [];
    renderProductSuggestions();
  } catch (err) {
    console.log(err);
  }
}

function renderProductSuggestions() {
  const productList = document.getElementById("productList");
  const stockProductList = document.getElementById("stockProductList");

  const availableOptions = stockProducts
    .filter(item => Number(item.currentStock) > 0)
    .map(item => `<option value="${escapeHtml(item.product)}"></option>`)
    .join("");

  const allOptions = stockProducts
    .map(item => `<option value="${escapeHtml(item.product)}"></option>`)
    .join("");

  if (productList) productList.innerHTML = availableOptions;
  if (stockProductList) stockProductList.innerHTML = allOptions;
}

/* =========================
   ADD STOCK
========================= */

async function submitStock() {
  const product = document.getElementById("stockProduct").value.trim();
  const qty = Number(document.getElementById("stockQty").value);

  if (!product || isNaN(qty) || qty <= 0) {
    showMessage("stockAddResult", "⚠️ Please enter product and valid quantity.", "error");
    return;
  }

  showLoading("Updating stock...");
  showMessage("stockAddResult", "Updating stock...");

  try {
    const result = await apiPost({
      action: "addStock",
      product,
      qty
    });

    if (!result.success) {
      showMessage("stockAddResult", "⚠️ " + result.message, "error");
      return;
    }

    showMessage(
      "stockAddResult",
      `✅ Stock Updated\n\nProduct: ${result.result.product}\nCurrent Stock: ${result.result.currentStock}`
    );

    document.getElementById("stockProduct").value = "";
    document.getElementById("stockQty").value = "";

    await refreshStockOnly();
  } catch (err) {
    showMessage("stockAddResult", "⚠️ Failed to update stock.", "error");
  } finally {
    hideLoading();
  }
}

async function refreshStockOnly() {
  const result = await apiGet({ action: "stock" });

  if (result.success) {
    stockProducts = result.stock || [];
    renderProductSuggestions();
  }
}

/* =========================
   ORDER ITEMS
========================= */

function addItemToOrder() {
  const product = document.getElementById("itemProduct").value.trim();
  const qty = Number(document.getElementById("itemQty").value);
  const subtotal = Number(document.getElementById("itemSubtotal").value);

  if (!product || isNaN(qty) || qty <= 0 || isNaN(subtotal) || subtotal < 0) {
    showMessage("orderResult", "⚠️ Please enter valid product, qty, and subtotal.", "error");
    return;
  }

  const stockItem = stockProducts.find(item =>
    item.product.toLowerCase() === product.toLowerCase()
  );

  if (!stockItem) {
    showMessage("orderResult", "⚠️ This product is not inside Stock.", "error");
    return;
  }

  const existingQty = orderItems
    .filter(item => item.product.toLowerCase() === product.toLowerCase())
    .reduce((sum, item) => sum + item.qty, 0);

  if (existingQty + qty > Number(stockItem.currentStock)) {
    showMessage(
      "orderResult",
      `⚠️ Not enough stock for ${product}.\nCurrent Stock: ${stockItem.currentStock}\nAlready in order: ${existingQty}\nTrying to add: ${qty}`,
      "error"
    );
    return;
  }

  orderItems.push({
    product,
    qty,
    subtotal
  });

  document.getElementById("itemProduct").value = "";
  document.getElementById("itemQty").value = "";
  document.getElementById("itemSubtotal").value = "";
  document.getElementById("orderResult").innerHTML = "";

  renderOrderItems();
}

function removeOrderItem(index) {
  orderItems.splice(index, 1);
  renderOrderItems();
}

function renderOrderItems() {
  const list = document.getElementById("orderItemsList");
  const grossBox = document.getElementById("grossTotal");
  const deliveryBox = document.getElementById("deliveryFeePreview");
  const netBox = document.getElementById("netTotal");

  const deliveryFee = Number(document.getElementById("deliveryFee")?.value) || 0;

  if (!orderItems.length) {
    list.innerHTML = "No products added yet.";
    grossBox.innerText = "$0";
    deliveryBox.innerText = "$" + formatMoney(deliveryFee);
    netBox.innerText = "$0";
    return;
  }

  let grossTotal = 0;

  list.innerHTML = orderItems.map((item, index) => {
    grossTotal += item.subtotal;

    return `
      <div class="cart-item">
        <div>
          <strong>${escapeHtml(item.product)}</strong>
          <span>x${item.qty}</span>
        </div>

        <div class="cart-right">
          <strong>$${formatMoney(item.subtotal)}</strong>
          <button type="button" class="remove-btn" onclick="removeOrderItem(${index})">Remove</button>
        </div>
      </div>
    `;
  }).join("");

  const netTotal = grossTotal - deliveryFee;

  grossBox.innerText = "$" + formatMoney(grossTotal);
  deliveryBox.innerText = "$" + formatMoney(deliveryFee);
  netBox.innerText = "$" + formatMoney(netTotal);
}

/* =========================
   SUBMIT ORDER
========================= */

async function submitOrder() {
  const customer = document.getElementById("customer").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  const delivery = document.getElementById("delivery").value;
  const deliveryFee = Number(document.getElementById("deliveryFee").value) || 0;

  if (!customer || !phone || !address || !delivery) {
    showMessage("orderResult", "⚠️ Please fill customer, phone, address, and delivery.", "error");
    return;
  }

  if (deliveryFee < 0) {
    showMessage("orderResult", "⚠️ Delivery fee cannot be negative.", "error");
    return;
  }

  if (!orderItems.length) {
    showMessage("orderResult", "⚠️ Please add at least one product.", "error");
    return;
  }

  showLoading("Saving order...");
  showMessage("orderResult", "Saving order...");

  try {
    const result = await apiPost({
      action: "createOrder",
      customer,
      phone,
      address,
      delivery,
      deliveryFee,
      items: orderItems
    });

    if (!result.success) {
      showMessage("orderResult", "⚠️ " + result.message, "error");
      return;
    }

    const text =
`✅ Order Recorded

Order ID: ${result.result.orderId}
Gross Total: $${formatMoney(result.result.grossTotal)}
Delivery Fee: $${formatMoney(result.result.deliveryFee)}
Net Total: $${formatMoney(result.result.netTotal)}

Customer Message:

${result.confirmation}`;

    showMessage("orderResult", text);

    document.getElementById("customer").value = "";
    document.getElementById("phone").value = "";
    document.getElementById("address").value = "";
    document.getElementById("delivery").value = "D2D";
    document.getElementById("deliveryFee").value = "";

    orderItems = [];
    renderOrderItems();

    await loadDashboard();
  } catch (err) {
    showMessage("orderResult", "⚠️ Failed to save order.", "error");
  } finally {
    hideLoading();
  }
}

/* =========================
   STOCK VIEW
========================= */

async function loadStock() {
  const box = document.getElementById("stockList");

  box.innerHTML = "Loading...";
  showLoading("Loading stock...");

  try {
    const result = await apiGet({ action: "stock" });

    if (!result.success) {
      box.innerHTML = "⚠️ " + result.message;
      return;
    }

    if (!result.stock.length) {
      box.innerHTML = "No stock yet.";
      return;
    }

    box.innerHTML = result.stock.map(item => `
      <div class="list-item">
        <span>${escapeHtml(item.product)}</span>
        <strong>${item.currentStock}</strong>
      </div>
    `).join("");

    stockProducts = result.stock || [];
    renderProductSuggestions();
  } catch (err) {
    box.innerHTML = "⚠️ Failed to load stock.";
  } finally {
    hideLoading();
  }
}

/* =========================
   REPORTS
========================= */

async function loadReports() {
  showLoading("Loading reports...");

  try {
    const result = await apiGet({ action: "dashboard" });

    if (!result.success) {
      document.getElementById("topProducts").innerHTML = "⚠️ Failed to load reports.";
      return;
    }

    const today = result.todayReport;
    const month = result.monthReport;

    document.getElementById("todayDetail").innerText =
      "$" + formatMoney(today.grossTotal);

    document.getElementById("todayMeta").innerText =
      `Orders: ${today.orderCount} • Units: ${today.unitsSold} • Delivery: $${formatMoney(today.deliveryFeeTotal)} • Net: $${formatMoney(today.netTotal)}`;

    document.getElementById("monthDetail").innerText =
      "$" + formatMoney(month.grossTotal);

    document.getElementById("monthMeta").innerText =
      `Orders: ${month.orderCount} • Units: ${month.unitsSold} • Delivery: $${formatMoney(month.deliveryFeeTotal)} • Net: $${formatMoney(month.netTotal)}`;

    const top = month.topProducts || [];

    if (!top.length) {
      document.getElementById("topProducts").innerHTML = "No sales yet.";
    } else {
      document.getElementById("topProducts").innerHTML = top.slice(0, 5).map(item => `
        <div class="list-item">
          <span>${escapeHtml(item.product)}</span>
          <strong>${item.qty}</strong>
        </div>
      `).join("");
    }

    stockProducts = result.stock || [];
    renderProductSuggestions();
  } catch (err) {
    document.getElementById("topProducts").innerHTML = "⚠️ Failed to load reports.";
  } finally {
    hideLoading();
  }
}

/* =========================
   HISTORY
========================= */

async function loadOrdersHistory() {
  const searchInput = document.getElementById("historySearch");
  const search = searchInput ? searchInput.value.trim() : "";

  const box = document.getElementById("historyResult");

  box.innerHTML = "Loading orders...";
  showLoading(search ? "Searching orders..." : "Loading history...");

  try {
    const result = await apiGet({
      action: "ordersHistory",
      search
    });

    if (!result.success) {
      box.innerHTML = `<div class="message error">⚠️ ${escapeHtml(result.message)}</div>`;
      return;
    }

    renderOrdersHistory(result.orders || []);
  } catch (err) {
    box.innerHTML = `<div class="message error">⚠️ Failed to load order history.</div>`;
  } finally {
    hideLoading();
  }
}

function filterHistoryTyping() {
  clearTimeout(historySearchTimer);

  historySearchTimer = setTimeout(() => {
    loadOrdersHistory();
  }, 700);
}

function renderOrdersHistory(orders) {
  const box = document.getElementById("historyResult");

  if (!orders.length) {
    box.innerHTML = `<div class="message error">No orders found.</div>`;
    return;
  }

  box.innerHTML = orders.map((order, index) => {
    const dateText = formatDate(order.date);

    const itemsHtml = order.items.length
      ? order.items.map(item => `
          <div class="history-product">
            <span>${escapeHtml(item.product)} x${item.qty}</span>
            <strong>$${formatMoney(item.subtotal)}</strong>
          </div>
        `).join("")
      : `<div class="small">No product details found.</div>`;

    return `
      <div class="history-card">
        <button class="history-main" onclick="toggleOrderDetail(${index})">
          <div>
            <strong>${escapeHtml(order.customer)}</strong>
            <span>${escapeHtml(order.phone)}</span>
            <small>${escapeHtml(dateText)}</small>
          </div>

          <div class="history-total">
            <strong>$${formatMoney(order.grossTotal)}</strong>
            <span>${escapeHtml(order.orderId)}</span>
          </div>
        </button>

        <div id="orderDetail-${index}" class="history-detail">
          <div class="detail-row">
            <span>Order ID</span>
            <strong>${escapeHtml(order.orderId)}</strong>
          </div>

          <div class="detail-row">
            <span>Name</span>
            <strong>${escapeHtml(order.customer)}</strong>
          </div>

          <div class="detail-row">
            <span>Phone</span>
            <strong>${escapeHtml(order.phone)}</strong>
          </div>

          <div class="detail-row">
            <span>Address</span>
            <strong>${escapeHtml(order.address)}</strong>
          </div>

          <div class="detail-row">
            <span>Delivery</span>
            <strong>${escapeHtml(order.delivery)}</strong>
          </div>

          <div class="detail-row">
            <span>Delivery Fee</span>
            <strong>$${formatMoney(order.deliveryFee)}</strong>
          </div>

          <div class="detail-row">
            <span>Gross Total</span>
            <strong>$${formatMoney(order.grossTotal)}</strong>
          </div>

          <div class="detail-row">
            <span>Net Total</span>
            <strong>$${formatMoney(order.netTotal)}</strong>
          </div>

          <div class="detail-products">
            <h3>Products</h3>
            ${itemsHtml}
          </div>

          <button class="danger-btn" onclick="deleteOrder('${escapeHtml(order.orderId)}')">
            Delete Order
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function toggleOrderDetail(index) {
  const detail = document.getElementById(`orderDetail-${index}`);

  if (!detail) return;

  detail.classList.toggle("active");
}

async function deleteOrder(orderId) {
  const confirmed = confirm(
    `Delete ${orderId}?\n\nThis will restore stock and remove the order from history.`
  );

  if (!confirmed) return;

  showLoading("Deleting order...");

  try {
    const result = await apiPost({
      action: "deleteOrder",
      orderId
    });

    if (!result.success) {
      alert("⚠️ " + result.message);
      return;
    }

    alert("✅ Order deleted and stock restored.");

    await loadDashboard();
    await loadOrdersHistory();
  } catch (err) {
    alert("⚠️ Failed to delete order.");
  } finally {
    hideLoading();
  }
}

/* =========================
   HELPERS
========================= */

function formatDate(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (isNaN(date.getTime())) {
    return String(dateValue);
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatMoney(value) {
  const number = Number(value) || 0;

  if (Number.isInteger(number)) {
    return String(number);
  }

  return number.toFixed(2);
}