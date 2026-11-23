import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase as getDatabaseBaru, ref as rRefBaru, get as rGetBaru, set as setBaru, remove as hapusBaru } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup,
  signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  deleteField, query, where, limit, orderBy, serverTimestamp, increment,
  getCountFromServer, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDPn1GeGFPzLKrybV1AoXnQOzzcvbeyeDQ",
  authDomain: "raps-star.firebaseapp.com",
  projectId: "raps-star",
  storageBucket: "raps-star.firebasestorage.app",
  messagingSenderId: "109949114150",
  appId: "1:109949114150:android:83625d507cff44c70c53e7",
  databaseURL: "https://raps-star-default-rtdb.asia-southeast1.firebasedatabase.app"
};
const PEMILIK = "fedli840@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdbBaru = getDatabaseBaru(app);

/* ================= util ================= */
const $ = (id) => document.getElementById(id);
const aman = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const angka = (n) => Number(n || 0).toLocaleString("id-ID");
const tulis = (id, teks, jenis = "") => { const e = $(id); if (e) { e.className = "pesan " + jenis; e.textContent = teks; } };
const galat = (e) => {
  const k = e?.code || "";
  if (k.includes("permission-denied")) return "Ditolak aturan Firestore. Pastikan aturan terbaru sudah dipublikasikan.";
  if (k.includes("invalid-credential") || k.includes("wrong-password") || k.includes("user-not-found")) return "Email atau sandi salah.";
  if (k.includes("popup-closed")) return "Jendela Google tertutup. Coba lagi.";
  if (k.includes("unauthorized-domain")) return "Domain ini belum diizinkan di Firebase Authentication.";
  return e?.message || "Terjadi kesalahan.";
};
const ponsel = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

/** Terima ID angka, UID, atau email lalu kembalikan UID. */
async function uidDari(nilai) {
  const t = String(nilai || "").trim();
  if (!t) throw new Error("Isi ID atau UID user dulu.");
  if (t.includes("@")) {
    const q = await getDocs(query(collection(db, "users"), where("email", "==", t), limit(1)));
    if (!q.empty) return q.docs[0].id;
    throw new Error("Email itu belum punya data user.");
  }
  if (!/^\d+$/.test(t)) return t;                        // sudah UID
  // 1) Sumber utama: Realtime Database ids/i/{ID}/uid (ditulis aplikasi saat akun dibuat).
  try {
    const r = await rGetBaru(rRefBaru(rtdbBaru, "ids/i/" + t + "/uid"));
    if (r.exists() && r.val()) return String(r.val());
  } catch (e) { }
  try {
    const r2 = await rGetBaru(rRefBaru(rtdbBaru, "ids/i/" + t));
    if (r2.exists()) { const v = r2.val(); const u = typeof v === "string" ? v : (v && v.uid); if (u) return String(u); }
  } catch (e) { }
  const s = await getDoc(doc(db, "userIds", t));
  if (s.exists() && s.data().uid) return s.data().uid;
  for (const medan of ["userId", "uid"]) {
    const q = await getDocs(query(collection(db, "userIds"), where(medan, "==", t), limit(1)));
    if (!q.empty && q.docs[0].data().uid) return q.docs[0].data().uid;
  }
  const q2 = await getDocs(query(collection(db, "users"), where("userId", "==", t), limit(1)));
  if (!q2.empty) return q2.docs[0].id;
  throw new Error("ID " + t + " tidak ditemukan di Realtime Database maupun Firestore. Pakai UID panjang atau email akun itu.");
}

const profil = async (uid) => {
  const s = await getDoc(doc(db, "users", uid));
  return s.exists() ? s.data() : {};
};
const dompet = async (uid) => {
  const s = await getDoc(doc(db, "wallets", uid));
  return s.exists() ? s.data() : {};
};
const staf = async (uid) => {
  const s = await getDoc(doc(db, "stafApk", uid));
  return s.exists() ? s.data() : { uid, peran: {}, stok: {} };
};
const namaUser = async (uid) => {
  try { const p = await profil(uid); return p.name || p.nama || uid.slice(0, 8); } catch { return uid.slice(0, 8); }
};

/* ================= sesi ================= */
onAuthStateChanged(auth, async (u) => {
  if (!u) { $("app").style.display = "none"; $("masuk").style.display = "grid"; return; }
  const boleh = await bolehPanel(u.email || "");
  if (!boleh) {
    await signOut(auth);
    tulis("pesanMasuk", "Akun " + u.email + " tidak terdaftar sebagai admin panel.", "");
    return;
  }
  $("masuk").style.display = "none";
  $("app").style.display = "block";
  $("emailPanel").textContent = u.email || "";
  $("jejakEmail").textContent = u.email || "";
  bukaHalaman("dashboard");
});

async function bolehPanel(email) {
  if (email.toLowerCase() === PEMILIK.toLowerCase()) return true;
  try {
    const s = await getDoc(doc(db, "panelAdmins", email.toLowerCase()));
    return s.exists() && s.data().aktif !== false;
  } catch { return false; }
}

$("masukEmail").onclick = async () => {
  tulis("pesanMasuk", "Memeriksa…", "info");
  try {
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("sandi").value);
  } catch (e) { tulis("pesanMasuk", galat(e), ""); }
};

$("masukGoogle").onclick = async () => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  tulis("pesanMasuk", "Membuka Google…", "info");
  try {
    if (ponsel) { await signInWithRedirect(auth, p); return; }
    await signInWithPopup(auth, p);
  } catch (e) {
    if (/popup-closed|popup-blocked|cancelled-popup/.test(e?.code || "")) { await signInWithRedirect(auth, p); return; }
    tulis("pesanMasuk", galat(e), "");
  }
};
getRedirectResult(auth).catch((e) => tulis("pesanMasuk", galat(e), ""));
$("keluar").onclick = () => signOut(auth);

/* ================= navigasi ================= */
const JUDUL = {
  dashboard: "Dashboard", user: "User", manager: "Manager", admin: "Admin", seller: "Coin Seller",
  frame: "Frame", banner: "Banner", vip: "VIP", game: "Game", coin: "Coin", blokir: "Blokir", diagnosa: "Diagnosa", rilis: "Rilis", vip19: "VIP 1-9", gift: "Gift", tag: "Tag Official",
  medali: "Medali", badge: "VIP Badge", idcantik: "ID Cantik", cashback: "Cashback"
};
const HAL = {};
let halAktif = "dashboard";

document.querySelectorAll(".menu[data-hal]").forEach((b) => {
  b.onclick = () => bukaHalaman(b.dataset.hal);
});
$("hamb").onclick = () => { $("sisi").classList.add("buka"); $("tirai").classList.add("buka"); };
$("tirai").onclick = () => { $("sisi").classList.remove("buka"); $("tirai").classList.remove("buka"); };

async function bukaHalaman(nama) {
  halAktif = nama;
  document.querySelectorAll(".menu[data-hal]").forEach((b) => b.classList.toggle("aktif", b.dataset.hal === nama));
  $("jejakHal").textContent = JUDUL[nama] || nama;
  $("sisi").classList.remove("buka");
  $("tirai").classList.remove("buka");
  $("isi").innerHTML = '<div class="kosong">Memuat…</div>';
  try { await (HAL[nama] || HAL.dashboard)(); }
  catch (e) { $("isi").innerHTML = '<div class="kosong">' + aman(galat(e)) + "</div>"; }
}

/* ================= modal ================= */
let simpanModal = null;
let modalUid = "";
function modal(judul, isiHtml, saatSimpan, labelSimpan = "Simpan") {
  $("modalJudul").textContent = judul;
  $("modalIsi").innerHTML = isiHtml + (modalUid ? `<div class="catatan" style="margin-top:12px">Tujuan UID: <b style="word-break:break-all">${modalUid}</b><br>Cocokkan dengan UID akun di HP (Pengaturan di aplikasi).</div>` : "");
  $("pesanModal").textContent = "";
  $("modalSimpan").textContent = labelSimpan;
  simpanModal = saatSimpan;
  $("modal").classList.add("buka");
}
const tutupModal = () => { $("modal").classList.remove("buka"); simpanModal = null; };
$("modalTutup").onclick = tutupModal;
$("modalBatal").onclick = tutupModal;
$("modalSimpan").onclick = async () => {
  if (!simpanModal) return;
  tulis("pesanModal", "Menyimpan…", "info");
  try { await simpanModal(); tutupModal(); bukaHalaman(halAktif); }
  catch (e) { tulis("pesanModal", galat(e), ""); }
};

