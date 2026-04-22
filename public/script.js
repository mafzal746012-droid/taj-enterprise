let cart = [];
let paymentDone = false;
let currentCategory = "all";
let products = [];

const productContainer = document.getElementById("products");
const cartContainer = document.getElementById("cart");
const emptyCartMsg = document.getElementById("emptyCartMsg");

async function loadProducts() {
  const res = await fetch('/api/products');
  products = await res.json();
  displayProducts();
}

function displayProducts() {
  if (!productContainer) return;
  productContainer.innerHTML = "";
  let filtered = currentCategory === "all" ? products : products.filter(p => p.category === currentCategory);
  const searchTerm = document.getElementById("search").value.toLowerCase();
  filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm));

  if (filtered.length === 0) {
    productContainer.innerHTML = '<div class="no-results">No products found</div>';
    return;
  }

  filtered.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";
    const imgSrc = p.image || "images/Milk2.jpg";
    const isOutOfStock = p.stock === 0;
    card.innerHTML = `
      <img src="${imgSrc}" alt="${p.name}" onerror="this.src='images/Milk2.jpg'">
      <h4>${p.name}</h4>
      <div class="price">₹${p.price}</div>
      ${isOutOfStock ? '<div class="out-of-stock">Out of Stock</div>' : `<button class="add-btn" onclick="addToCart(${p.id})">Add to Cart</button>`}
    `;
    productContainer.appendChild(card);
  });
}

window.addToCart = function(productId) {
  const product = products.find(p => p.id === productId);
  if (!product || product.stock === 0) return;
  
  const existing = cart.find(i => i.id === productId);
  let newQty = existing ? existing.qty + 1 : 1;
  
  if (newQty > product.stock) {
    alert(`Only ${product.stock} left in stock. Cannot add more.`);
    return;
  }
  
  if (existing) existing.qty = newQty;
  else cart.push({ ...product, qty: 1 });
  
  updateCartList();
  updateCartUI();
  updateDeliveryPreview();
};

function updateCartUI() {
  let total = 0;
  let count = 0;
  cart.forEach(item => {
    total += item.price * item.qty;
    count += item.qty;
  });
  if (document.getElementById("cartSummary")) document.getElementById("cartSummary").innerText = `${count} items | ₹${total}`;
  if (document.getElementById("floatingCartSummary")) document.getElementById("floatingCartSummary").innerText = `${count} items | ₹${total}`;
  if (document.getElementById("cartTotalDisplay")) document.getElementById("cartTotalDisplay").innerHTML = `₹${total}`;
  if (document.getElementById("cartCountBadge")) document.getElementById("cartCountBadge").innerText = count;
  return { total, count };
}

