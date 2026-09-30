// ==========================================
// KAS KELAS SI-26 — app.js
// ==========================================

// ---------- SEED DATA ----------
const DEFAULT_DATA = {
  users: [],
  periode: [
    { id: 1, nama: 'Minggu 1', mulai: '2026-10-01', selesai: '2026-10-07', nominal: 3000, status: 'aktif' },
    { id: 2, nama: 'Minggu 2', mulai: '2026-10-08', selesai: '2026-10-14', nominal: 3000, status: 'aktif' },
  ],
  tagihan: [],
  pembayaran: [],
  nextPembayaranId: 1,
  pengaturan: {
    metode: [
      { id: 1, tipe: 'bank',    nama: 'BCA',      nomor: '1234567890',  atasNama: 'Bendahara SI-26', catatan: '' },
      { id: 2, tipe: 'ewallet', nama: 'Dana',     nomor: '08123456789', atasNama: 'Bendahara SI-26', catatan: '' },
      { id: 3, tipe: 'ewallet', nama: 'OVO',      nomor: '08123456789', atasNama: 'Bendahara SI-26', catatan: '' },
    ],
    nextMetodeId: 4,
    catatanGlobal: 'Tulis NIM lo di berita transfer',
  },
};

function seedUsers() {
  const nama = [
    'Mutia Carinna','Cika Oktaviani','Winda Aulia','Rafli Akram Fakhir',
    'Sabian Mugis Prama Putra','Rian Fahmi','Abrar Danendra Kurnia Putra','Najua Hamidah',
    'Ahmad Faiz Zakaria','Eli Nur Aulia','Muhamad Muslim Al-Hanif','Dhiyarachman Maula',
    'Alifiya Fakhirani Hermawan','Alyatur Rofiah','Maulana Septian','Mozza Saskia Ramanaya',
    'Apiat Abiansyah','Abdurrohman','Farrel Omar Kadarsyah','M.Hafidz Aulia Saputra',
    'Erma Dwi Melinda','Dayana Maya Lestari','Anisa Aulia','M. Jusan Bahrudin',
    'Muhamad nazril saepulrohman','Wisnu Prameswira Jati','Muhammad Zidan Ar Rizki','Ridwan Hakim',
    'Naisyra Mazeela Putri Yusman','Muhammad Rizqy Nur Ramadhani','Cantik Rahmi Shofiyanti','Ahmad Nurul Fajar',
    'Rishy Khoerunnisa','Mutiara Marsandia','Muhammad Bagus Aliyy Rahman','Muhammad Dzaki Al Hassani Ihsan',
    "Muhamad Fuadi Ma'suf",'Naufal Maulid Abu Fakhri','Farid Junaidi','Radel Virdiana',
    'Azza Ummu Habibatulloh','Alya Syahla','Tia Eryanti','Nisa Aprilia',
    'Dieria Febrianti','Muhamad Hassan Musajid','Dzaki Abdurrahman',
  ];

  const users = [
    { nim: '251572010001', nama: 'Bendahara SI-26', password: 'password', isBendahara: true },
  ];

  nama.forEach((n, i) => {
    const no = String(i + 2).padStart(3, '0');
    users.push({
      nim: `25157201${no}`,
      nama: n,
      password: 'password',
      isBendahara: false,
    });
  });

  return users;
}

function seedTagihan(users) {
  const tagihan = [];
  let id = 1;
  users.forEach(u => {
    if (u.isBendahara) return;
    DEFAULT_DATA.periode.forEach(p => {
      tagihan.push({
        id: id++,
        nim: u.nim,
        periodeId: p.id,
        nominal: p.nominal,
        status: 'belum',
      });
    });
  });
  return tagihan;
}

// ---------- STORAGE ----------
let DB = {};
const DB_VERSION = 5;

function loadDB() {
  const raw = localStorage.getItem('kas_kelas_db');
  const savedVersion = parseInt(localStorage.getItem('kas_kelas_version') || '0');

  if (!raw || savedVersion !== DB_VERSION) {
    DB = JSON.parse(JSON.stringify(DEFAULT_DATA));
    DB.users = seedUsers();
    DB.tagihan = seedTagihan(DB.users);
    saveDB();
    localStorage.setItem('kas_kelas_version', DB_VERSION);
    localStorage.removeItem('kas_kelas_session');
    return;
  }

  DB = JSON.parse(raw);

  const seedCount = seedUsers().length;
  if (DB.users.length !== seedCount) {
    DB = JSON.parse(JSON.stringify(DEFAULT_DATA));
    DB.users = seedUsers();
    DB.tagihan = seedTagihan(DB.users);
    saveDB();
    localStorage.setItem('kas_kelas_version', DB_VERSION);
    localStorage.removeItem('kas_kelas_session');
  }
}
function saveDB() {
  localStorage.setItem('kas_kelas_db', JSON.stringify(DB));
}