/* ================= HALAMAN: dashboard ================= */
HAL.dashboard = async () => {
  const hitung = async (nama) => { try { return (await getCountFromServer(collection(db, nama))).data().count; } catch { return 0; } };
  const [users, stafN, sellerN, frameN, bannerN] = await Promise.all(
    ["users", "stafApk", "sellers", "frames", "banners"].map(hitung)
  );
  const baru = await getDocs(query(collection(db, "users"), limit(12)));
  const baris = baru.docs.map((d) => {
    const p = d.data();
    return `<tr><td>${aman(p.userId || "-")}</td><td>${aman(p.name || p.nama || "-")}</td>
      <td><span class="lencana">${aman((d.id || "").slice(0, 10))}</span></td>
      <td>${aman(p.countryCode || "-")}</td></tr>`;
  }).join("") || '<tr><td colspan="4" class="kosong">Belum ada user</td></tr>';

  $("isi").innerHTML = `
    <h1>Dashboard</h1>
    <div class="angka">
      <div class="kartu"><b>${angka(users)}</b><span>User terdaftar</span></div>
      <div class="kartu"><b>${angka(stafN)}</b><span>Staf panel</span></div>
      <div class="kartu"><b>${angka(sellerN)}</b><span>Coin seller</span></div>
      <div class="kartu"><b>${angka(frameN)}</b><span>Frame</span></div>
      <div class="kartu"><b>${angka(bannerN)}</b><span>Banner</span></div>
    </div>
    <h1>User terbaru</h1>
    <div class="kartu tbltabel">
      <table><thead><tr><th>ID</th><th>Nama</th><th>UID</th><th>Negara</th></tr></thead>
      <tbody>${baris}</tbody></table>
    </div>`;
};

/* ================= HALAMAN: user ================= */
function kartuCariUser() {
  return `<div class="kartu">
    <div class="baris"><input id="cariUser" placeholder="ID angka, UID, atau email" style="max-width:340px">
    <button class="tbl" id="tombolCari">Cari user</button></div>
    <div id="hasilCari"></div>
  </div>`;
}

async function tampilUser(uid) {
  const [p, w, s] = await Promise.all([profil(uid), dompet(uid), staf(uid)]);
  const ban = await getDoc(doc(db, "banned", uid));
  const peran = Object.entries(s.peran || {}).filter(([, v]) => v && v.aktif !== false).map(([k]) => k);
  const vipAktif = Number(w.vip || 0) > 0 && Number(w.vipUntil || 0) > Date.now();
  $("hasilCari").innerHTML = `
    <div class="kartu" style="margin-top:12px">
      <b style="font-size:16px">${aman(p.name || p.nama || "Tanpa nama")}</b>
      <div class="catatan">UID ${aman(uid)} · ID ${aman(p.userId || "-")} · ${aman(p.email || "-")}</div>
      <div class="baris" style="margin-top:10px">
        <span class="lencana kuning">${angka(w.coins)} coin</span>
        <span class="lencana">${angka(w.diamonds)} berlian</span>
        <span class="lencana ${vipAktif ? "hijau" : ""}">VIP ${angka(w.vip)}${vipAktif ? " aktif" : ""}</span>
        ${peran.map((r) => `<span class="lencana hijau">${aman(r)}</span>`).join("")}
        ${ban.exists() ? '<span class="lencana merah">diblokir</span>' : ""}
      </div>
      <div class="baris" style="margin-top:12px">
        <button class="tbl kecil" id="uCoin">Kirim coin</button>
        <button class="tbl kecil biru" id="uVip">Kirim VIP</button>
        <button class="tbl kecil biru" id="uPanel">Kirim panel</button>
        <button class="tbl kecil ${ban.exists() ? "abu" : "merah"}" id="uBan">${ban.exists() ? "Buka blokir" : "Blokir user"}</button>
      </div>
    </div>`;

  modalUid = uid;
  $("uCoin").onclick = () => modal("Kirim coin", `
    <label>Jumlah coin</label><input id="mCoin" type="number" value="1000">
    <div class="catatan">Saldo ditambah ke dompet user ini.</div>`,
    async () => {
      const n = Number($("mCoin").value || 0);
      if (n === 0) throw new Error("Jumlah coin belum diisi.");
      await setDoc(doc(db, "wallets", uid), { coins: increment(n), diperbarui: serverTimestamp() }, { merge: true });
      const cek = await getDoc(doc(db, "wallets", uid));
      alert("Coin terkirim.\nUID: " + uid + "\nSaldo tersimpan sekarang: " + Number(cek.data()?.coins || 0).toLocaleString("id-ID") + " coin");
    });

  $("uVip").onclick = () => modal("Kirim VIP", `
    <div class="dua"><div><label>Tier VIP</label><input id="mVip" type="number" min="1" max="9" value="1"></div>
    <div><label>Hari</label><input id="mHari" type="number" min="1" value="30"></div></div>`,
    async () => {
      const tier = Math.max(1, Number($("mVip").value || 1));
      const hari = Math.max(1, Number($("mHari").value || 30));
      await setDoc(doc(db, "wallets", uid), {
        vip: tier, vipUntil: Date.now() + hari * 86400000, diperbarui: serverTimestamp()
      }, { merge: true });
    });

  $("uPanel").onclick = () => modal("Kirim panel", `
    <label>Peran</label>
    <select id="mPeran"><option value="manager">Manager</option><option value="admin">Admin</option></select>
    <label>Stok coin (opsional)</label><input id="mStok" type="number" value="0">`,
    async () => {
      const peranBaru = $("mPeran").value;
      const stokCoin = Number($("mStok").value || 0);
      const d = await staf(uid);
      const map = { ...(d.peran || {}) };
      map[peranBaru] = { aktif: true, coins: stokCoin };
      await setDoc(doc(db, "stafApk", uid), {
        uid, peran: map, aktif: true, diperbarui: serverTimestamp()
      }, { merge: true });
    });

  $("uBan").onclick = async () => {
    try {
      if (ban.exists()) await deleteDoc(doc(db, "banned", uid));
      else await setDoc(doc(db, "banned", uid), { reason: "Diblokir dari panel", oleh: auth.currentUser?.email || "", waktu: serverTimestamp() });
      await tampilUser(uid);
    } catch (e) { alert(galat(e)); }
  };
}

HAL.user = async () => {
  $("isi").innerHTML = `<h1>User</h1>` + kartuCariUser();
  $("tombolCari").onclick = async () => {
    $("hasilCari").innerHTML = '<div class="catatan">Mencari…</div>';
    try { await tampilUser(await uidDari($("cariUser").value)); }
    catch (e) { $("hasilCari").innerHTML = '<div class="pesan">' + aman(galat(e)) + "</div>"; }
  };
  $("cariUser").addEventListener("keydown", (e) => { if (e.key === "Enter") $("tombolCari").click(); });
};

/* ================= HALAMAN: staf (manager/admin) ================= */
async function halamanStaf(peran, judul) {
  const snap = await getDocs(collection(db, "stafApk"));
  const baris = [];
  for (const d of snap.docs) {
    const data = d.data();
    const v = data.peran?.[peran];
    if (!v || v.aktif === false) continue;
    baris.push(`<tr><td>${aman(await namaUser(d.id))}</td>
      <td><span class="lencana">${aman(d.id.slice(0, 10))}</span></td>
      <td>${angka(v.coins)}</td>
      <td><button class="tbl kecil merah" data-cabut="${aman(d.id)}">Cabut</button></td></tr>`);
  }
  $("isi").innerHTML = `
    <h1>${judul}</h1>
    <div class="baris"><button class="tbl" id="tambahStaf">+ New ${judul}</button></div>
    <div class="kartu tbltabel">
      <table><thead><tr><th>Nama</th><th>UID</th><th>Stok coin</th><th></th></tr></thead>
      <tbody>${baris.join("") || '<tr><td colspan="4" class="kosong">Belum ada</td></tr>'}</tbody></table>
    </div>`;

  $("tambahStaf").onclick = () => modal("New " + judul, `
    <label>ID atau UID user</label><input id="sUid" placeholder="10010227">
    <label>Stok coin</label><input id="sCoin" type="number" value="0">`,
    async () => {
      const uid = await uidDari($("sUid").value);
      const d = await staf(uid);
      const map = { ...(d.peran || {}) };
      map[peran] = { aktif: true, coins: Number($("sCoin").value || 0) };
      await setDoc(doc(db, "stafApk", uid), { uid, peran: map, aktif: true, diperbarui: serverTimestamp() }, { merge: true });
    });

  document.querySelectorAll("[data-cabut]").forEach((b) => {
    b.onclick = async () => {
      const uid = b.dataset.cabut;
      try {
        const d = await staf(uid);
        const map = { ...(d.peran || {}) };
        delete map[peran];
        const sisa = Object.values(map).some((x) => x && x.aktif !== false);
        await setDoc(doc(db, "stafApk", uid), { peran: map, aktif: sisa, diperbarui: serverTimestamp() }, { merge: true });
        bukaHalaman(halAktif);
      } catch (e) { alert(galat(e)); }
    };
  });
}
HAL.manager = () => halamanStaf("manager", "Manager");
HAL.admin = () => halamanStaf("admin", "Admin");

