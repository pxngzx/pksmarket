/* Phukhieo Marketing - Firebase & Minimal Pink Theme Edition */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// --- 1. ใส่ค่า Config จาก Firebase ของคุณที่นี่ ---
const firebaseConfig = {
  apiKey: "AIzaSyC6IdWx0Jg_lCyva2jRuIAyVLdALFsZzCY",
  authDomain: "market-phukhieo.firebaseapp.com",
  databaseURL: "https://market-phukhieo-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "market-phukhieo",
  storageBucket: "market-phukhieo.firebasestorage.app",
  messagingSenderId: "609968099312",
  appId: "1:609968099312:web:b13681bfa52d64fb721735",
  measurementId: "G-Y7WS5N0D1P"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const ADMIN_PIN = "PKstudent_mk"; // ตั้งรหัสแอดมินตามที่ต้องการ
const placeholder = "assets/images/product-placeholder.svg";
const $ = (selector) => document.querySelector(selector);
const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = value => new Intl.NumberFormat("th-TH").format(Number(value) || 0);

// ฟังก์ชันสร้างการ์ดสินค้า
function productCard(product, owner = false) {
  return `<article class="product-card">
    <a href="product.html?id=${encodeURIComponent(product.id)}"><img class="product-image" src="${product.image || placeholder}" alt="${escapeHTML(product.name)}" onerror="this.src='${placeholder}'"></a>
    <div class="product-card-body"><h3>${escapeHTML(product.name)}</h3><div class="product-price">฿${money(product.price)}</div>
    <div class="product-meta"><span>${escapeHTML(product.contact || "โรงเรียนภูเขียว")}</span><span class="status-pill">${product.status === "approved" ? "อนุมัติแล้ว" : product.status === "rejected" ? "ไม่อนุมัติ" : "รอตรวจสอบ"}</span></div></div>
    ${owner ? `<div class="admin-card-actions"><button class="btn btn-danger" data-delete-id="${escapeHTML(product.id)}">ลบสินค้า</button></div>` : ""}
  </article>`;
}

// ดึงข้อมูลสินค้าจาก Firestore
async function fetchProductsFromFirebase() {
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    const products = [];
    querySnapshot.forEach((docSnap) => {
      products.push({ id: docSnap.id, ...docSnap.data() });
    });
    return products;
  } catch (e) {
    console.error("Error loading products: ", e);
    return [];
  }
}

// ระบบหน้าแรก (Home)
async function setupHome() {
  const target = $("#featured-products");
  if (target) {
    const products = await fetchProductsFromFirebase();
    const approved = products.filter(p => p.status === "approved").slice(0, 3);
    target.innerHTML = approved.length ? approved.map(p => productCard(p)).join("") : `<div class="empty-state">ยังไม่มีสินค้าแนะนำในขณะนี้</div>`;
  }
}

// ระบบค้นหาสินค้า (Search)
async function setupSearch() {
  const target = $("#all-products");
  if (!target) return;
  const input = $("#search-input"), sort = $("#sort-select"), count = $("#results-count");
  
  const allData = await fetchProductsFromFirebase();
  const render = () => {
    let products = allData.filter(p => p.status === "approved");
    const q = (input?.value || "").trim().toLowerCase();
    if (q) products = products.filter(p => `${p.name} ${p.description} ${p.contact}`.toLowerCase().includes(q));
    if (sort?.value === "price-low") products.sort((a,b) => a.price - b.price);
    else if (sort?.value === "price-high") products.sort((a,b) => b.price - a.price);
    else products.sort((a,b) => b.createdAt - a.createdAt);
    if (count) count.textContent = `พบ ${products.length} รายการ`;
    target.innerHTML = products.length ? products.map(p => productCard(p)).join("") : `<div class="empty-state">ไม่พบสินค้า</div>`;
  };
  input?.addEventListener("input", render); sort?.addEventListener("change", render); render();
}

