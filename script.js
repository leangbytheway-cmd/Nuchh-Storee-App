const API_URL = "https://script.google.com/macros/s/AKfycbyIIR8jF88OQsw4rAsQ2y3YRSroeA-yF7jPjRHlc_s2KNtgIPVr-c9hEyYYlayZwjLYng/exec";

let historySearchTimer = null;
let stockProducts = [];
let orderItems = [];

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

document.addEventListener("DOMContentLoaded", () => {
  loadDashboard();
  loadStockProducts();
});

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
  document.getElementById(id).innerHTML =
    `<div class="message ${type}">${escapeHtml(text)}</div>`;
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
    const today = await apiGet({ action: "report", type: "today" });
    const month = await apiGet({ action: "report", type: "month" });

    if (today.success) {
      document.getElementById("todayRevenue").innerText =
        "$" + today.report.revenue;
    }

    if (month.success) {
      document.getElementById("monthRevenue").innerText =
        "$" + month.report.revenue;
    }
  } catch (err) {
    console.log(err);
  }
}

async function loadStockProducts() {
  try {
    const result = await apiGet({ action: "stock" });

    if (result.success) {
      stockProducts = result.stock || [];
      renderProductSuggestions();
    }
  } catch (err) {
    console.log(err);
  }
}

function renderProductSuggestions() {
  const productList = document.getElementById("productList");

  if (!productList) return;

  productList.innerHTML = stockProducts
    .filter(item => Number(item.currentStock) > 0)
    .map(item => `<option value="${escapeHtml(item.product)}"></option>`)
    .join("");
}

/* =========================
   ADD STOCK
========================= */

async function submitStock() {
  const product = document.getElementById("stockProduct").value.trim();
  const qty = document.getElementById("stockQty").value;

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

    await loadDashboard();
    await loadStockProducts();
  } catch (err) {
    showMessage("stockAddResult", "⚠️ Failed to update stock.", "error");
  } finally {
    hideLoading();
  }
}

/* =========================
   MULTI-PRODUCT ORDER
========================= */

function addItemToOrder() {
  const product = document.getElementById("itemProduct").value.trim();
  const qty = Number(document.getElementById("itemQty").value);
  const unitPrice = Number(document.getElementById("itemPrice").value);

  if (!product || isNaN(qty) || qty <= 0 || isNaN(unitPrice) || unitPrice < 0) {
    showMessage("orderResult", "⚠️ Please enter valid product, qty, and unit price.", "error");
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
    unitPrice,
    lineTotal: qty * unitPrice
  });

  document.getElementById("itemProduct").value = "";
  document.getElementById("itemQty").value = "";
  document.getElementById("itemPrice").value = "";
  document.getElementById("orderResult").innerHTML = "";

  renderOrderItems();
}

function removeOrderItem(index) {
  orderItems.splice(index, 1);
  renderOrderItems();
}

function renderOrderItems() {
  const list = document.getElementById("orderItemsList");
  const totalBox = document.getElementById("orderTotal");

  if (!orderItems.length) {
    list.innerHTML = "No products added yet.";
    totalBox.innerText = "$0";
    return;
  }

  let total = 0;

  list.innerHTML = orderItems.map((item, index) => {
    total += item.lineTotal;

    return `
      <div class="cart-item">
        <div>
          <strong>${escapeHtml(item.product)}</strong>
          <span>x${item.qty} • $${item.unitPrice} each</span>
        </div>

        <div class="cart-right">
          <strong>$${item.lineTotal}</strong>
          <button type="button" class="remove-btn" onclick="removeOrderItem(${index})">Remove</button>
        </div>
      </div>
    `;
  }).join("");

  totalBox.innerText = "$" + total;
}

async function submitOrder() {
  const customer = document.getElementById("customer").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  const delivery = document.getElementById("delivery").value;

  if (!customer || !phone || !address || !delivery) {
    showMessage("orderResult", "⚠️ Please fill customer, phone, address, and delivery.", "error");
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
      items: orderItems
    });

    if (!result.success) {
      showMessage("orderResult", "⚠️ " + result.message, "error");
      return;
    }

    const text =
`✅ Order Recorded

Order ID: ${result.result.orderId}
Order Total: $${result.result.orderTotal}

Customer Message:

${result.confirmation}`;

    showMessage("orderResult", text);

    document.getElementById("customer").value = "";
    document.getElementById("phone").value = "";
    document.getElementById("address").value = "";
    document.getElementById("delivery").value = "D2D";

    orderItems = [];
    renderOrderItems();

    await loadDashboard();
    await loadStockProducts();
  } catch (err) {
    showMessage("orderResult", "⚠️ Failed to save order.", "error");
  } finally {
    hideLoading();
  }
}

/* =========================
   VIEW STOCK
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
    const today = await apiGet({ action: "report", type: "today" });
    const month = await apiGet({ action: "report", type: "month" });

    if (today.success) {
      document.getElementById("todayDetail").innerText =
        "$" + today.report.revenue;
      document.getElementById("todayMeta").innerText =
        `Orders: ${today.report.orderCount} • Units: ${today.report.unitsSold}`;
    }

    if (month.success) {
      document.getElementById("monthDetail").innerText =
        "$" + month.report.revenue;
      document.getElementById("monthMeta").innerText =
        `Orders: ${month.report.orderCount} • Units: ${month.report.unitsSold}`;

      const top = month.report.topProducts || [];

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
    }
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
  }, 400);
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
            <strong>$${item.lineTotal}</strong>
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
            <strong>$${order.orderTotal}</strong>
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

          <div class="detail-products">
            <h3>Products</h3>
            ${itemsHtml}
          </div>

          <div class="detail-total">
            <span>Total</span>
            <strong>$${order.orderTotal}</strong>
          </div>
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