/* ================= HALAMAN: coin seller ================= */
HAL.seller = async () => {
  const snap = await getDocs(collection(db, "sellers"));
  const baris = snap.docs.map((d) => {
    const s = d.data();
    return `<tr><td>${aman(s.store || "-")}</td><td><span class="lencana">${aman(d.id.slice(0, 10))}</span></td>
      <td>${angka(s.stock)}</td><td>${aman(s.wa || "-")}</td>
      <td><span class="lencana ${s.active === false ? "merah" : "hijau"}">${s.active === false ? "nonaktif" : "aktif"}</span></td>
      <td><button class="tbl kecil biru" data-isi="${aman(d.id)}">Isi stok</button>
      <button class="tbl kecil merah" data-hapus="${aman(d.id)}">Hapus</button></td></tr>`;
  }).join("") || '<tr><td colspan="6" class="kosong">Belum ada seller</td></tr>';

  const minta = await getDocs(query(collection(db, "sellerKirim"), where("status", "==", "menunggu"), limit(20)));
  const barisMinta = minta.docs.map((d) => {
    const r = d.data();
    return `<tr><td><span class="lencana">${aman(String(r.dari || "").slice(0, 10))}</span></td>
      <td><span class="lencana">${aman(String(r.ke || "").slice(0, 10))}</span></td>
      <td>${angka(r.coins)}</td>
      <td><button class="tbl kecil" data-acc="${aman(d.id)}">Setujui</button>
      <button class="tbl kecil abu" data-tolak="${aman(d.id)}">Tolak</button></td></tr>`;
  }).join("") || '<tr><td colspan="4" class="kosong">Tidak ada permintaan</td></tr>';

  $("isi").innerHTML = `
    <h1>Coin Seller</h1>
    <div class="baris"><button class="tbl" id="tambahSeller">+ New Seller</button></div>
    <div class="kartu tbltabel">
      <table><thead><tr><th>Toko</th><th>UID</th><th>Stok</th><th>WhatsApp</th><th>Status</th><th></th></tr></thead>
      <tbody>${baris}</tbody></table>
    </div>
    <h1 style="margin-top:22px">Permintaan kirim coin</h1>
    <div class="kartu tbltabel">
      <table><thead><tr><th>Dari</th><th>Ke</th><th>Coin</th><th></th></tr></thead>
      <tbody>${barisMinta}</tbody></table>
    </div>`;

  $("tambahSeller").onclick = () => modal("New Seller", `
    <label>ID atau UID user</label><input id="slUid" placeholder="10010227">
    <label>Nama toko</label><input id="slToko" placeholder="Toko Coin RAPS">
    <label>WhatsApp</label><input id="slWa" placeholder="08xxxxxxxxxx">
    <label>Stok coin</label><input id="slStok" type="number" value="0">`,
    async () => {
      const uid = await uidDari($("slUid").value);
      await setDoc(doc(db, "sellers", uid), {
        uid, store: $("slToko").value.trim(), wa: $("slWa").value.trim(),
        wa_link: "", stock: Number($("slStok").value || 0), pesanan: 0, active: true,
        updatedAt: Date.now()
      }, { merge: true });
    });

  document.querySelectorAll("[data-isi]").forEach((b) => {
    b.onclick = () => modal("Isi stok seller", `
      <label>Tambah stok coin</label><input id="isiStok" type="number" value="10000">
      <div class="catatan">Angka negatif akan mengurangi stok.</div>`,
      async () => {
        await setDoc(doc(db, "sellers", b.dataset.isi), { stock: increment(Number($("isiStok").value || 0)), updatedAt: Date.now() }, { merge: true });
      });
  });

  document.querySelectorAll("[data-hapus]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Hapus seller ini?")) return;
      await deleteDoc(doc(db, "sellers", b.dataset.hapus));
      bukaHalaman("seller");
    };
  });

  document.querySelectorAll("[data-acc]").forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.acc;
      try {
        await runTransaction(db, async (tx) => {
          const rRef = doc(db, "sellerKirim", id);
          const r = await tx.get(rRef);
          if (!r.exists() || r.data().status !== "menunggu") throw new Error("Permintaan sudah diproses.");
          const data = r.data();
          const sRef = doc(db, "sellers", data.dari);
          const wRef = doc(db, "wallets", data.ke);
          const s = await tx.get(sRef);
          const w = await tx.get(wRef);
          const stok = Number(s.data()?.stock || 0);
          const coin = Number(data.coins || 0);
          if (stok < coin) throw new Error("Stok seller tidak cukup (" + angka(stok) + ").");
          tx.set(sRef, { stock: stok - coin, pesanan: Number(s.data()?.pesanan || 0) + 1, updatedAt: Date.now() }, { merge: true });
          tx.set(wRef, { coins: Number(w.data()?.coins || 0) + coin }, { merge: true });
          tx.update(rRef, { status: "selesai", diprosesOleh: auth.currentUser?.email || "", waktu: Date.now() });
        });
        bukaHalaman("seller");
      } catch (e) { alert(galat(e)); }
    };
  });
  document.querySelectorAll("[data-tolak]").forEach((b) => {
    b.onclick = async () => {
      try {
        await updateDoc(doc(db, "sellerKirim", b.dataset.tolak), { status: "ditolak", waktu: Date.now() });
        bukaHalaman("seller");
      } catch (e) { alert(galat(e)); }
    };
  });
};

/* ================= HALAMAN: frame / vip ================= */
async function halamanVipConfig(slot, judul) {
  const snap = await getDocs(collection(db, "vipConfig"));
  const item = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((x) => (x.slot || "") === slot && x.meta !== true);
  const kartu = item.map((x) => `
    <div class="kartu item">
      <div class="gbr" style="background-image:url('${aman(x.url || "")}')"></div>
      <div class="info"><b>${aman(x.name || x.id)}</b>
        <span>${angka(x.price)} coin · ${angka(x.days)} hari</span>
        <span>${aman(x.id)}</span>
        <div class="aksi"><button class="tbl kecil merah" data-hapus="${aman(x.id)}">Hapus</button></div>
      </div>
    </div>`).join("") || '<div class="kosong">Belum ada ' + judul + "</div>";

  $("isi").innerHTML = `<h1>${judul}</h1>
    <div class="baris"><button class="tbl" id="tambahItem">+ New ${judul}</button></div>
    <div class="kisi">${kartu}</div>`;

  $("tambahItem").onclick = () => modal("New " + judul, `
    <label>ID item (huruf/angka, tanpa spasi)</label><input id="iId" placeholder="frame_neon">
    <label>Nama</label><input id="iNama" placeholder="Neon Ungu">
    <label>Tautan gambar</label><input id="iUrl" placeholder="https://cdn.jsdelivr.net/gh/...">
    <div class="dua"><div><label>Harga coin</label><input id="iHarga" type="number" value="5000"></div>
    <div><label>Hari</label><input id="iHari" type="number" value="30"></div></div>
    <div class="catatan">Gambar memakai tautan gratis (jsDelivr/GitHub), bukan Firebase Storage.</div>`,
    async () => {
      const id = $("iId").value.trim().replace(/[^a-zA-Z0-9_]/g, "");
      if (!id) throw new Error("ID item wajib diisi.");
      await setDoc(doc(db, "vipConfig", id), {
        id, slot, name: $("iNama").value.trim() || id, url: $("iUrl").value.trim(),
        kind: "image", price: Number($("iHarga").value || 0), days: Number($("iHari").value || 30),
        order: Date.now(), store: true, meta: false, hasData: false, updatedAt: Date.now()
      }, { merge: true });
    });

  document.querySelectorAll("[data-hapus]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Hapus item ini?")) return;
      await deleteDoc(doc(db, "vipConfig", b.dataset.hapus));
      bukaHalaman(halAktif);
    };
  });
}
HAL.frame = () => halamanVipConfig("frame", "Frame");
HAL.vip = () => halamanVipConfig("vip", "VIP");
HAL.medali = () => halamanVipConfig("medal", "Medali");
HAL.badge = () => halamanVipConfig("badge", "VIP Badge");