// ระบบรายละเอียดสินค้า (Detail)
async function setupDetail() {
  const target = $("#product-detail");
  if (!target) return;
  const id = new URLSearchParams(location.search).get("id");
  const products = await fetchProductsFromFirebase();
  const product = products.find(p => p.id === id && p.status === "approved");
  if (!product) { target.innerHTML = `<div class="empty-state">ไม่พบสินค้านี้ หรือสินค้ายังไม่ได้รับการอนุมัติ</div>`; return; }
  target.innerHTML = `<img class="detail-image" src="${product.image || placeholder}" alt="${escapeHTML(product.name)}" onerror="this.src='${placeholder}'">
    <div class="detail-info"><span class="eyebrow">PHUKHIEO MARKETPLACE</span><h1>${escapeHTML(product.name)}</h1><div class="detail-price">฿${money(product.price)}</div>
    <p class="detail-description">${escapeHTML(product.description || "ไม่มีรายละเอียดเพิ่มเติม")}</p>
    <div class="detail-contact"><b>ช่องทางติดต่อผู้ขาย</b><p>${escapeHTML(product.contact)}</p><small>โปรดนัดรับและซื้อขายในพื้นที่ปลอดภัย</small></div></div>`;
}

// ระบบเพิ่มสินค้า (Seller)
function setupSeller() {
  const form = $("#product-form");
  if (!form) return;
  const imageInput = $("#product-image"), preview = $("#image-preview");
  let selectedImageBase64 = "";

  imageInput?.addEventListener("change", () => {
    const file = imageInput.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { selectedImageBase64 = reader.result; preview.innerHTML = `<img src="${selectedImageBase64}">`; };
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const btn = $("#submit-product");
    if(btn) { btn.disabled = true; btn.textContent = "กำลังบันทึกข้อมูล..."; }

    try {
      let imageUrl = "";
      if (selectedImageBase64) {
        const imageRef = ref(storage, `products/${Date.now()}_img`);
        await uploadString(imageRef, selectedImageBase64, 'data_url');
        imageUrl = await getDownloadURL(imageRef);
      }

      await addDoc(collection(db, "products"), {
        name: $("#product-name").value.trim(),
        price: Number($("#product-price").value),
        description: $("#product-description").value.trim(),
        contact: $("#product-contact").value.trim(),
        image: imageUrl,
        status: "pending",
        createdAt: Date.now()
      });

      alert("ส่งสินค้าให้ Admin ตรวจสอบเรียบร้อยแล้วค่ะ! 🌸");
      form.reset(); 
      if(preview) preview.innerHTML = "<span>ภาพตัวอย่างจะแสดงที่นี่</span>";
    } catch (e) {
      alert("เกิดข้อผิดพลาด: " + e.message);
    } finally {
      if(btn) { btn.disabled = false; btn.textContent = "ส่งให้ Admin อนุมัติ ↗"; }
    }
  });
}

// ระบบ Admin (อนุมัติ / ปฏิเสธ / ลบสินค้า)
function setupAdmin() {
  const loginForm = $("#admin-login-form"); if (!loginForm) return;
  const loginPanel = $("#admin-login-panel"), dashboard = $("#admin-dashboard");

  const renderAdmin = async () => {
    const products = await fetchProductsFromFirebase();
    const pending = products.filter(p => p.status === "pending");
    const approved = products.filter(p => p.status === "approved");

    const pendingTarget = $("#pending-products");
    const approvedTarget = $("#approved-products");

    if(pendingTarget) {
      pendingTarget.innerHTML = pending.length ? pending.map(p => productCard(p, false)).join("") : `<div class="empty-state">ไม่มีสินค้ารออนุมัติ</div>`;
      pendingTarget.querySelectorAll(".product-card").forEach((card, idx) => {
        const p = pending[idx];
        const actions = document.createElement("div"); actions.className = "admin-card-actions";
        actions.innerHTML = `<button class="btn btn-success" data-approve="${p.id}">อนุมัติ</button><button class="btn btn-danger" data-reject="${p.id}">ไม่อนุมัติ</button>`;
        card.appendChild(actions);
      });
      pendingTarget.querySelectorAll("[data-approve]").forEach(b => b.addEventListener("click", async () => {
        await updateDoc(doc(db, "products", b.dataset.approve), { status: "approved" });
        renderAdmin();
      }));
      pendingTarget.querySelectorAll("[data-reject]").forEach(b => b.addEventListener("click", async () => {
        await updateDoc(doc(db, "products", b.dataset.reject), { status: "rejected" });
        renderAdmin();
      }));
    }

    if(approvedTarget) {
      approvedTarget.innerHTML = approved.length ? approved.map(p => productCard(p, true)).join("") : `<div class="empty-state">ยังไม่มีสินค้าที่อนุมัติ</div>`;
      approvedTarget.querySelectorAll("[data-delete-id]").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (confirm("ต้องการลบสินค้านี้ออกจากระบบใช่ไหมคะ?")) {
            await deleteDoc(doc(db, "products", btn.dataset.deleteId));
            alert("ลบสินค้าเรียบร้อยแล้วค่ะ! 🌸");
            renderAdmin();
          }
        });
      });
    }
  };

  loginForm.addEventListener("submit", event => {
    event.preventDefault();
    const pinInput = $("#admin-pin");
    const msg = $("#admin-login-message");
    if (pinInput && pinInput.value === ADMIN_PIN) {
      alert("เข้าสู่ระบบแอดมินโรงเรียนภูเขียวเรียบร้อยแล้วค่ะ! 🌸");
      if(loginPanel) loginPanel.classList.add("hidden"); 
      if(dashboard) dashboard.classList.remove("hidden"); 
      renderAdmin();
    } else {
      if(msg) msg.textContent = "รหัส PIN ไม่ถูกต้อง";
    }
  });

  const logoutBtn = $("#admin-logout");
  if(logoutBtn) {
    logoutBtn.addEventListener("click", () => { 
      if(dashboard) dashboard.classList.add("hidden"); 
      if(loginPanel) loginPanel.classList.remove("hidden"); 
      const pinInput = $("#admin-pin");
      if(pinInput) pinInput.value = ""; 
    });
  }
}