function updateCartList() {
  if (!cartContainer) return;
  cartContainer.innerHTML = "";
  if (cart.length === 0) {
    if (emptyCartMsg) emptyCartMsg.style.display = "block";
    return;
  }
  if (emptyCartMsg) emptyCartMsg.style.display = "none";
  cart.forEach((item, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <b>${item.name}</b><br>
      ₹${item.price} x ${item.qty} = <b>₹${item.price * item.qty}</b><br>
      <button onclick="changeQty(${idx}, 1)">+</button>
      <button onclick="changeQty(${idx}, -1)">-</button>
      <hr>
    `;
    cartContainer.appendChild(li);
  });
}

window.changeQty = function(index, delta) {
  const item = cart[index];
  const product = products.find(p => p.id === item.id);
  if (!product) return;
  
  let newQty = item.qty + delta;
  if (newQty <= 0) {
    cart.splice(index, 1);
  } else if (newQty > product.stock) {
    alert(`Only ${product.stock} left in stock. Cannot increase quantity.`);
    return;
  } else {
    item.qty = newQty;
  }
  
  updateCartList();
  updateCartUI();
  updateDeliveryPreview();
};

function updateDeliveryPreview() {
  const slot = getDeliverySlot();
  if (document.getElementById("deliveryPreview")) document.getElementById("deliveryPreview").innerText = slot;
}

function getDeliverySlot() {
  const hour = new Date().getHours();
  if (hour < 15) return "Tomorrow Morning (7–10 AM)";
  if (hour < 22) return "Tomorrow Evening (4–7 PM)";
  return "Day After Tomorrow Morning";
}

window.confirmPayment = function() {
  paymentDone = true;
  const statusDiv = document.getElementById("paymentStatus");
  if (statusDiv) {
    statusDiv.innerHTML = '<span style="color:#10b981;">✓ Payment confirmed</span>';
    setTimeout(() => { statusDiv.innerHTML = ""; }, 3000);
  }
  alert("Payment recorded. Please complete the order.");
};

window.placeOrder = async function() {
  if (cart.length === 0) return alert("Your cart is empty.");
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (total < 200) return alert("Minimum order amount is ₹200.");

  const pincode = document.getElementById("pincode").value.trim();
  const allowed = ["700024", "700023", "700026"];
  if (!allowed.includes(pincode)) return alert("Delivery only within 1KM (pincodes: 700024, 700023, 700026).");

  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  if (!name || !phone || !address || !pincode) return alert("Please fill all required delivery details.");

  if (!document.getElementById("terms").checked) return alert("Accept terms.");
  if (!paymentDone) return alert("Complete payment first.");

  const slot = getDeliverySlot();
  const orderData = {
    customer_name: name,
    customer_phone: phone,
    address: address,
    city: document.getElementById("city").value,
    pincode: pincode,
    landmark: document.getElementById("landmark").value,
    items: cart.map(item => ({ id: item.id, name: item.name, qty: item.qty, price: item.price })),
    total: total,
    delivery_slot: slot
  };

  try {
    const response = await fetch('/api/place-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    const result = await response.json();
    if (result.success) {
      const orderNumber = result.orderNumber;
      document.getElementById("successModal").style.display = "flex";
      document.getElementById("deliverySlot").innerText = slot;
      
      let message = `*New Order #${orderNumber}*%0A`;
      message += `Customer: ${name}%0APhone: ${phone}%0AAddress: ${address}, ${orderData.city}, ${pincode}%0A`;
      message += `Items:%0A`;
      cart.forEach(item => { message += `${item.name} x${item.qty} = ₹${item.price * item.qty}%0A`; });
      message += `Total: ₹${total}%0ADelivery: ${slot}`;
      window.open(`https://wa.me/917003761094?text=${encodeURIComponent(message)}`);
      
      cart = [];
      paymentDone = false;
      updateCartList();
      updateCartUI();
      loadProducts(); // refresh stock display
    } else {
      alert(`Order failed: ${result.error || "Unknown error"}`);
    }
  } catch (err) {
    alert("Server error. Please try again.");
    console.error(err);
  }
};

window.filterCategory = function(cat) {
  currentCategory = cat;
  document.querySelectorAll(".cat-btn").forEach(btn => btn.classList.remove("active"));
  if (event && event.target) event.target.closest(".cat-btn").classList.add("active");
  displayProducts();
};

window.searchProducts = function() {
  displayProducts();
};

window.scrollToCheckout = function() {
  document.getElementById("checkoutSection").scrollIntoView({ behavior: "smooth" });
  if (window.innerWidth <= 1024) window.toggleCartSidebar(false);
};

window.toggleCartSidebar = function(forceOpen) {
  const sidebar = document.getElementById("cartSidebar");
  if (!sidebar) return;
  if (forceOpen === true) sidebar.classList.add("open");
  else if (forceOpen === false) sidebar.classList.remove("open");
  else sidebar.classList.toggle("open");
};

window.closeSuccessModal = function() {
  document.getElementById("successModal").style.display = "none";
};

loadProducts();
updateCartUI();
updateDeliveryPreview();
updateCartList();