/* ================= HALAMAN: ID cantik ================= */
HAL.idcantik = async () => {
  const snap = await getDocs(collection(db, "vipConfig"));
  const item = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => (x.slot || "") === "uid");
  const kartu = item.map((x) => `
    <div class="kartu item">
      <div class="gbr" style="background-image:url('${aman(x.url || "")}')"></div>
      <div class="info"><b>${aman(x.name || x.id)}</b>
        <span>Nomor: ${aman(x.customId || "-")}</span>
        <span>${angka(x.price)} coin · ${angka(x.days)} hari</span>
        <div class="aksi"><button class="tbl kecil merah" data-hapus="${aman(x.id)}">Hapus</button></div>
      </div></div>`).join("") || '<div class="kosong">Belum ada ID cantik</div>';

  $("isi").innerHTML = `<h1>ID Cantik</h1>
    <div class="baris"><button class="tbl" id="tambahId">+ New ID Cantik</button></div>
    <div class="kisi">${kartu}</div>`;

  $("tambahId").onclick = () => modal("New ID Cantik", `
    <label>ID item</label><input id="iId" placeholder="uid_100000">
    <label>Nomor cantik</label><input id="iNomor" placeholder="100000">
    <label>Nama tampilan</label><input id="iNama" placeholder="Nomor Cantik 100000">
    <div class="dua"><div><label>Harga coin</label><input id="iHarga" type="number" value="50000"></div>
    <div><label>Hari</label><input id="iHari" type="number" value="30"></div></div>
    <label>Tautan gambar (opsional)</label><input id="iUrl" placeholder="https://cdn.jsdelivr.net/gh/...">`,
    async () => {
      const id = $("iId").value.trim().replace(/[^a-zA-Z0-9_]/g, "");
      if (!id) throw new Error("ID item wajib diisi.");
      const nomor = $("iNomor").value.trim();
      if (!/^\d+$/.test(nomor)) throw new Error("Nomor cantik harus angka.");
      await setDoc(doc(db, "vipConfig", id), {
        id, slot: "uid", name: $("iNama").value.trim() || nomor, customId: nomor,
        url: $("iUrl").value.trim(), kind: "image",
        price: Number($("iHarga").value || 0), days: Number($("iHari").value || 30),
        order: Date.now(), store: true, meta: false, hasData: false, updatedAt: Date.now()
      }, { merge: true });
    });

  document.querySelectorAll("[data-hapus]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Hapus item ini?")) return;
      await deleteDoc(doc(db, "vipConfig", b.dataset.hapus));
      bukaHalaman(halAktif);
    };
  });
};

/* ================= HALAMAN: banner ================= */
/* ================= unggah gambar banner (rasio 1:3) ================= */
const FUNGSI_ASET = "https://superagent-74f44334.base44.app/functions/rapsUnggahAset";
const RASIO_BANNER = 3; // lebar : tinggi = 3 : 1

/** Potong tengah gambar ke rasio 1:3 lalu kecilkan, hasilnya Blob JPEG. */
function potongRasio(berkas, rasio = RASIO_BANNER, lebarMaks = 1200) {
  return new Promise((selesai, gagal) => {
    const url = URL.createObjectURL(berkas);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const rasioAsli = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (rasioAsli > rasio) {            // terlalu lebar: potong kiri-kanan
        sw = Math.round(img.height * rasio);
        sx = Math.round((img.width - sw) / 2);
      } else if (rasioAsli < rasio) {     // terlalu tinggi: potong atas-bawah
        sh = Math.round(img.width / rasio);
        sy = Math.round((img.height - sh) / 2);
      }
      const lebar = Math.min(lebarMaks, sw);
      const tinggi = Math.round(lebar / rasio);
      const kanvas = document.createElement("canvas");
      kanvas.width = lebar; kanvas.height = tinggi;
      const ctx = kanvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, lebar, tinggi);
      kanvas.toBlob((b) => b ? selesai(b) : gagal(new Error("Gagal mengolah gambar")), "image/jpeg", 0.9);
    };
    img.onerror = () => { URL.revokeObjectURL(url); gagal(new Error("Berkas ini bukan gambar")); };
    img.src = url;
  });
}

function blobKeBase64(b) {
  return new Promise((selesai, gagal) => {
    const r = new FileReader();
    r.onload = () => selesai(String(r.result || "").replace(/^data:[^,]*,/, ""));
    r.onerror = () => gagal(new Error("Gagal membaca berkas"));
    r.readAsDataURL(b);
  });
}

/** Unggah gambar banner ke repo aset gratis, kembalikan URL publiknya. */
async function unggahBanner(berkas, lapor) {
  if (!auth.currentUser) throw new Error("Sesi login tidak ada, muat ulang panel lalu masuk lagi");
  lapor("Memotong gambar ke rasio 1:3…");
  const blob = await potongRasio(berkas);
  if (blob.size > 8 * 1024 * 1024) throw new Error("Gambar terlalu besar setelah dipotong");
  lapor("Mengunggah…");
  const idToken = await auth.currentUser.getIdToken();
  const data = await blobKeBase64(blob);
  const nama = "banner_" + Date.now() + ".jpg";
  const r = await fetch(FUNGSI_ASET, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, folder: "banner", nama, contentType: "image/jpeg", data })
  });
  const j = await r.json().catch(() => null);
  if (!j || !j.ok) throw new Error((j && j.e) || ("HTTP " + r.status));
  return j.url;
}

/** Unggah aset umum: folder, rasio (lebar/tinggi), lebar maksimum. */
async function unggahAset(berkas, folder, rasio, lebarMaks, lapor) {
  if (!auth.currentUser) throw new Error("Sesi login tidak ada, muat ulang panel lalu masuk lagi");
  if (lapor) lapor("Menyiapkan gambar…");
  const blob = await potongRasio(berkas, rasio, lebarMaks);
  if (blob.size > 8 * 1024 * 1024) throw new Error("Gambar terlalu besar setelah dipotong");
  if (lapor) lapor("Mengunggah…");
  const idToken = await auth.currentUser.getIdToken();
  const data = await blobKeBase64(blob);
  const nama = folder + "_" + Date.now() + ".jpg";
  const r = await fetch(FUNGSI_ASET, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, folder, nama, contentType: "image/jpeg", data })
  });
  const j = await r.json().catch(() => null);
  if (!j || !j.ok) throw new Error((j && j.e) || ("HTTP " + r.status));
  return j.url;
}

const SLOT_VIP = [
  { k: "badge", nama: "Badge", rasio: 1 },
  { k: "medal", nama: "Medali", rasio: 1 },
  { k: "frame", nama: "Bingkai", rasio: 1 },
  { k: "bubble", nama: "Balon chat", rasio: 1 },
  { k: "cardbg", nama: "Latar kartu", rasio: 0.75 },
  { k: "title", nama: "Gelar", rasio: 3 },
  { k: "entry", nama: "Entry room", rasio: 3 },
];

