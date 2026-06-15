// Service Worker — Mock API for Kaffeerösterei Kreuzau test site
// Intercepts /api/* requests so the static GitHub Pages site behaves like a real server.
// Also handles /{lang}/api/* paths when served through the translation proxy.

const MOCK_PRODUCTS = [
  { id:"PROD-001", name:"Espresso Classico", category:"Espresso", price:"12.90", currency:"EUR", weight:"250g", origin:"Brazil / Colombia blend", roast:"Dark", description:"Rich, full-bodied dark roast with notes of dark chocolate and caramel. Perfect for espresso machines.", rating:4.8, reviews:214, sku:"ESP-CLS-250", image:"https://picsum.photos/id/30/400/300", inStock:true },
  { id:"PROD-002", name:"Ethiopian Yirgacheffe", category:"Filter", price:"16.50", currency:"EUR", weight:"250g", origin:"Ethiopia, Yirgacheffe region", roast:"Light", description:"Delicate floral notes with bright acidity and hints of blueberry and jasmine. Ideal for pour-over.", rating:4.9, reviews:87, sku:"ETH-YIR-250", image:"https://picsum.photos/id/225/400/300", inStock:true },
  { id:"PROD-003", name:"Colombia Huila Decaf", category:"Decaf", price:"14.90", currency:"EUR", weight:"250g", origin:"Colombia, Huila region", roast:"Medium", description:"Swiss Water Process decaf with smooth caramel sweetness and no compromise on flavour.", rating:4.5, reviews:52, sku:"COL-DEC-250", image:"https://picsum.photos/id/431/400/300", inStock:false },
  { id:"PROD-004", name:"Morning Blend", category:"Blend", price:"11.90", currency:"EUR", weight:"500g", origin:"Brazil / Guatemala", roast:"Medium", description:"Our best-selling everyday blend. Balanced, smooth, and approachable — a perfect morning cup.", rating:4.7, reviews:431, sku:"BLD-MRN-500", image:"https://picsum.photos/id/766/400/300", inStock:true }
];

const MOCK_ORDERS = [
  { id:"ORD-78421", date:"2025-06-01", status:"Delivered", total:"34.70", currency:"EUR", trackingCode:"DHL-984712", items:[{ name:"Espresso Classico 250g", qty:2, price:"12.90" }, { name:"Morning Blend 500g", qty:1, price:"11.90" }] },
  { id:"ORD-74983", date:"2025-05-12", status:"Delivered", total:"16.50", currency:"EUR", trackingCode:"DHL-874512", items:[{ name:"Ethiopian Yirgacheffe 250g", qty:1, price:"16.50" }] },
  { id:"ORD-71205", date:"2025-04-28", status:"Delivered", total:"48.30", currency:"EUR", trackingCode:"DHL-762190", items:[{ name:"Espresso Classico 250g", qty:2, price:"12.90" }, { name:"Colombia Huila Decaf 250g", qty:1, price:"14.90" }] }
];

const MOCK_PROFILE = {
  id:"USR-001", name:"Demo User", email:"demo@example.com",
  memberSince:"2023-03-15", loyaltyPoints:1240,
  address:{ street:"Musterstraße 5", city:"Köln", zip:"50667", country:"DE" },
  preferences:{ newsletter:true, smsAlerts:false, preferredRoast:"Dark", grindSize:"Espresso" },
  subscription:{ active:true, plan:"Monthly 500g", nextDelivery:"2025-07-01", price:"22.90" }
};