// เปิดการทำงานทุกระบบเมื่อโหลดหน้าเว็บ
document.addEventListener('DOMContentLoaded', () => {
  setupHome(); 
  setupSearch(); 
  setupDetail(); 
  setupSeller(); 
  setupAdmin();

  // สร้างอนิเมชันดอกไม้ร่วง 🌸
  setInterval(() => {
    const flower = document.createElement('div');
    flower.classList.add('flower-petal');
    flower.innerText = ['🌸', '🌺', '💮', '✨'][Math.floor(Math.random() * 4)];
    flower.style.left = Math.random() * 100 + 'vw';
    flower.style.animationDuration = Math.random() * 3 + 4 + 's';
    flower.style.fontSize = Math.random() * 10 + 16 + 'px';
    document.body.appendChild(flower);
    setTimeout(() => flower.remove(), 7000);
  }, 450);

  // สร้างดาววิบวับประดับหน้าเว็บ ✦
  const mainContainers = document.querySelectorAll('.hero, .container, header, .card');
  mainContainers.forEach(container => {
    container.style.position = 'relative';
    for (let i = 0; i < 3; i++) {
      const star = document.createElement('span');
      star.classList.add('star-sparkle');
      star.innerText = '✦';
      star.style.top = Math.random() * 80 + 10 + '%';
      star.style.left = Math.random() * 90 + 5 + '%';
      star.style.animationDelay = Math.random() * 2 + 's';
      container.appendChild(star);
    }
  });
});

// ฟังก์ชันสำหรับดึงข้อมูลสินค้าที่อนุมัติแล้วจาก Google Sheets
async function loadProductsFromGoogleSheets() {
  // แทนที่ 'YOUR_SHEET_BEST_API_URL' ด้วยลิงก์ API ที่ได้มาจาก Sheet.best
  const API_URL = "https://api.sheetbest.com/sheets/07547328-0813-45bf-83d3-d0befe94174f"; 
  
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    
    // กรองเฉพาะสินค้าที่มี status เป็น "approved"
    const approvedProducts = data.filter(item => item.status === "approved");
    
    // นำข้อมูลไปแสดงผลใส่ในหน้าเว็บ (HTML)
    renderProductsToWeb(approvedProducts);
    
  } catch (error) {
    console.error("ไม่สามารถโหลดข้อมูลจาก Google Sheets ได้:", error);
  }
}

// เรียกใช้งานฟังก์ชันเมื่อเปิดหน้าเว็บ
document.addEventListener("DOMContentLoaded", () => {
  loadProductsFromGoogleSheets();
});