HAL.vip19 = async () => {
  const snap = await getDocs(collection(db, "vipConfig"));
  const peta = {};
  snap.docs.forEach((d) => {
    const x = d.data();
    if (x.meta !== true) return;
    peta[Number(x.n || 0) + "_" + (x.slot || "")] = x.url || "";
  });
  const baris = [];
  for (let n = 1; n <= 9; n++) {
    const sel = SLOT_VIP.map((s) => {
      const url = peta[n + "_" + s.k] || "";
      return `<div class="selVip">
        <div class="kcl">${url ? `<img src="${aman(url)}" alt="">` : '<span>kosong</span>'}</div>
        <div class="nmS">${s.nama}</div>
        <label class="tbl kecil biru" style="text-align:center;display:block">Pilih
          <input type="file" accept="image/*" hidden data-n="${n}" data-slot="${s.k}" data-rasio="${s.rasio}">
        </label>
      </div>`;
    }).join("");
    baris.push(`<div class="kartu vipBaris"><div class="vipKepala">VIP ${n}</div><div class="vipSel">${sel}</div></div>`);
  }
  $("isi").innerHTML = `<h1>VIP 1 sampai 9</h1>
    <div class="catatan" style="margin-bottom:10px">Unggah gambar untuk tiap tingkat. Rasio dipotong otomatis sesuai jenis aset, lalu tersimpan sebagai aset VIP yang dibaca aplikasi.</div>
    <div class="baris"><button class="tbl biru" id="imporSvip">Impor aset SVIP dari berkas (30 aset)</button></div>
    <div id="vipPesan" class="pesan"></div>
    ${baris.join("")}`;

  $("imporSvip").onclick = async () => {
    const pesan = $("vipPesan");
    pesan.className = "pesan";
    pesan.textContent = "Mengambil daftar aset…";
    try {
      const r = await fetch("https://cdn.jsdelivr.net/gh/tagalungpey-stack/RAPS-STAR-ASET@main/vip/manifest.json?t=" + Date.now());
      const daftar = await r.json();
      let sudah = 0;
      for (const a of daftar) {
        const id = "vip_" + a.n + "_" + a.slot;
        await setDoc(doc(db, "vipConfig", id), {
          id, n: Number(a.n), slot: a.slot, meta: true, kind: a.kind || "image",
          url: a.url, hasData: false, chunks: 0, poster: "", updatedAt: Date.now()
        }, { merge: true });
        sudah++;
        pesan.textContent = "Menyimpan " + sudah + " dari " + daftar.length + "…";
      }
      pesan.className = "pesan ok";
      pesan.textContent = "Selesai. " + sudah + " aset VIP tersimpan dan langsung terbaca aplikasi.";
      await HAL.vip19();
    } catch (e) {
      pesan.className = "pesan galat";
      pesan.textContent = "Gagal impor: " + (e.message || e);
    }
  };

  $("isi").querySelectorAll('input[type="file"]').forEach((f) => {
    f.onchange = async () => {
      const berkas = f.files && f.files[0];
      if (!berkas) return;
      const n = Number(f.dataset.n), slot = f.dataset.slot, rasio = Number(f.dataset.rasio);
      const pesan = $("vipPesan");
      pesan.className = "pesan";
      pesan.textContent = "Mengunggah VIP " + n + " " + slot + "…";
      try {
        const url = await unggahAset(berkas, "vip", rasio, rasio >= 2 ? 1200 : 600, (t) => { pesan.textContent = t; });
        const id = "vip_" + n + "_" + slot;
        await setDoc(doc(db, "vipConfig", id), {
          id, n, slot, meta: true, kind: "image", url,
          hasData: false, chunks: 0, poster: "", updatedAt: Date.now()
        }, { merge: true });
        pesan.className = "pesan ok";
        pesan.textContent = "VIP " + n + " " + slot + " tersimpan.";
        await HAL.vip19();
      } catch (e) {
        pesan.className = "pesan galat";
        pesan.textContent = "Gagal: " + (e.message || e);
      }
    };
  });
};

/* ================= Gift (tab Hadiah dan Cashback di room) ================= */
/* ================= Tag Official ================= */
HAL.tag = async () => {
  const snap = await getDocs(collection(db, "vipConfig"));
  const item = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((x) => (x.slot || "") === "title" && String(x.id).startsWith("tag_official_"));
  const kartu = item.map((x) => `
    <div class="kartu item">
      <div class="gbr" style="background-image:url('${aman(x.url || "")}');background-size:contain"></div>
      <div class="info"><b>${aman(x.name || x.id)}</b>
        <span>${angka(x.price)} coin · ${angka(x.days)} hari</span>
        <div class="aksi">
          <button class="tbl kecil biru" data-edit="${aman(x.id)}">Edit harga</button>
          <button class="tbl kecil" data-give="${aman(x.id)}">Give ke ID</button>
          <button class="tbl kecil merah" data-hapus="${aman(x.id)}">Hapus</button>
        </div>
      </div></div>`).join("") || '<div class="kosong">Belum ada tag official di aplikasi</div>';

  $("isi").innerHTML = `<h1>Tag Official</h1>
    <div class="catatan" style="margin-bottom:10px">Tag tampil sebagai gelar bergambar di sebelah nama. Tekan tombol di bawah untuk memasukkan 13 tag resmi ke Store aplikasi.</div>
    <div class="baris"><button class="tbl biru" id="imporTag">Impor 13 tag official ke Store</button></div>
    <div id="tagPesan" class="pesan"></div>
    <div class="kisi">${kartu}</div>`;

  $("imporTag").onclick = async () => {
    const pesan = $("tagPesan");
    pesan.className = "pesan"; pesan.textContent = "Mengambil daftar tag…";
    try {
      const r = await fetch("https://cdn.jsdelivr.net/gh/tagalungpey-stack/RAPS-STAR-ASET@main/tag/manifest.json?t=" + Date.now());
      const daftar = await r.json();
      let n = 0;
      for (const a of daftar) {
        await setDoc(doc(db, "vipConfig", a.id), {
          id: a.id, slot: "title", name: a.name, url: a.url, kind: "image",
          price: 100000, days: 30, order: Date.now() + n, store: true, meta: false,
          hasData: false, updatedAt: Date.now()
        }, { merge: true });
        n++;
        pesan.textContent = "Menyimpan " + n + " dari " + daftar.length + "…";
      }
      pesan.className = "pesan ok";
      pesan.textContent = "Selesai. " + n + " tag official masuk Store.";
      await HAL.tag();
    } catch (e) { pesan.className = "pesan galat"; pesan.textContent = "Gagal: " + (e.message || e); }
  };

  document.querySelectorAll("[data-edit]").forEach((b) => {
    const id = b.dataset.edit;
    const x = item.find((y) => y.id === id) || {};
    b.onclick = () => modal("Edit " + (x.name || id), `
      <label>Harga (coin)</label><input id="tHarga" type="number" value="${Number(x.price || 0)}">
      <label>Masa aktif (hari)</label><input id="tHari" type="number" value="${Number(x.days || 30)}">
      <label>Nama tag</label><input id="tNama" value="${aman(x.name || id)}">`,
      async () => {
        await setDoc(doc(db, "vipConfig", id), {
          price: Number($("tHarga").value || 0),
          days: Number($("tHari").value || 30),
          name: $("tNama").value.trim() || x.name || id,
          updatedAt: Date.now()
        }, { merge: true });
      });
  });

  document.querySelectorAll("[data-give]").forEach((b) => {
    const id = b.dataset.give;
    const x = item.find((y) => y.id === id) || {};
    b.onclick = () => modal("Give " + (x.name || id), `
      <label>ID atau UID penerima</label><input id="gUid" placeholder="mis. 100001">
      <label>Masa aktif (hari)</label><input id="gHari" type="number" value="${Number(x.days || 30)}">
      <div class="catatan">Tag langsung masuk ke tas akun itu, dan bisa dipakai sebagai gelar tanpa membeli.</div>`,
      async () => {
        const masuk = $("gUid").value.trim();
        if (!masuk) throw new Error("ID penerima wajib diisi.");
        let uid = masuk;
        if (/^\d+$/.test(masuk)) {
          const d1 = await getDoc(doc(db, "userIds", masuk));
          uid = (d1.exists() && d1.data().uid) || "";
          if (!uid) {
            const q = await getDocs(query(collection(db, "userIds"), where("userId", "==", masuk)));
            uid = q.docs.length ? (q.docs[0].data().uid || "") : "";
          }
          if (!uid) throw new Error("ID " + masuk + " tidak ditemukan.");
        }
        const hari = Number($("gHari").value || 30);
        const habis = Date.now() + hari * 86400000;
        // Tag langsung dipakai: masuk tas, dipasang sebagai gelar, dan
        // ditulis ke profil publik supaya terlihat oleh semua orang.
        await setDoc(doc(db, "wallets", uid), {
          inv: { [id]: habis },
          equip: { title: id },
          diperbarui: Date.now()
        }, { merge: true });
        await setDoc(doc(db, "users", uid), { title: id }, { merge: true });
        try { await setBaru(rRefBaru(rtdbBaru, "pub/" + uid + "/title"), id); } catch (e) { }
        return "Tag terkirim dan langsung dipakai " + masuk;
      });
  });

  document.querySelectorAll("[data-hapus]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Hapus tag ini?")) return;
      await deleteDoc(doc(db, "vipConfig", b.dataset.hapus));
      bukaHalaman("tag");
    };
  });
};