let mockCart = {
  items:[{ id:"PROD-001", name:"Espresso Classico", price:"12.90", qty:2, image:"https://picsum.photos/id/30/80/80" }],
  subtotal:"25.80", shipping:"0.00", total:"25.80", currency:"EUR", freeShippingThreshold:"40.00"
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Strip optional /{lang}/ prefix so proxy subdirectory mode works too
  const path = url.pathname.replace(/^\/[a-z]{2}(-[a-z]{2})?(?=\/api\/)/, '');

  if (path === '/api/auth/login'    && e.request.method === 'POST') { e.respondWith(handleLogin(e.request)); return; }
  if (path === '/api/auth/register' && e.request.method === 'POST') { e.respondWith(handleRegister(e.request)); return; }
  if (path === '/api/products')  { e.respondWith(ok({ products: MOCK_PRODUCTS })); return; }
  if (path === '/api/orders')    { e.respondWith(ok({ orders: MOCK_ORDERS })); return; }
  if (path === '/api/profile')   { e.respondWith(ok(MOCK_PROFILE)); return; }
  if (path === '/api/cart'       && e.request.method === 'GET')  { e.respondWith(ok(mockCart)); return; }
  if (path === '/api/cart/add'   && e.request.method === 'POST') { e.respondWith(handleCartAdd(e.request)); return; }
  if (path === '/api/cart/remove'&& e.request.method === 'POST') { e.respondWith(handleCartRemove(e.request)); return; }
  if (path === '/api/checkout'   && e.request.method === 'POST') { e.respondWith(handleCheckout(e.request)); return; }
  if (path === '/api/contact'    && e.request.method === 'POST') { e.respondWith(ok({ success:true, message:'Your message has been received. We will reply within 24 hours.' })); return; }
  if (path === '/api/subscribe'  && e.request.method === 'POST') { e.respondWith(ok({ success:true, message:'You have been successfully subscribed to our newsletter.' })); return; }
});

function ok(data, status=200) {
  return Promise.resolve(new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' }
  }));
}

async function readBody(req) {
  const ct = req.headers.get('Content-Type') || '';
  const text = await req.text();
  if (ct.includes('application/json')) { try { return JSON.parse(text); } catch(e) { return {}; } }
  const p = new URLSearchParams(text);
  const out = {};
  p.forEach((v,k) => { out[k]=v; });
  return out;
}

async function handleLogin(req) {
  const body = await readBody(req);
  const USERS = [
    { email:'demo@example.com',  password:'demo1234',  name:'Demo User',   id:'USR-001', loyaltyPoints:1240 },
    { email:'test@kreuzau.de',   password:'coffee123', name:'Hans Müller', id:'USR-002', loyaltyPoints:320 }
  ];
  const user = USERS.find(u => u.email === (body.email||'').toLowerCase() && u.password === body.password);
  if (user) return ok({ success:true, user:{ name:user.name, email:user.email, id:user.id, loyaltyPoints:user.loyaltyPoints }, token:'mock-jwt-'+Date.now() });
  return ok({ success:false, error:'Invalid email address or password.' }, 401);
}

async function handleRegister(req) {
  const body = await readBody(req);
  if (!body.email || !body.password) return ok({ success:false, error:'Email and password are required.' }, 422);
  if ((body.password||'').length < 8) return ok({ success:false, error:'Password must be at least 8 characters long.' }, 422);
  return ok({ success:true, user:{ name:body.name||'New User', email:body.email, id:'USR-NEW-'+Date.now() }, message:'Account created successfully. Welcome to Kaffeerösterei Kreuzau!' });
}

async function handleCartAdd(req) {
  const body = await readBody(req);
  const prod = MOCK_PRODUCTS.find(p => p.id === body.productId);
  if (!prod) return ok({ success:false, error:'Product not found.' }, 404);
  const existing = mockCart.items.find(i => i.id === body.productId);
  if (existing) { existing.qty += parseInt(body.qty||1,10); }
  else { mockCart.items.push({ id:prod.id, name:prod.name, price:prod.price, qty:parseInt(body.qty||1,10), image:prod.image }); }
  recalcCart();
  return ok({ success:true, cart:mockCart });
}

async function handleCartRemove(req) {
  const body = await readBody(req);
  mockCart.items = mockCart.items.filter(i => i.id !== body.productId);
  recalcCart();
  return ok({ success:true, cart:mockCart });
}

function recalcCart() {
  const sub = mockCart.items.reduce((s,i) => s + parseFloat(i.price)*i.qty, 0);
  mockCart.subtotal = sub.toFixed(2);
  mockCart.shipping = sub >= 40 ? '0.00' : '4.90';
  mockCart.total = (sub + parseFloat(mockCart.shipping)).toFixed(2);
}

async function handleCheckout(req) {
  const body = await readBody(req);
  if (!body.email || !body.firstName || !body.lastName) return ok({ success:false, error:'Please fill in all required fields.' }, 422);
  const orderId = 'ORD-' + Math.floor(80000+Math.random()*9999);
  mockCart = { items:[], subtotal:'0.00', shipping:'0.00', total:'0.00', currency:'EUR', freeShippingThreshold:'40.00' };
  return ok({ success:true, orderId, estimatedDelivery:'3–5 business days', message:'Thank you for your order! You will receive a confirmation email shortly.' });
}
