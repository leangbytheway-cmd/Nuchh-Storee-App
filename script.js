const API_URL = "https://script.google.com/macros/s/AKfycbzPWcmemIEJCvkvyQYuGFE5EOnofBWut1r0vQGBytGiq-5ukXhwUet4BA1wVh5e_2Xi3w/exec";

document.addEventListener("DOMContentLoaded", () => {
  loadDashboard();
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

    loadDashboard();
  } catch (err) {
    showMessage("stockAddResult", "⚠️ Failed to update stock.", "error");
  }
}

async function submitOrder() {
  const order = {
    action: "createOrder",
    customer: document.getElementById("customer").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    product: document.getElementById("product").value.trim(),
    qty: document.getElementById("qty").value,
    price: document.getElementById("price").value,
    address: document.getElementById("address").value.trim(),
    delivery: document.getElementById("delivery").value
  };

  showMessage("orderResult", "Saving order...");

  try {
    const result = await apiPost(order);

    if (!result.success) {
      showMessage("orderResult", "⚠️ " + result.message, "error");
      return;
    }

    const text =
`✅ Order Recorded

Remaining Stock: ${result.result.remainingStock}

Customer Message:

${result.confirmation}`;

    showMessage("orderResult", text);
    loadDashboard();
  } catch (err) {
    showMessage("orderResult", "⚠️ Failed to save order.", "error");
  }
}

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
  } catch (err) {
    box.innerHTML = "⚠️ Failed to load stock.";
  }
}

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
      text += `- ${order.product} x${order.qty} = $${order.total} (${order.delivery})\n`;
    });

    showMessage("historyResult", text);
  } catch (err) {
    showMessage("historyResult", "⚠️ Failed to load history.", "error");
  }
}