HAL.gift = async () => {
  let daftar = {};
  try {
    const sn = await rGetBaru(rRefBaru(rtdbBaru, "giftCfg"));
    if (sn.exists()) daftar = sn.val() || {};
  } catch (e) {
    $("isi").innerHTML = `<h1>Gift</h1><div class="catatan">Gagal membaca gift: ${aman(e.message || e)}</div>`;
    return;
  }
  const item = Object.entries(daftar).map(([id, g]) => ({ id, ...g }));
  const kartu = item.map((g) => `
    <div class="kartu item">
      <div class="gbr" style="background-image:url('${aman(g.icon || g.mediaUrl || "")}')">${g.icon || g.mediaUrl ? "" : aman(g.emoji || "🎁")}</div>
      <div class="info"><b>${aman(g.name || g.id)}</b>
        <span>${angka(g.price)} coin</span>
        <span class="lencana ${g.cashback || Number(g.cbRate) > 0 ? "hijau" : ""}">${g.cashback || Number(g.cbRate) > 0 ? "Tab Cashback" : "Tab Hadiah"}</span>
        <div class="aksi"><button class="tbl kecil merah" data-hapus="${aman(g.id)}">Hapus</button></div>
      </div></div>`).join("") || '<div class="kosong">Belum ada gift. Room akan menampilkan "Belum ada gift" sampai kamu menambah.</div>';

  $("isi").innerHTML = `<h1>Gift</h1>
    <div class="catatan" style="margin-bottom:10px">Gift biasa tampil di tab <b>Hadiah</b> room. Gift dengan saklar <b>Cashback</b> menyala tampil di tab <b>Cashback</b>.</div>
    <div class="baris"><button class="tbl" id="tambahGift">+ New Gift</button>
      <button class="tbl biru" id="giftAwal">Isi 10 gift standar</button></div>
    <div id="giftPesan" class="pesan"></div>
    <div class="kisi">${kartu}</div>`;

  $("tambahGift").onclick = () => modal("New Gift", `
    <label>Nama gift</label><input id="gfNama" placeholder="Mawar">
    <div class="dua"><div><label>Emoji</label><input id="gfEmoji" value="🎁"></div>
    <div><label>Harga (coin)</label><input id="gfHarga" type="number" value="100"></div></div>
    <label>Gambar ikon (pilih berkas)</label><input id="gfFile" type="file" accept="image/*">
    <div class="catatan" id="gfInfo"></div>
    <label>atau tautan ikon</label><input id="gfIcon" placeholder="https://cdn.jsdelivr.net/gh/...">
    <label>Tautan animasi (opsional, svga/mp4/webp)</label><input id="gfMedia" placeholder="https://...">
    <div class="dua"><div><label>Jenis animasi</label><select id="gfJenis">
      <option value="">Tanpa</option><option value="svga">SVGA</option><option value="mp4">MP4</option><option value="image">Gambar</option></select></div>
    <div><label>Tab</label><select id="gfCb">
      <option value="0">Hadiah (biasa)</option><option value="1">Cashback</option></select></div></div>
    <div class="dua"><div><label>Peluang cashback (%)</label><input id="gfCbRate" type="number" value="0"></div>
    <div><label>Hadiah cashback (coin)</label><input id="gfCbHarga" type="number" value="0"></div></div>`,
    async () => {
      const nama = $("gfNama").value.trim();
      if (!nama) throw new Error("Nama gift wajib diisi.");
      let icon = $("gfIcon").value.trim();
      const f = $("gfFile").files && $("gfFile").files[0];
      if (f) icon = await unggahAset(f, "gift", 1, 512, (t) => { $("gfInfo").textContent = t; });
      const cb = $("gfCb").value === "1";
      const id = "gift_" + Date.now();
      const data = {
        name: nama, emoji: $("gfEmoji").value.trim() || "🎁", icon,
        price: Number($("gfHarga").value || 0), mediaUrl: $("gfMedia").value.trim(),
        mediaType: $("gfJenis").value, special: false, rocket: false, cashback: cb,
        jpRate: 0, jpMult: 0, cbRate: cb ? Number($("gfCbRate").value || 0) : 0,
        cbPrice: cb ? Number($("gfCbHarga").value || 0) : 0
      };
      await setBaru(rRefBaru(rtdbBaru, "giftCfg/" + id), data);
      await setDoc(doc(db, "gifts", id), { ...data, diperbarui: serverTimestamp() }, { merge: true });
    });

  $("giftAwal").onclick = async () => {
    const standar = [
      ["Mawar","🌹",100,0],["Hati","💖",500,0],["Mahkota","👑",2000,0],
      ["Mobil","🏎️",5000,0],["Istana","🏰",20000,0],["Naga","🐉",50000,0],
      ["Kotak Hoki","🎁",1000,1],["Bintang Emas","⭐",5000,1],["Koin Emas","🪙",20000,1],["Jackpot","💎",100000,1],
    ];
    const pesan = $("giftPesan");
    pesan.className = "pesan"; pesan.textContent = "Menyimpan gift standar…";
    try {
      for (const [nama, emoji, harga, cb] of standar) {
        const id = "gift_" + nama.toLowerCase().replace(/[^a-z0-9]/g, "");
        const data = { name: nama, emoji, icon: "", price: harga, mediaUrl: "", mediaType: "",
          special: false, rocket: false, cashback: cb === 1, jpRate: 0, jpMult: 0,
          cbRate: cb === 1 ? 70 : 0, cbPrice: 0 };
        await setBaru(rRefBaru(rtdbBaru, "giftCfg/" + id), data);
        await setDoc(doc(db, "gifts", id), { ...data, diperbarui: serverTimestamp() }, { merge: true });
      }
      pesan.className = "pesan ok"; pesan.textContent = "10 gift tersimpan (6 Hadiah, 4 Cashback).";
      await HAL.gift();
    } catch (e) { pesan.className = "pesan galat"; pesan.textContent = "Gagal: " + (e.message || e); }
  };

  document.querySelectorAll("[data-hapus]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Hapus gift ini?")) return;
      const id = b.dataset.hapus;
      try { await hapusBaru(rRefBaru(rtdbBaru, "giftCfg/" + id)); } catch (e) { alert(galat(e)); return; }
      try { await deleteDoc(doc(db, "gifts", id)); } catch (e) { }
      bukaHalaman("gift");
    };
  });
};