// ---------- STATE ----------
let CURRENT_USER = null;
let SELECTED_USER = null;
let LOGIN_MODE = 'mhs';
let currentView = 'mhs';
let TAGIHAN_AKTIF = null;
let VERIFY_ID = null;
let METODE_TERPILIH = null;
let METODE_EDIT_ID = null;
let METODE_QRIS_TEMP = null;

function loadSession() {
  const raw = localStorage.getItem('kas_kelas_session');
  if (raw) CURRENT_USER = JSON.parse(raw);
}
function saveSession() {
  if (CURRENT_USER) {
    localStorage.setItem('kas_kelas_session', JSON.stringify(CURRENT_USER));
  } else {
    localStorage.removeItem('kas_kelas_session');
  }
}

// ---------- UTILS ----------
function rupiah(n) {
  return 'Rp' + n.toLocaleString('id-ID');
}
function formatTanggal(iso) {
  const d = new Date(iso);
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2800);
}
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast('📋 Tersalin!')).catch(() => {});
  }
}
function tipeIcon(tipe) {
  if (tipe === 'bank') return '🏦';
  if (tipe === 'ewallet') return '💳';
  if (tipe === 'qris') return '📱';
  return '💰';
}
function tipeLabel(tipe) {
  if (tipe === 'bank') return 'BANK';
  if (tipe === 'ewallet') return 'E-WALLET';
  if (tipe === 'qris') return 'QRIS';
  return 'LAINNYA';
}

// ---------- LOGIN MODE ----------
function setLoginMode(mode) {
  LOGIN_MODE = mode;
  document.getElementById('login-mhs').classList.toggle('hidden', mode !== 'mhs');
  document.getElementById('login-bendahara').classList.toggle('hidden', mode !== 'bendahara');
  document.getElementById('toggle-link').textContent =
    mode === 'mhs' ? 'Login sebagai Bendahara →' : '← Balik ke pilih nama';
}

function toggleMode(e) {
  e.preventDefault();
  setLoginMode(LOGIN_MODE === 'mhs' ? 'bendahara' : 'mhs');
}

// ---------- NAMA LIST ----------
function renderNamaList(keyword = '') {
  const list = document.getElementById('nama-list');
  const counter = document.getElementById('nama-count');
  const kw = keyword.toLowerCase().trim();

  const mahasiswa = DB.users.filter(u => !u.isBendahara);
  const filtered = kw
    ? mahasiswa.filter(u => u.nama.toLowerCase().includes(kw) || u.nim.includes(kw))
    : mahasiswa;

  if (counter) {
    counter.textContent = kw
      ? `${filtered.length} DITEMUKAN`
      : `${mahasiswa.length} MAHASISWA`;
  }

  if (filtered.length === 0) {
    list.innerHTML = '<div class="nama-empty">Nama gak ketemu 🤔<br>Coba kata kunci lain</div>';
    return;
  }

  list.innerHTML = filtered.map((u, i) => {
    const initial = u.nama.charAt(0).toUpperCase();
    const colorClass = `avatar-c${(i % 8) + 1}`;

    return `
      <div class="nama-item ${SELECTED_USER?.nim === u.nim ? 'selected' : ''}"
           onclick="pilihNama('${u.nim}')">
        <div class="nama-avatar ${colorClass}">${initial}</div>
        <div class="nama-text-wrap">
          <div class="nama-text">${escapeHtml(u.nama)}</div>
          <div class="nama-nim">${u.nim}</div>
        </div>
        <div class="nama-check">✓</div>
      </div>
    `;
  }).join('');
}

function filterNama() {
  renderNamaList(document.getElementById('search-nama').value);
}

function pilihNama(nim) {
  SELECTED_USER = DB.users.find(u => u.nim === nim);
  document.getElementById('btn-masuk-mhs').disabled = false;
  renderNamaList(document.getElementById('search-nama').value);
}

function loginMhs() {
  if (!SELECTED_USER) return;
  CURRENT_USER = SELECTED_USER;
  saveSession();
  go('mhs');
}

function loginBendahara() {
  const nim = document.getElementById('login-nim').value.trim();
  const pass = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');

  const user = DB.users.find(u => u.nim === nim && u.password === pass && u.isBendahara);
  if (!user) {
    err.textContent = 'NIM atau password salah.';
    err.classList.remove('hidden');
    return;
  }
  err.classList.add('hidden');
  CURRENT_USER = user;
  saveSession();
  go('bendahara');
}

