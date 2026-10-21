/* ---------- Demo data (localStorage) ----------
   Yeh sirf frontend demo ke liye hai. Java backend jodte waqt
   localStorage ki jagah servlet/fetch() se data aayega. */

const DEFAULT_DOCTORS = [
  { id: 1, name: "Dr. Anil Sharma", specialization: "General Physician", fee: 300 },
  { id: 2, name: "Dr. Neha Verma", specialization: "Dentist", fee: 500 },
  { id: 3, name: "Dr. Rajesh Gupta", specialization: "Cardiologist", fee: 800 },
  { id: 4, name: "Dr. Pooja Singh", specialization: "Pediatrician", fee: 400 }
];

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch (e) { return fallback; }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function initData() {
  if (!localStorage.getItem("doctors")) save("doctors", DEFAULT_DOCTORS);
  if (!localStorage.getItem("users")) {
    save("users", [{ id: 1, name: "Admin", email: "admin@clinic.com", phone: "9999999999", password: "admin123", role: "admin" }]);
  }
  if (!localStorage.getItem("appointments")) save("appointments", []);
}

function currentUser() { return load("currentUser", null); }
function nextId(list) { return list.length ? Math.max(...list.map(x => x.id)) + 1 : 1; }
function esc(t) {            // XSS se bachne ke liye
  const d = document.createElement("div");
  d.textContent = t == null ? "" : t;
  return d.innerHTML;
}
function $(id) { return document.getElementById(id); }
function setText(id, text) { const el = $(id); if (el) el.textContent = text; }

/* ---------- Navbar + login guard ---------- */
function renderNav() {
  const user = currentUser();
  const nav = $("nav");
  if (!nav) return;
  let links = "";
  if (user && user.role === "admin") {
    links = '<a href="admin.html">Admin panel</a>';
  } else if (user) {
    links = '<a href="doctors.html">Doctors</a><a href="book.html">Book appointment</a><a href="appointments.html">My appointments</a>';
  }
  nav.innerHTML = '<span class="logo">City Clinic</span><span>' + links +
    (user ? '<a href="#" id="logout">Logout (' + esc(user.name) + ')</a>' : '') + "</span>";
  const lo = $("logout");
  if (lo) lo.addEventListener("click", function (e) {
    e.preventDefault();
    localStorage.removeItem("currentUser");
    location.href = "index.html";
  });
}

function requireLogin(role) {
  const user = currentUser();
  if (!user) { location.href = "index.html"; return null; }
  if (role && user.role !== role) { location.href = user.role === "admin" ? "admin.html" : "doctors.html"; return null; }
  return user;
}

function showMsg(id, text, isError) {
  const el = $(id);
  if (!el) return;
  el.className = isError ? "err" : "msg";
  el.textContent = text;
  el.style.display = text ? "block" : "none";
}

/* ---------- Login ---------- */
function initLogin() {
  const params = new URLSearchParams(location.search);
  if (params.get("msg")) showMsg("flash", params.get("msg"), false);

  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const email = $("email").value.trim().toLowerCase();
    const pass = $("password").value;
    if (!email || !pass) { showMsg("flash", "Enter both email and password.", true); return; }

    const user = load("users", []).find(u => u.email === email && u.password === pass);
    if (!user) { showMsg("flash", "Invalid email or password.", true); return; }
    save("currentUser", user);
    location.href = user.role === "admin" ? "admin.html" : "doctors.html";
  });
}

/* ---------- Register ---------- */
function initRegister() {
  $("registerForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const name = $("name").value.trim();
    const email = $("email").value.trim().toLowerCase();
    const phone = $("phone").value.trim();
    const pass = $("password").value;
    const confirm = $("confirm").value;
    let ok = true;
    ["nameErr", "emailErr", "phoneErr", "passErr", "confirmErr"].forEach(id => setText(id, ""));

    if (name.length < 3) { setText("nameErr", "Enter your full name (at least 3 letters)."); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setText("emailErr", "Enter a valid email address."); ok = false; }
    if (!/^[6-9][0-9]{9}$/.test(phone)) { setText("phoneErr", "Enter a 10-digit mobile number."); ok = false; }
    if (pass.length < 6) { setText("passErr", "Password must be at least 6 characters."); ok = false; }
    if (pass !== confirm) { setText("confirmErr", "Passwords do not match."); ok = false; }
    if (!ok) return;

    const users = load("users", []);
    if (users.some(u => u.email === email)) { setText("emailErr", "This email is already registered."); return; }
    users.push({ id: nextId(users), name, email, phone, password: pass, role: "patient" });
    save("users", users);
    location.href = "index.html?msg=" + encodeURIComponent("Registered successfully. Please log in.");
  });
}

/* ---------- Doctors list ---------- */
function initDoctors() {
  const user = requireLogin("patient");
  if (!user) return;
  setText("welcome", "Welcome, " + user.name);
  const doctors = load("doctors", []);
  $("doctorGrid").innerHTML = doctors.length ? doctors.map(d =>
    '<div class="doc"><strong>' + esc(d.name) + "</strong><span>" + esc(d.specialization) +
    "</span><br>Fee: &#8377;" + esc(d.fee) +
    '<br><a class="btn btn-small" href="book.html?doctor=' + d.id + '">Book now</a></div>'
  ).join("") : "<p>No doctors available right now.</p>";
}