HAL.banner = async () => {
  const snap = await getDocs(collection(db, "banners"));
  const kartu = snap.docs.map((d) => {
    const b = d.data();
    const adaGambar = !!(b.imageUrl || "").trim();
    return `<div class="kartu bn">
      <div class="bnGbr">${adaGambar
        ? `<img src="${aman(b.imageUrl)}" alt="" loading="lazy">`
        : '<div class="bnKosong">Tanpa gambar</div>'}</div>
      <div class="bnInfo"><b>${aman(b.title || "(tanpa judul)")}</b>
        <span>${aman(b.subtitle || "")}</span>
        <span>${aman(b.link || "tanpa tautan")}</span>
        <span class="catatan">${b.active === false ? "Disembunyikan" : "Tampil"} · urutan ${aman(String(b.order ?? 0))}</span>
        <div class="aksi"><button class="tbl kecil merah" data-hapus="${aman(d.id)}">Hapus</button></div>
      </div></div>`;
  }).join("") || '<div class="kosong">Belum ada banner</div>';

  $("isi").innerHTML = `<h1>Banner</h1>
    <div class="catatan" style="margin-bottom:10px">Tampilan di sini sama dengan di aplikasi (rasio 3:1). Banner yang gambarnya sudah bertulisan tidak ditimpa teks.</div>
    <div class="baris"><button class="tbl" id="tambahBanner">+ New Banner</button></div>
    <div class="kisiBn">${kartu}</div>`;

  // Pemilih berkas: potong ke 1:3, unggah, lalu isi otomatis kolom tautan.
  const pasangPilih = () => {
    const f = $("bFile");
    if (!f) return;
    const u = $("bUrl");
    if (u) u.oninput = () => {
      const alamat = u.value.trim();
      const info = $("bInfo"), pr = $("bPratinjau"), gbr = $("bGbr");
      if (!alamat) { pr.style.display = "none"; return; }
      const im = new Image();
      im.onload = () => {
        pr.style.display = "block"; gbr.src = alamat;
        const r = im.width / im.height;
        info.textContent = Math.abs(r - 3) < 0.05
          ? "Rasio " + im.width + "×" + im.height + " (3:1), pas."
          : "Peringatan: gambar ini " + im.width + "×" + im.height + " (bukan 3:1), akan terpotong di aplikasi. Lebih baik pilih berkas supaya dipotong otomatis.";
      };
      im.onerror = () => { pr.style.display = "block"; info.textContent = "Gambar tidak bisa dimuat dari tautan ini."; };
      im.src = alamat;
    };
    f.onchange = async () => {
      const berkas = f.files?.[0];
      if (!berkas) return;
      window.__bannerUrlSiap = "";
      window.__unggahBannerSedang = true;
      const pratinjau = $("bPratinjau"), gbr = $("bGbr"), info = $("bInfo");
      pratinjau.style.display = "block";
      gbr.src = URL.createObjectURL(berkas);
      info.textContent = "Memotong gambar ke rasio 1:3…";
      try {
        const url = await unggahBanner(berkas, (m) => { info.textContent = m; });
        window.__bannerUrlSiap = url;
        $("bUrl").value = url;
        info.textContent = "Siap. Gambar 1:3 tersimpan.";
      } catch (e) {
        info.textContent = "Gagal: " + (e.message || e);
        $("bUrl").value = "";
      } finally {
        window.__unggahBannerSedang = false;
      }
    };
  };

  $("tambahBanner").onclick = () => { modal("New Banner", `
    <label>Judul</label><input id="bJudul" placeholder="Event Spesial">
    <label>Subjudul</label><input id="bSub" placeholder="Kumpulkan poin dan menangkan hadiah">
    <label>Gambar banner (otomatis dipotong rasio 3:1, ideal 1200×400)</label>
    <input id="bFile" type="file" accept="image/*">
    <div id="bPratinjau" style="display:none;margin-top:8px">
      <div style="width:100%;aspect-ratio:3/1;border-radius:10px;overflow:hidden;border:1px solid var(--garis)">
        <img id="bGbr" style="width:100%;height:100%;object-fit:cover;display:block">
      </div>
      <div class="catatan" id="bInfo" style="margin-top:6px"></div>
    </div>
    <label>Tautan gambar (boleh tempel URL sendiri)</label><input id="bUrl" placeholder="https://cdn.jsdelivr.net/gh/...">
    <label>Tautan saat diklik (opsional)</label><input id="bLink" placeholder="https://...">
    <div class="dua"><div><label>Urutan</label><input id="bOrder" type="number" value="0"></div>
    <div><label>Status</label><select id="bAktif"><option value="1">Tampil</option><option value="0">Sembunyi</option></select></div></div>`,
    async () => {
      const berkas = $("bFile")?.files?.[0];
      let url = $("bUrl").value.trim();
      if (berkas) {
        if (window.__unggahBannerSedang) throw new Error("Gambar masih diunggah, tunggu sebentar");
        url = window.__bannerUrlSiap || "";
        if (!url) throw new Error("Gambar belum selesai diunggah, pilih ulang lalu tunggu");
      }
      if (!url) throw new Error("Pilih gambar banner dulu");
      const id = "b" + Date.now();
      await setDoc(doc(db, "banners", id), {
        title: $("bJudul").value.trim(), subtitle: $("bSub").value.trim(),
        imageUrl: url, link: $("bLink").value.trim(),
        order: Number($("bOrder").value || 0), active: $("bAktif").value === "1"
      });
    }); pasangPilih(); };

  document.querySelectorAll("[data-hapus]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Hapus banner ini?")) return;
      await deleteDoc(doc(db, "banners", b.dataset.hapus));
      bukaHalaman("banner");
    };
  });
};

/* ================= HALAMAN: game ================= */
HAL.game = async () => {
  const snap = await getDocs(collection(db, "gameConfig"));
  const baris = snap.docs.map((d) => {
    const g = d.data();
    return `<tr><td>${aman(g.name || d.id)}</td><td><span class="lencana">${aman(d.id)}</span></td>
      <td>${aman(g.url || "-")}</td>
      <td><span class="lencana ${g.active === false ? "merah" : "hijau"}">${g.active === false ? "nonaktif" : "aktif"}</span></td>
      <td><button class="tbl kecil merah" data-hapus="${aman(d.id)}">Hapus</button></td></tr>`;
  }).join("") || '<tr><td colspan="5" class="kosong">Belum ada game</td></tr>';

  $("isi").innerHTML = `<h1>Game</h1>
    <div class="baris"><button class="tbl" id="tambahGame">+ New Game</button></div>
    <div class="kartu tbltabel"><table>
      <thead><tr><th>Nama</th><th>ID</th><th>Tautan</th><th>Status</th><th></th></tr></thead>
      <tbody>${baris}</tbody></table></div>`;

  $("tambahGame").onclick = () => modal("New Game", `
    <label>ID game</label><input id="gId" placeholder="ludo">
    <label>Nama</label><input id="gNama" placeholder="Ludo Star">
    <label>Tautan game</label><input id="gUrl" placeholder="https://...">
    <label>Status</label><select id="gAktif"><option value="1">Aktif</option><option value="0">Nonaktif</option></select>`,
    async () => {
      const id = $("gId").value.trim().replace(/[^a-zA-Z0-9_-]/g, "");
      if (!id) throw new Error("ID game wajib diisi.");
      await setDoc(doc(db, "gameConfig", id), {
        id, name: $("gNama").value.trim() || id, url: $("gUrl").value.trim(),
        active: $("gAktif").value === "1", updatedAt: Date.now()
      }, { merge: true });
    });

  document.querySelectorAll("[data-hapus]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Hapus game ini?")) return;
      await deleteDoc(doc(db, "gameConfig", b.dataset.hapus));
      bukaHalaman("game");
    };
  });
};

/* ================= HALAMAN: coin ================= */
HAL.coin = async () => {
  $("isi").innerHTML = `<h1>Coin</h1>
    <div class="kartu">
      <label>ID atau UID user</label><input id="cUid" placeholder="10010227">
      <div class="baris" style="margin-top:12px">
        <input id="cJumlah" type="number" value="1000" style="max-width:160px">
        <button class="tbl" id="cKirim">Kirim coin</button>
        <button class="tbl biru" id="cSet">Set saldo</button>
        <button class="tbl merah" id="cNol">Reset ke 0</button>
      </div>
      <div class="pesan" id="cPesan"></div>
    </div>`;

  const uid = async () => uidDari($("cUid").value);
  $("cKirim").onclick = async () => {
    try {
      const u = await uid();
      await setDoc(doc(db, "wallets", u), { coins: increment(Number($("cJumlah").value || 0)), diperbarui: serverTimestamp() }, { merge: true });
      tulis("cPesan", "Coin terkirim ke " + u.slice(0, 10) + ".", "ok");
    } catch (e) { tulis("cPesan", galat(e), ""); }
  };
  $("cSet").onclick = async () => {
    try {
      const u = await uid();
      await setDoc(doc(db, "wallets", u), { coins: Number($("cJumlah").value || 0), diperbarui: serverTimestamp() }, { merge: true });
      tulis("cPesan", "Saldo diset.", "ok");
    } catch (e) { tulis("cPesan", galat(e), ""); }
  };
  $("cNol").onclick = async () => {
    try {
      const u = await uid();
      await setDoc(doc(db, "wallets", u), { coins: 0, diperbarui: serverTimestamp() }, { merge: true });
      tulis("cPesan", "Saldo direset ke 0.", "ok");
    } catch (e) { tulis("cPesan", galat(e), ""); }
  };
};

/* ================= HALAMAN: blokir ================= */
HAL.blokir = async () => {
  const snap = await getDocs(collection(db, "banned"));
  const baris = snap.docs.map((d) => {
    const b = d.data();
    return `<tr><td><span class="lencana">${aman(d.id.slice(0, 12))}</span></td>
      <td>${aman(b.reason || "-")}</td><td>${aman(b.oleh || "-")}</td>
      <td><button class="tbl kecil abu" data-buka="${aman(d.id)}">Buka blokir</button></td></tr>`;
  }).join("") || '<tr><td colspan="4" class="kosong">Tidak ada user diblokir</td></tr>';

  $("isi").innerHTML = `<h1>Blokir</h1>
    <div class="baris"><button class="tbl" id="tambahBlokir">+ New Blokir</button></div>
    <div class="kartu tbltabel"><table>
      <thead><tr><th>UID</th><th>Alasan</th><th>Oleh</th><th></th></tr></thead>
      <tbody>${baris}</tbody></table></div>`;

  $("tambahBlokir").onclick = () => modal("New Blokir", `
    <label>ID atau UID user</label><input id="blUid" placeholder="10010227">
    <label>Alasan</label><input id="blAlasan" placeholder="Melanggar aturan">`,
    async () => {
      const uid = await uidDari($("blUid").value);
      await setDoc(doc(db, "banned", uid), {
        reason: $("blAlasan").value.trim() || "Diblokir dari panel",
        oleh: auth.currentUser?.email || "", waktu: serverTimestamp()
      });
    });

  document.querySelectorAll("[data-buka]").forEach((b) => {
    b.onclick = async () => {
      await deleteDoc(doc(db, "banned", b.dataset.buka));
      bukaHalaman("blokir");
    };
  });
};