function doLogout() {
  CURRENT_USER = null;
  SELECTED_USER = null;
  saveSession();
  document.getElementById('search-nama').value = '';
  document.getElementById('login-nim').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('btn-masuk-mhs').disabled = true;
  setLoginMode('mhs');
  renderNamaList('');
  go('login');
}

// ---------- NAV ----------
const MENU_MHS = [
  { id: 'mhs',   label: 'Dashboard', icon: '◈' },
  { id: 'bayar', label: 'Bayar Kas', icon: '◆' },
];
const MENU_BENDAHARA = [
  { id: 'bendahara',  label: 'Dashboard',  icon: '◈' },
  { id: 'pengaturan', label: 'Pengaturan', icon: '⚙' },
];

function renderNav() {
  if (!CURRENT_USER) return;
  const menu = CURRENT_USER.isBendahara ? MENU_BENDAHARA : MENU_MHS;

  const nav = document.getElementById('sidebar-nav');
  const bottomNav = document.getElementById('bottom-nav');

  nav.innerHTML = menu.map(m => `
    <div class="nav-item ${m.id === currentView ? 'active' : ''}" onclick="go('${m.id}')">
      <span class="nav-icon">${m.icon}</span>
      <span>${m.label}</span>
    </div>
  `).join('');

  bottomNav.innerHTML = menu.map(m => `
    <div class="nav-item ${m.id === currentView ? 'active' : ''}" onclick="go('${m.id}')">
      <span class="nav-icon">${m.icon}</span>
      <span>${m.label}</span>
    </div>
  `).join('');

  document.getElementById('side-avatar').textContent = CURRENT_USER.nama.charAt(0).toUpperCase();
  document.getElementById('side-name').textContent = CURRENT_USER.nama;
  document.getElementById('side-role').textContent = CURRENT_USER.isBendahara ? 'Bendahara' : 'Mahasiswa';

  const today = new Date();
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const dateStr = `${today.getDate()} ${bulan[today.getMonth()]} ${today.getFullYear()}`;
  const d1 = document.getElementById('topbar-date');
  const d2 = document.getElementById('topbar-date-2');
  if (d1) d1.textContent = dateStr;
  if (d2) d2.textContent = dateStr;
}