/* ---------- Book appointment ---------- */
function initBook() {
  const user = requireLogin("patient");
  if (!user) return;
  const params = new URLSearchParams(location.search);
  $("doctor_id").innerHTML = load("doctors", []).map(d =>
    '<option value="' + d.id + '"' + (params.get("doctor") == d.id ? " selected" : "") + ">" +
    esc(d.name) + " - " + esc(d.specialization) + " (&#8377;" + esc(d.fee) + ")</option>"
  ).join("");
  $("date").min = new Date().toISOString().split("T")[0];

  $("bookForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const doctorId = Number($("doctor_id").value);
    const date = $("date").value;
    const time = $("time").value;
    const reason = $("reason").value.trim();

    if (!date || !time) { showMsg("flash", "Choose a date and time.", true); return; }
    if (new Date(date + "T" + time) <= new Date()) { showMsg("flash", "Choose a future date and time.", true); return; }
    if (reason.length < 3) { showMsg("flash", "Write a short reason for the visit.", true); return; }

    const list = load("appointments", []);
    const taken = list.some(a => a.doctorId === doctorId && a.date === date && a.time === time &&
                                 (a.status === "Pending" || a.status === "Approved"));
    if (taken) { showMsg("flash", "This slot is already booked. Choose another time.", true); return; }

    list.push({ id: nextId(list), userId: user.id, doctorId, date, time, reason, status: "Pending" });
    save("appointments", list);
    location.href = "appointments.html?msg=" + encodeURIComponent("Appointment booked. Waiting for approval.");
  });
}

/* ---------- My appointments ---------- */
function initMyAppointments() {
  const user = requireLogin("patient");
  if (!user) return;
  const params = new URLSearchParams(location.search);
  if (params.get("msg")) showMsg("flash", params.get("msg"), false);

  function draw() {
    const doctors = load("doctors", []);
    const mine = load("appointments", []).filter(a => a.userId === user.id)
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    $("rows").innerHTML = mine.length ? mine.map(a => {
      const d = doctors.find(x => x.id === a.doctorId) || { name: "(removed)", specialization: "" };
      const canCancel = a.status === "Pending" || a.status === "Approved";
      return "<tr><td>" + esc(d.name) + "<br><small>" + esc(d.specialization) + "</small></td><td>" +
        esc(a.date) + "</td><td>" + esc(a.time) + "</td><td>" + esc(a.reason) +
        '</td><td class="status-' + a.status + '">' + a.status + "</td><td>" +
        (canCancel ? '<button class="btn-small btn-bad" data-cancel="' + a.id + '">Cancel</button>' : "") + "</td></tr>";
    }).join("") : '<tr><td colspan="6">No appointments yet. <a href="book.html">Book your first one</a>.</td></tr>';
  }

  $("rows").addEventListener("click", function (e) {
    const id = Number(e.target.dataset.cancel);
    if (!id || !confirm("Cancel this appointment?")) return;
    const list = load("appointments", []);
    list.find(a => a.id === id).status = "Cancelled";
    save("appointments", list);
    showMsg("flash", "Appointment cancelled.", false);
    draw();
  });
  draw();
}

/* ---------- Admin ---------- */
function initAdmin() {
  if (!requireLogin("admin")) return;

  function draw() {
    const doctors = load("doctors", []);
    const users = load("users", []);
    const appts = load("appointments", [])
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

    $("apptRows").innerHTML = appts.length ? appts.map(a => {
      const d = doctors.find(x => x.id === a.doctorId) || { name: "(removed)" };
      const u = users.find(x => x.id === a.userId) || { name: "(removed)", phone: "" };
      return "<tr><td>" + esc(u.name) + "</td><td>" + esc(u.phone) + "</td><td>" + esc(d.name) + "</td><td>" +
        esc(a.date) + "</td><td>" + esc(a.time) + "</td><td>" + esc(a.reason) +
        '</td><td class="status-' + a.status + '">' + a.status + "</td><td>" +
        (a.status === "Pending"
          ? '<button class="btn-small btn-ok" data-approve="' + a.id + '">Approve</button>' +
            '<button class="btn-small btn-bad" data-reject="' + a.id + '">Reject</button>' : "") + "</td></tr>";
    }).join("") : '<tr><td colspan="8">No appointments yet.</td></tr>';

    $("docRows").innerHTML = doctors.map(d =>
      "<tr><td>" + esc(d.name) + "</td><td>" + esc(d.specialization) + "</td><td>&#8377;" + esc(d.fee) +
      '</td><td><button class="btn-small btn-bad" data-deldoc="' + d.id + '">Delete</button></td></tr>'
    ).join("");
  }

  $("apptRows").addEventListener("click", function (e) {
    const approve = Number(e.target.dataset.approve), reject = Number(e.target.dataset.reject);
    const id = approve || reject;
    if (!id) return;
    const list = load("appointments", []);
    list.find(a => a.id === id).status = approve ? "Approved" : "Rejected";
    save("appointments", list);
    draw();
  });

  $("docRows").addEventListener("click", function (e) {
    const id = Number(e.target.dataset.deldoc);
    if (!id || !confirm("Delete this doctor and their appointments?")) return;
    save("doctors", load("doctors", []).filter(d => d.id !== id));
    save("appointments", load("appointments", []).filter(a => a.doctorId !== id));
    draw();
  });

  $("doctorForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const name = $("dname").value.trim(), spec = $("spec").value.trim(), fee = Number($("fee").value);
    if (!name || !spec || fee < 0 || isNaN(fee)) { showMsg("flash", "Fill all doctor details.", true); return; }
    const doctors = load("doctors", []);
    doctors.push({ id: nextId(doctors), name, specialization: spec, fee });
    save("doctors", doctors);
    e.target.reset();
    showMsg("flash", "Doctor added.", false);
    draw();
  });
  draw();
}

/* ---------- Page start ---------- */
document.addEventListener("DOMContentLoaded", function () {
  initData();
  renderNav();
  const page = document.body.dataset.page;
  const pages = { login: initLogin, register: initRegister, doctors: initDoctors,
                  book: initBook, appointments: initMyAppointments, admin: initAdmin };
  if (pages[page]) pages[page]();
});