/* ================= HALAMAN: rilis ================= */

/* ================= diagnosa dompet ================= */
HAL.diagnosa = async () => {
  $("isi").innerHTML = `<h1>Diagnosa dompet</h1>
    <div class="kartu" style="padding:16px">
      <label>ID angka, UID, atau email user</label>
      <input id="dgCari" placeholder="100000">
      <div class="baris" style="margin-top:12px"><button class="tbl" id="dgTombol">Periksa</button></div>
      <div id="dgHasil" style="margin-top:14px"></div>
    </div>
    <div class="kartu tbltabel" style="margin-top:14px">
      <div style="padding:12px 14px" class="catatan">Dompet dengan coin terbanyak (bukti coin benar-benar tersimpan):</div>
      <table><thead><tr><th>Dokumen dompet</th><th>Coin</th><th>Diamond</th></tr></thead>
      <tbody id="dgTop"><tr><td colspan="3" class="kosong">Memuat…</td></tr></tbody></table>
    </div>`;

  $("dgTombol").onclick = async () => {
    const kotak = $("dgHasil");
    kotak.innerHTML = '<div class="catatan">Memeriksa…</div>';
    try {
      const uid = await uidDari($("dgCari").value);
      const w = await getDoc(doc(db, "wallets", uid));
      const d = w.exists() ? w.data() : null;
      kotak.innerHTML = `<div class="catatan">UID tujuan: <b style="word-break:break-all">${aman(uid)}</b></div>
        <div class="catatan" style="margin-top:8px">Dokumen: <code>wallets/${aman(uid)}</code> ${d ? "ada" : "<b>tidak ada</b>"}</div>
        <div class="catatan" style="margin-top:8px">Coin: <b>${d ? aman(String(d.coins ?? 0)) : "0"}</b> · Diamond: <b>${d ? aman(String(d.diamonds ?? 0)) : "0"}</b> · VIP: <b>${d ? aman(String(d.vip ?? 0)) : "0"}</b></div>
        <div class="catatan" style="margin-top:10px">Cocokkan UID di atas dengan penanda di tab Saya aplikasi (baris kecil paling bawah: RAPS STAR v… · dompet …).</div>`;
    } catch (e) { kotak.innerHTML = `<div class="catatan">${aman(galat(e))}</div>`; }
  };

  try {
    const snap = await getDocs(query(collection(db, "wallets"), orderBy("coins", "desc"), limit(20)));
    const baris = snap.docs.map((d) => {
      const x = d.data();
      return `<tr><td><span class="lencana">${aman(d.id.slice(0, 14))}</span></td>
        <td>${aman(String(x.coins ?? 0))}</td><td>${aman(String(x.diamonds ?? 0))}</td></tr>`;
    }).join("") || '<tr><td colspan="3" class="kosong">Belum ada dompet berisi coin</td></tr>';
    $("dgTop").innerHTML = baris;
  } catch (e) {
    $("dgTop").innerHTML = `<tr><td colspan="3" class="kosong">${aman(galat(e))}</td></tr>`;
  }
};

HAL.rilis = async () => {
  const ambil = async (u) => { try { const r = await fetch(u + "?t=" + Date.now()); return await r.json(); } catch { return null; } };
  const info = await ambil("https://tagalungpey-stack.github.io/RAPS-STAR-APK/unduh/build-info.json");
  const patch = await ambil("https://tagalungpey-stack.github.io/RAPS-STAR-APK/unduh/patch-info.json");
  if (!info) { $("isi").innerHTML = '<div class="kosong">Info rilis tidak bisa dibaca.</div>'; return; }
  const mb = (n) => (Number(n || 0) / 1048576).toFixed(1) + " MB";
  const p = (patch?.patch || [])[0];
  $("isi").innerHTML = `<h1>Rilis aplikasi</h1>
    <div class="angka">
      <div class="kartu"><b>v${aman(info.versi)}</b><span>Versi terbaru</span></div>
      <div class="kartu"><b>${mb(info.ukuran_apk)}</b><span>APK penuh</span></div>
      <div class="kartu"><b>${p ? mb(p.arm64?.ukuran) : "–"}</b><span>Patch terkecil</span></div>
    </div>
    <div class="kartu">
      <div class="catatan" style="white-space:pre-wrap">${aman(info.catatan || "")}</div>
      <div class="baris" style="margin-top:12px">
        <a class="tbl" href="https://tagalungpey-stack.github.io/RAPS-STAR-APK/" target="_blank" rel="noopener">Buka halaman unduh</a>
      </div>
    </div>`;
};

/* ================= Cashback =================
 * Ditulis ke Realtime Database pub/_cashbackCfg dan langsung dipakai aplikasi,
 * tanpa perlu build ulang. Angka utama: aktif/tidak, peluang dapat cashback,
 * batas atas persen, dan peluang zonk.
 */
HAL.cashback = async () => {
  const bawaan = {
    on: true, modePersen: true, capPct: 12000, recvPct: 70,
    diamondPct: 5, diamondBiasaPct: 100, kembaliPct: 0,
    bebasZonkMulai: 0, jpMin: 50000,
  };
  let cfg = { ...bawaan };
  try {
    const sn = await rGetBaru(rRefBaru(rtdbBaru, "pub/_cashbackCfg"));
    if (sn.exists()) cfg = { ...bawaan, ...(sn.val() || {}) };
  } catch (e) {
    $("isi").innerHTML = `<h1>Cashback</h1><div class="catatan">Gagal membaca pengaturan: ${aman(e.message || e)}</div>`;
    return;
  }

  $("isi").innerHTML = `<h1>Cashback</h1>
    <div class="kartu" style="max-width:640px">
      <div class="catatan">Cashback gift diatur di sini dan langsung berlaku di aplikasi. <b>Peluang dapat</b> 70 berarti 70% kiriman gift mendapat cashback. <b>Batas atas</b> adalah persen maksimum dari harga gift. <b>Peluang zonk</b> adalah bagian yang tidak dapat apa-apa, jadi sebaiknya kecil.</div>
      <div class="dua">
        <div><label>Cashback aktif</label><select id="cbOn">
          <option value="1" ${cfg.on === false ? "" : "selected"}>Aktif</option>
          <option value="0" ${cfg.on === false ? "selected" : ""}>Mati</option></select></div>
        <div><label>Peluang dapat cashback (%)</label><input id="cbPct" type="number" min="0" max="100" value="${Number(cfg.recvPct ?? 70)}"></div>
      </div>
      <div class="dua">
        <div><label>Batas atas cashback (% dari harga)</label><input id="cbCap" type="number" min="1" max="100000" value="${Number(cfg.capPct ?? 12000)}"></div>
        <div><label>Peluang zonk (%)</label><input id="cbZonk" type="number" min="0" max="100" value="${Math.max(0, Math.min(100, Number(cfg.bebasZonkMulai ?? 0) === 0 ? 8 : Number(cfg.bebasZonkMulai)))}"></div>
      </div>
      <div class="dua">
        <div><label>Minimal gift untuk cashback (coin)</label><input id="cbMin" type="number" min="0" value="${Number(cfg.jpMin ?? 50000)}"></div>
        <div><label>Cashback ke penerima (%)</label><input id="cbRecv" type="number" min="0" max="100" value="${Number(cfg.recvPct ?? 70)}"></div>
      </div>
      <div class="baris" style="margin-top:14px">
        <button class="tbl" id="cbSimpan">Simpan</button>
        <button class="tbl abu" id="cbMuat">Muat ulang</button>
      </div>
      <div class="pesan" id="cbPesan"></div>
    </div>`;

  $("cbSimpan").onclick = async () => {
    const data = {
      ...cfg,
      on: $("cbOn").value === "1",
      modePersen: true,
      recvPct: Number($("cbPct").value || 0),
      capPct: Number($("cbCap").value || 1),
      jpMin: Number($("cbMin").value || 0),
      bebasZonkMulai: Number($("cbZonk").value || 0),
    };
    try {
      await setBaru(rRefBaru(rtdbBaru, "pub/_cashbackCfg"), data);
      pesan("cbPesan", "Tersimpan. Cashback langsung berlaku di aplikasi.", "ok");
    } catch (e) {
      pesan("cbPesan", "Gagal menyimpan: " + (e.message || e), "salah");
    }
  };
  $("cbMuat").onclick = () => HAL.cashback();
};

// pasangGiftAwal
