const API_URL = "https://script.google.com/macros/s/AKfycbyyy94-2wrXcgr4r3tB3egQSfPLcmsDkoqRWJUB34a6N7PvlEQJUXxkT46MTx7QnYlNSg/exec";

let stockProducts = [];
let orderItems = [];

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
  }
}

/* =========================
   VIEW STOCK
========================= */

async function loadStock() {
  const box = document.getElementById("stockList");
  box.innerHTML = "Loading...";

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
  }
}

/* =========================
   REPORTS
========================= */

async function loadReports() {
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
  }
}

/* =========================
   HISTORY
========================= */

async function loadHistory() {
  const phone = document.getElementById("historyPhone").value.trim();

  showMessage("historyResult", "Searching...");

  try {
    const result = await apiGet({
      action: "history",
      phone
    });

    if (!result.success) {
      showMessage("historyResult", "⚠️ " + result.message, "error");
      return;
    }

    const history = result.history;

    if (history.orderCount === 0) {
      showMessage("historyResult", "No order history found.", "error");
      return;
    }

    let text =
`👤 Customer History

Name: ${history.name}
Phone: ${history.phone}
Orders: ${history.orderCount}
Total Spent: $${history.totalSpent}

Recent Orders:
`;

    history.recentOrders.forEach(order => {
      text += `\n${order.orderId} - $${order.orderTotal} (${order.delivery})\n`;

      order.items.forEach(item => {
        text += `- ${item.product} x${item.qty} = $${item.lineTotal}\n`;
      });
    });

    showMessage("historyResult", text);
  } catch (err) {
    showMessage("historyResult", "⚠️ Failed to load history.", "error");
  }
}