// ---------- ROUTING ----------
function go(page) {
  if (page === 'login') {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-login').classList.add('active');
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-app').classList.add('active');

  let viewId = 'view-' + page;
  if (page === 'mhs' || page === 'bendahara' || page === 'bayar' || page === 'pengaturan') {
    currentView = page;
  } else {
    currentView = CURRENT_USER?.isBendahara ? 'bendahara' : 'mhs';
    viewId = 'view-' + currentView;
  }

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.add('active');

  renderNav();

  if (page === 'mhs') renderMhsDashboard();
  if (page === 'bendahara') renderBendaharaDashboard();
  if (page === 'bayar') renderBayarPage();
  if (page === 'pengaturan') renderPengaturan();

  window.scrollTo(0, 0);
}

function backToDashboard() {
  go(CURRENT_USER.isBendahara ? 'bendahara' : 'mhs');
}

// ---------- DASHBOARD MAHASISWA ----------
function renderMhsDashboard() {
  document.getElementById('mhs-greeting').textContent = `Halo, ${CURRENT_USER.nama} 👋`;

  const tagihanSaya = DB.tagihan.filter(t => t.nim === CURRENT_USER.nim);
  const totalBayar = tagihanSaya.filter(t => t.status === 'lunas').reduce((s,t) => s + t.nominal, 0);
  const tunggakan = tagihanSaya.filter(t => t.status === 'belum' || t.status === 'ditolak').reduce((s,t) => s + t.nominal, 0);
  const lunasCount = tagihanSaya.filter(t => t.status === 'lunas').length;

  document.getElementById('mhs-total-bayar').textContent = rupiah(totalBayar);
  document.getElementById('mhs-tunggakan').textContent = rupiah(tunggakan);
  document.getElementById('mhs-lunas-count').textContent = `${lunasCount}/${tagihanSaya.length}`;
  document.getElementById('mhs-tunggakan-sub').textContent = tunggakan > 0 ? '⚠ perlu dibayar' : '✓ aman';
  document.getElementById('mhs-lunas-sub').textContent = tagihanSaya.length
    ? `${Math.round((lunasCount / tagihanSaya.length) * 100)}% selesai`
    : '—';

  const prioritas = tagihanSaya.find(t => t.status === 'belum' || t.status === 'ditolak')
                 || tagihanSaya.find(t => t.status === 'menunggu_verifikasi');
  const heroEl = document.getElementById('mhs-hero');

  if (prioritas) {
    const p = DB.periode.find(x => x.id === prioritas.periodeId);
    let badge = '❌ Belum Bayar';
    let badgeClass = 'status-belum';
    if (prioritas.status === 'menunggu_verifikasi') { badge = '🟡 Menunggu Verifikasi'; badgeClass = 'status-pending'; }
    if (prioritas.status === 'ditolak') { badge = '🔴 Ditolak'; badgeClass = 'status-ditolak'; }
    const canPay = prioritas.status === 'belum' || prioritas.status === 'ditolak';

    heroEl.innerHTML = `
      <div class="hero-tagihan-info">
        <div>
          <div class="hero-label">Tagihan Periode Ini</div>
          <div class="hero-periode">${p.nama} · ${formatTanggal(p.mulai)} – ${formatTanggal(p.selesai)}</div>
          <div class="hero-value">${rupiah(prioritas.nominal)}</div>
          <div style="margin-top:14px"><span class="card-status ${badgeClass}">${badge}</span></div>
        </div>
        ${canPay ? `<button class="btn-primary" style="width:auto;padding:14px 28px;margin-top:0" onclick="bukaBayar(${prioritas.id})">Bayar Sekarang</button>` : ''}
      </div>
    `;
  } else {
    heroEl.innerHTML = `
      <div class="hero-tagihan-info">
        <div>
          <div class="hero-label">Status Kas</div>
          <div class="hero-value">Lunas ✓</div>
          <div style="color:var(--text-soft);margin-top:8px;font-size:13px">Semua tagihan lo sudah beres. Mantap!</div>
        </div>
      </div>
    `;
  }

  const list = document.getElementById('mhs-periode-list');
  if (tagihanSaya.length === 0) {
    list.innerHTML = '<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:20px">Belum ada tagihan</div>';
  } else {
    list.innerHTML = tagihanSaya.map(t => {
      const p = DB.periode.find(x => x.id === t.periodeId);
      if (!p) return '';
      let badgeClass = 'status-belum';
      let badgeText = '❌ Belum';
      if (t.status === 'lunas') { badgeClass = 'status-lunas'; badgeText = '✅ Lunas'; }
      if (t.status === 'menunggu_verifikasi') { badgeClass = 'status-pending'; badgeText = '🟡 Menunggu'; }
      if (t.status === 'ditolak') { badgeClass = 'status-ditolak'; badgeText = '🔴 Ditolak'; }

      return `
        <div class="tagihan-item">
          <div class="tgl">${p.nama} · ${formatTanggal(p.mulai)} – ${formatTanggal(p.selesai)}</div>
          <div class="nom">${rupiah(t.nominal)}</div>
          <span class="card-status ${badgeClass}">${badgeText}</span>
        </div>
      `;
    }).join('');
  }

  const activity = document.getElementById('mhs-activity');
  const myPembayaran = DB.pembayaran
    .filter(p => p.nim === CURRENT_USER.nim)
    .sort((a,b) => b.id - a.id)
    .slice(0, 6);

  if (myPembayaran.length === 0) {
    activity.innerHTML = '<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:20px">Belum ada aktivitas</div>';
  } else {
    activity.innerHTML = myPembayaran.map(p => {
      const tag = DB.tagihan.find(t => t.id === p.tagihanId);
      const per = tag ? DB.periode.find(x => x.id === tag.periodeId) : null;
      let dotClass = 'gold';
      let text = '';
      if (p.status === 'disetujui') { dotClass = 'green'; text = `Pembayaran ${per?.nama} disetujui`; }
      else if (p.status === 'ditolak') { dotClass = 'rose'; text = `Bukti ${per?.nama} ditolak`; }
      else { text = `Bukti ${per?.nama} dikirim, menunggu verifikasi`; }

      return `
        <div class="activity-item">
          <div class="activity-dot ${dotClass}"></div>
          <div class="activity-body">
            <div class="activity-text">${text}</div>
            <div class="activity-time">${rupiah(p.nominal)}</div>
          </div>
        </div>
      `;
    }).join('');
  }
}

// ---------- DASHBOARD BENDAHARA ----------
function renderBendaharaDashboard() {
  const periodeAktif = DB.periode.find(p => p.status === 'aktif');
  if (!periodeAktif) return;

  const tagihanPeriode = DB.tagihan.filter(t => t.periodeId === periodeAktif.id);
  const sudahBayarArr = tagihanPeriode.filter(t => t.status === 'lunas');
  const belumArr = tagihanPeriode.filter(t => t.status === 'belum');
  const totalTerkumpul = sudahBayarArr.reduce((s,t) => s + t.nominal, 0);
  const pendingCount = DB.pembayaran.filter(p => p.status === 'menunggu').length;
  const persen = tagihanPeriode.length
    ? Math.round((sudahBayarArr.length / tagihanPeriode.length) * 100)
    : 0;

  document.getElementById('bend-total').textContent = rupiah(totalTerkumpul);
  document.getElementById('bend-periode-badge').textContent = `${periodeAktif.nama} · ${formatTanggal(periodeAktif.mulai)}`;
  document.getElementById('bend-progress-fill').style.width = persen + '%';
  document.getElementById('bend-progress-text').textContent = `${sudahBayarArr.length} / ${tagihanPeriode.length} mahasiswa`;
  document.getElementById('bend-progress-percent').textContent = persen + '%';

  document.getElementById('bend-sudah').textContent = `${sudahBayarArr.length}/${tagihanPeriode.length}`;
  document.getElementById('bend-pending').textContent = pendingCount;
  document.getElementById('bend-belum').textContent = belumArr.length;
  document.getElementById('bend-terkumpul').textContent = rupiah(totalTerkumpul);
  document.getElementById('bend-pending-badge').textContent = pendingCount;

  const pendingList = document.getElementById('bend-pending-list');
  const pendings = DB.pembayaran.filter(p => p.status === 'menunggu');
  if (pendings.length === 0) {
    pendingList.innerHTML = '<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:24px">✨ Tidak ada antrian verifikasi</div>';
  } else {
    pendingList.innerHTML = pendings.map(p => {
      const user = DB.users.find(u => u.nim === p.nim);
      const tag = DB.tagihan.find(t => t.id === p.tagihanId);
      const per = DB.periode.find(x => x.id === tag.periodeId);
      return `
        <div class="list-item">
          <div class="info">
            <div class="nama">${escapeHtml(user.nama)}</div>
            <div class="nim">${user.nim} · ${per.nama} · ${rupiah(p.nominal)}</div>
          </div>
          <button class="btn-small btn-success" onclick="openVerify(${p.id})">Verifikasi</button>
        </div>
      `;
    }).join('');
  }

  const tagihanList = document.getElementById('bend-tagihan-list');
  tagihanList.innerHTML = tagihanPeriode.map(t => {
    const u = DB.users.find(x => x.nim === t.nim);
    let s = '❌';
    if (t.status === 'lunas') s = '✅';
    if (t.status === 'menunggu_verifikasi') s = '🟡';
    if (t.status === 'ditolak') s = '🔴';
    return `
      <div class="list-item">
        <div class="info">
          <div class="nama">${escapeHtml(u.nama)}</div>
          <div class="nim">${u.nim}</div>
        </div>
        <div style="font-size:18px">${s}</div>
      </div>
    `;
  }).join('');
}

// ---------- BAYAR ----------
function bukaBayar(tagihanId) {
  TAGIHAN_AKTIF = DB.tagihan.find(t => t.id === tagihanId);
  const metode = DB.pengaturan?.metode || [];
  METODE_TERPILIH = metode.length > 0 ? metode[0].id : null;
  go('bayar');
}

function renderBayarPage() {
  if (!TAGIHAN_AKTIF) return;
  const p = DB.periode.find(x => x.id === TAGIHAN_AKTIF.periodeId);
  document.getElementById('bayar-periode').textContent = `${p.nama} · ${formatTanggal(p.mulai)} – ${formatTanggal(p.selesai)}`;
  document.getElementById('bayar-nominal-display').textContent = rupiah(TAGIHAN_AKTIF.nominal);
  document.getElementById('bayar-nominal').value = TAGIHAN_AKTIF.nominal;
  document.getElementById('bayar-file').value = '';
  document.getElementById('bayar-catatan').value = '';

  const metode = DB.pengaturan?.metode || [];
  const grid = document.getElementById('metode-grid');

  if (metode.length === 0) {
    grid.innerHTML = '';
    document.getElementById('metode-detail').innerHTML = `
      <div class="info-box" style="text-align:center">
        <div style="font-size:28px;margin-bottom:8px;opacity:0.6">💳</div>
        Belum ada metode pembayaran yang disetup.<br>
        Hubungi bendahara dulu ya.
      </div>
    `;
    return;
  }

  if (!metode.find(m => m.id === METODE_TERPILIH)) {
    METODE_TERPILIH = metode[0].id;
  }

  grid.innerHTML = metode.map(m => `
    <div class="metode-card ${METODE_TERPILIH === m.id ? 'selected' : ''}" onclick="pilihMetode(${m.id})">
      <span class="metode-icon">${tipeIcon(m.tipe)}</span>
      <div class="metode-name">${escapeHtml(m.nama)}</div>
      <div class="metode-tipe-label">${tipeLabel(m.tipe)}</div>
    </div>
  `).join('');

  renderMetodeDetail();
}

function pilihMetode(id) {
  METODE_TERPILIH = id;
  document.querySelectorAll('.metode-card').forEach((el, i) => {
    const metode = DB.pengaturan.metode[i];
    el.classList.toggle('selected', metode && metode.id === id);
  });
  renderMetodeDetail();
}

function renderMetodeDetail() {
  const m = DB.pengaturan.metode.find(x => x.id === METODE_TERPILIH);
  const detail = document.getElementById('metode-detail');

  if (!m) {
    detail.innerHTML = '';
    return;
  }

  const catatan = DB.pengaturan.catatanGlobal || '';

  if (m.tipe === 'qris') {
    if (m.qrisImage) {
      detail.innerHTML = `
        <div class="qris-box">
          <img src="${m.qrisImage}" alt="QRIS ${escapeHtml(m.nama)}">
          <div class="qris-caption">Scan pakai m-banking / e-wallet</div>
        </div>
        ${m.catatan ? `<div class="qris-hint">${escapeHtml(m.catatan)}</div>` : ''}
        ${catatan ? `<div class="qris-hint">${escapeHtml(catatan)}</div>` : ''}
      `;
    } else {
      detail.innerHTML = `<div class="info-box" style="text-align:center">QRIS belum di-upload</div>`;
    }
    return;
  }

  detail.innerHTML = `
    <div class="info-box">
      <div class="copy-row">
        <div>
          <div class="copy-label">${tipeLabel(m.tipe)}</div>
          <div class="copy-value">${escapeHtml(m.nama)}</div>
        </div>
      </div>
      <div class="copy-row">
        <div style="flex:1;min-width:0">
          <div class="copy-label">Nomor</div>
          <div class="copy-value">${escapeHtml(m.nomor)}</div>
        </div>
        <button class="btn-icon-sm" onclick="copyText('${escapeHtml(m.nomor)}')" title="Copy">📋</button>
      </div>
      <div class="copy-row">
        <div>
          <div class="copy-label">Atas Nama</div>
          <div class="copy-value">${escapeHtml(m.atasNama)}</div>
        </div>
      </div>
      ${m.catatan ? `<div style="padding-top:10px;font-size:12px;color:var(--text-dim);font-style:italic">${escapeHtml(m.catatan)}</div>` : ''}
      ${catatan ? `<div style="padding-top:8px;font-size:12px;color:var(--text-dim);font-style:italic">${escapeHtml(catatan)}</div>` : ''}
    </div>
  `;
}

function submitBukti() {
  const nominal = parseInt(document.getElementById('bayar-nominal').value);
  const fileInput = document.getElementById('bayar-file');
  const catatan = document.getElementById('bayar-catatan').value;

  if (!fileInput.files[0]) {
    toast('Pilih file bukti transfer dulu');
    return;
  }
  if (!nominal || nominal <= 0) {
    toast('Nominal tidak valid');
    return;
  }

  const metode = DB.pengaturan.metode.find(x => x.id === METODE_TERPILIH);
  const metodeInfo = metode ? `${metode.nama} (${tipeLabel(metode.tipe)})` : '-';

  const reader = new FileReader();
  reader.onload = function(e) {
    DB.pembayaran.push({
      id: DB.nextPembayaranId++,
      tagihanId: TAGIHAN_AKTIF.id,
      nim: CURRENT_USER.nim,
      bukti: e.target.result,
      nominal: nominal,
      catatan: catatan,
      metode: metodeInfo,
      status: 'menunggu',
      verifiedBy: null,
      verifiedAt: null,
    });
    TAGIHAN_AKTIF.status = 'menunggu_verifikasi';
    saveDB();
    toast('✅ Bukti terkirim! Menunggu verifikasi bendahara.');
    go('mhs');
  };
  reader.readAsDataURL(fileInput.files[0]);
}

// ---------- VERIFIKASI ----------
function openVerify(pembayaranId) {
  VERIFY_ID = pembayaranId;
  const p = DB.pembayaran.find(x => x.id === pembayaranId);
  const user = DB.users.find(u => u.nim === p.nim);
  const tag = DB.tagihan.find(t => t.id === p.tagihanId);
  const per = DB.periode.find(x => x.id === tag.periodeId);

  document.getElementById('verify-content').innerHTML = `
    <p><strong>${escapeHtml(user.nama)}</strong></p>
    <p style="color:var(--text-dim);font-size:12px;font-family:monospace">${user.nim}</p>
    <p style="margin-top:14px;font-family:Fraunces,serif;font-size:15px">${per.nama} · ${rupiah(p.nominal)}</p>
    ${p.metode ? `<p style="font-size:12px;color:var(--gold-soft);margin-top:4px">Metode: ${escapeHtml(p.metode)}</p>` : ''}
    ${p.catatan ? `<p style="font-size:12px;color:var(--text-dim);margin-top:4px">Catatan: ${escapeHtml(p.catatan)}</p>` : ''}
    <img src="${p.bukti}" class="bukti-img" alt="Bukti transfer">
  `;
  document.getElementById('modal-verify').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-verify').classList.remove('active');
  VERIFY_ID = null;
}

function approveBukti() {
  const p = DB.pembayaran.find(x => x.id === VERIFY_ID);
  p.status = 'disetujui';
  p.verifiedBy = CURRENT_USER.nim;
  p.verifiedAt = new Date().toISOString();

  const tag = DB.tagihan.find(t => t.id === p.tagihanId);
  tag.status = 'lunas';

  DB.pembayaran.forEach(x => {
    if (x.tagihanId === tag.id && x.id !== p.id && x.status === 'menunggu') {
      x.status = 'ditolak';
    }
  });

  saveDB();
  closeModal();
  toast('✅ Pembayaran disetujui!');
  renderBendaharaDashboard();
}

function rejectBukti() {
  const alasan = prompt('Alasan penolakan:');
  if (!alasan) return;

  const p = DB.pembayaran.find(x => x.id === VERIFY_ID);
  p.status = 'ditolak';
  p.verifiedBy = CURRENT_USER.nim;
  p.verifiedAt = new Date().toISOString();
  p.alasanTolak = alasan;

  const tag = DB.tagihan.find(t => t.id === p.tagihanId);
  tag.status = 'ditolak';

  saveDB();
  closeModal();
  toast('❌ Bukti ditolak');
  renderBendaharaDashboard();
}

// ---------- PENGATURAN ----------
function renderPengaturan() {
  renderMetodeList();
  document.getElementById('setting-catatan').value = DB.pengaturan.catatanGlobal || '';
  hideMetodeForm();
}

function renderMetodeList() {
  const list = document.getElementById('metode-list');
  const metode = DB.pengaturan.metode || [];
  document.getElementById('metode-count').textContent = metode.length;

  if (metode.length === 0) {
    list.innerHTML = `
      <div class="metode-empty">
        <div style="font-size:28px;margin-bottom:8px;opacity:0.5">💳</div>
        Belum ada metode pembayaran.<br>
        Klik <strong>+ Tambah Metode</strong> buat mulai.
      </div>
    `;
    return;
  }

  list.innerHTML = metode.map(m => {
    let sub = '';
    if (m.tipe === 'qris') {
      sub = m.qrisImage ? '✓ QRIS ter-upload' : '⚠ QRIS belum di-upload';
    } else {
      sub = `${m.nomor || '-'} · ${m.atasNama || '-'}`;
    }

    return `
      <div class="setting-metode-item">
        <div class="setting-metode-info">
          <div class="setting-metode-icon">${tipeIcon(m.tipe)}</div>
          <div class="setting-metode-text">
            <div class="setting-metode-name">${escapeHtml(m.nama)}</div>
            <div class="setting-metode-sub">${escapeHtml(sub)}</div>
          </div>
        </div>
        <div class="setting-metode-actions">
          <button class="btn-icon-sm" onclick="showMetodeForm(${m.id})" title="Edit">✎</button>
          <button class="btn-icon-sm danger" onclick="deleteMetode(${m.id})" title="Hapus">🗑</button>
        </div>
      </div>
    `;
  }).join('');
}

function showMetodeForm(id = null) {
  METODE_EDIT_ID = id;
  METODE_QRIS_TEMP = null;

  const form = document.getElementById('metode-form');
  const title = document.getElementById('metode-form-title');

  if (id) {
    const m = DB.pengaturan.metode.find(x => x.id === id);
    if (!m) return;

    title.textContent = 'Edit Metode';
    document.getElementById('metode-id').value = m.id;
    document.getElementById('metode-tipe').value = m.tipe;
    document.getElementById('metode-nama').value = m.nama || '';
    document.getElementById('metode-nomor').value = m.nomor || '';
    document.getElementById('metode-atasnama').value = m.atasNama || '';
    document.getElementById('metode-catatan').value = m.catatan || '';
    document.getElementById('metode-qris-file').value = '';
    METODE_QRIS_TEMP = m.qrisImage || null;
  } else {
    title.textContent = 'Tambah Metode';
    document.getElementById('metode-id').value = '';
    document.getElementById('metode-tipe').value = 'bank';
    document.getElementById('metode-nama').value = '';
    document.getElementById('metode-nomor').value = '';
    document.getElementById('metode-atasnama').value = '';
    document.getElementById('metode-catatan').value = '';
    document.getElementById('metode-qris-file').value = '';
  }

  onMetodeTipeChange();
  renderQrisPreviewForm();
  form.classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideMetodeForm() {
  document.getElementById('metode-form').classList.add('hidden');
  METODE_EDIT_ID = null;
  METODE_QRIS_TEMP = null;
}

function onMetodeTipeChange() {
  const tipe = document.getElementById('metode-tipe').value;
  const nomorGroup = document.getElementById('metode-nomor-group');
  const qrisGroup = document.getElementById('metode-qris-group');

  if (tipe === 'qris') {
    nomorGroup.classList.add('hidden');
    qrisGroup.classList.remove('hidden');
  } else {
    nomorGroup.classList.remove('hidden');
    qrisGroup.classList.add('hidden');
  }
}

function onQrisUpload(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    toast('Ukuran gambar max 2MB');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    METODE_QRIS_TEMP = e.target.result;
    renderQrisPreviewForm();
    toast('Preview QRIS siap');
  };
  reader.readAsDataURL(file);
}

function renderQrisPreviewForm() {
  const area = document.getElementById('metode-qris-preview');
  if (METODE_QRIS_TEMP) {
    area.innerHTML = `
      <div class="qris-preview">
        <img src="${METODE_QRIS_TEMP}" alt="Preview QRIS">
      </div>
    `;
  } else {
    area.innerHTML = '';
  }
}

function saveMetode() {
  const tipe = document.getElementById('metode-tipe').value;
  const nama = document.getElementById('metode-nama').value.trim();
  const nomor = document.getElementById('metode-nomor').value.trim();
  const atasNama = document.getElementById('metode-atasnama').value.trim();
  const catatan = document.getElementById('metode-catatan').value.trim();

  if (!nama) {
    toast('Isi nama metode dulu');
    return;
  }

  if (tipe === 'qris') {
    if (!METODE_QRIS_TEMP) {
      toast('Upload gambar QRIS dulu');
      return;
    }
  } else {
    if (!nomor || !atasNama) {
      toast('Isi nomor & atas nama');
      return;
    }
  }

  const id = document.getElementById('metode-id').value;

  const metodeData = {
    id: id ? parseInt(id) : DB.pengaturan.nextMetodeId++,
    tipe,
    nama,
    nomor: tipe === 'qris' ? '' : nomor,
    atasNama: tipe === 'qris' ? '' : atasNama,
    catatan,
    qrisImage: tipe === 'qris' ? METODE_QRIS_TEMP : null,
  };

  if (id) {
    const idx = DB.pengaturan.metode.findIndex(x => x.id === parseInt(id));
    if (idx !== -1) DB.pengaturan.metode[idx] = metodeData;
  } else {
    DB.pengaturan.metode.push(metodeData);
  }

  saveDB();
  toast('✅ Metode tersimpan!');
  hideMetodeForm();
  renderMetodeList();
}

function deleteMetode(id) {
  const m = DB.pengaturan.metode.find(x => x.id === id);
  if (!m) return;
  if (!confirm(`Hapus metode "${m.nama}"?`)) return;

  DB.pengaturan.metode = DB.pengaturan.metode.filter(x => x.id !== id);
  saveDB();
  toast('🗑 Metode dihapus');
  renderMetodeList();
}

function saveCatatanGlobal() {
  DB.pengaturan.catatanGlobal = document.getElementById('setting-catatan').value.trim();
  saveDB();
  toast('✅ Catatan tersimpan!');
}

// ---------- INIT ----------
loadDB();
loadSession();

if (CURRENT_USER) {
  if (CURRENT_USER.isBendahara) go('bendahara');
  else go('mhs');
} else {
  setLoginMode('mhs');
  renderNamaList('');
  go('login');
}

document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') loginBendahara();
});
