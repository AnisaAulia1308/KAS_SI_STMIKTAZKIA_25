// ==========================================
// KAS KELAS SI-25 — Integrasi Supabase
// ==========================================

// 🔑 CREDENTIAL SUPABASE PROJECT SETTINGS -> API
const SUPABASE_URL = 'https://dvkbfbbpqqucvnqohano.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2a2JmYmJwcXF1Y3ZucW9oYW5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MTY0NjIsImV4cCI6MjEwNjM5MjQ2Mn0.-k2kFM1d8JdoZSbbC7UaQSovm-W1I16kGawBT6QidkI';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- STATE LOCAL ----------
let CURRENT_USER = null;
let SELECTED_USER = null;
let LOGIN_MODE = 'mhs';
let currentView = 'mhs';
let TAGIHAN_TERPILIH_IDS = [];
let VERIFY_ID = null;
let METODE_TERPILIH = null;
let METODE_EDIT_ID = null;
let METODE_QRIS_FILE = null;

// Cache Data Ringkas
let DB_USERS = [];
let DB_PERIODE = [];
let DB_TAGIHAN = [];
let DB_PEMBAYARAN = [];
let DB_METODE = [];
let CATATAN_GLOBAL = '';

// ---------- UTILS ----------
function rupiah(n) {
  return 'Rp' + (n || 0).toLocaleString('id-ID');
}

function formatTanggal(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
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

/* ============================================
   Download QRIS — bisa offline, ramah HP
   ============================================ */
async function downloadQRIS() {
  const m = DB_METODE.find(x => x.id === METODE_TERPILIH);
  if (!m || !m.qris_image_url) {
    toast('QRIS belum di-upload');
    return;
  }

  const btn = document.querySelector('.btn-download-qris');
  const originalHTML = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Menyiapkan...';
  }

  // Nama file rapi: QRIS-Kas-SI25-NamaMetode.png
  const safeName = (m.nama || 'QRIS')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const filename = `QRIS-Kas-SI25-${safeName}.png`;

  try {
    // Metode 1: fetch → blob → download (paling clean)
    const res = await fetch(m.qris_image_url, { mode: 'cors' });
    if (!res.ok) throw new Error('Fetch gagal: ' + res.status);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename);

    // Bersihkan memory setelah 2 detik
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    toast('✅ QRIS berhasil di-download');
  } catch (err) {
    console.warn('[QRIS] fetch gagal, pakai fallback:', err);

    // Metode 2: fallback buka di tab baru
    try {
      const win = window.open(m.qris_image_url, '_blank');
      if (!win) {
        // Popup diblokir — pakai anchor biasa
        triggerDownload(m.qris_image_url, filename);
        toast('💡 Klik kanan / long-press → Save Image');
      } else {
        toast('💡 Long-press gambar → Simpan');
      }
    } catch (e2) {
      // Metode 3: last resort — buka direct
      window.location.href = m.qris_image_url;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }
}

/* Helper: trigger download dari URL/blob URL */
function triggerDownload(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

window.downloadQRIS = downloadQRIS;

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

// ---------- SEED DATA ----------
async function checkAndSeedUsers() {
  const { data: users, error } = await supabaseClient.from('users').select('*');
  if (error) {
    console.error("Error fetching users:", error);
    return;
  }

  if (users.length === 0) {
    const bendaharaList = [
      { nim: 'anisabendaharacantik', nama: 'Bendahara Cantik', password: 'faktabngt', is_bendahara: true },
      { nim: 'mozza', nama: 'Mozza Saskia Ramanaya', password: 'bendaharaaja', is_bendahara: true },
    ];

    const namaMhs = [
      'Mutia Carinna','Cika Oktaviani','Winda Aulia','Rafli Akram Fakhir',
      'Sabian Mugis Prama Putra','Rian Fahmi','Abrar Danendra Kurnia Putra','Najua Hamidah',
      'Ahmad Faiz Zakaria','Eli Nur Aulia','Muhamad Muslim Al-Hanif','Dhiyarachman Maula',
      'Alifiya Fakhirani Hermawan','Alyatur Rofiah','Maulana Septian',
      'Apiat Abiansyah','Abdurrohman','Farrel Omar Kadarsyah','M.Hafidz Aulia Saputra',
      'Erma Dwi Melinda','Dayana Maya Lestari','Anisa Aulia','M. Jusan Bahrudin',
      'Muhamad nazril saepulrohman','Wisnu Prameswira Jati','Muhammad Zidan Ar Rizki','Ridwan Hakim',
      'Naisyra Mazeela Putri Yusman','Muhammad Rizqy Nur Ramdhani','Cantik Rahmi Shofiyanti','Ahmad Nurul Fajar',
      'Rishy Khoerunnisa','Mutiara Marsandia','Muhammad Bagus Aliyy Rahman','Muhammad Dzaki Al Hassani Ihsan',
      "Muhamad Fuadi Ma'suf",'Naufal Maulid Abu Fakhri','Farid Junaidi','Radel Virdiana',
      'Azza Ummu Habibatulloh','Alya Syahla','Tia Eryanti','Nisa Aprilia',
      'Dieria Febrianti','Muhamad Hassan Musajid','Dzaki Abdurrahman'
    ];

    const allUsers = [...bendaharaList];
    namaMhs.forEach((n, i) => {
      const no = String(i + 3).padStart(3, '0');
      allUsers.push({
        nim: `25157201${no}`,
        nama: n,
        password: 'password',
        is_bendahara: false
      });
    });

    await supabaseClient.from('users').insert(allUsers);

    const { data: newPeriode } = await supabaseClient.from('periode').insert([
      { nama: 'Minggu 1', mulai: '2026-10-01', selesai: '2026-10-07', nominal: 3000, status: 'aktif' },
      { nama: 'Minggu 2', mulai: '2026-10-08', selesai: '2026-10-14', nominal: 3000, status: 'aktif' },
      { nama: 'Minggu 3', mulai: '2026-10-15', selesai: '2026-10-21', nominal: 3000, status: 'aktif' },
      { nama: 'Minggu 4', mulai: '2026-10-22', selesai: '2026-10-28', nominal: 3000, status: 'aktif' }
    ]).select();

    const tagihanToInsert = [];
    allUsers.filter(u => !u.is_bendahara).forEach(u => {
      newPeriode.forEach(p => {
        tagihanToInsert.push({
          nim: u.nim,
          periode_id: p.id,
          nominal: p.nominal,
          status: 'belum'
        });
      });
    });
    await supabaseClient.from('tagihan').insert(tagihanToInsert);
  }
}

// ---------- FETCH DATA SUPABASE ----------
async function loadAllData() {
  await checkAndSeedUsers();

  const [u, p, t, bayar, m, cfg] = await Promise.all([
    supabaseClient.from('users').select('*'),
    supabaseClient.from('periode').select('*').order('id', { ascending: true }),
    supabaseClient.from('tagihan').select('*'),
    supabaseClient.from('pembayaran').select('*'),
    supabaseClient.from('metode_pembayaran').select('*'),
    supabaseClient.from('pengaturan_global').select('*').eq('key', 'catatan_global').single(),
  ]);

  DB_USERS = u.data || [];
  DB_PERIODE = p.data || [];
  DB_TAGIHAN = t.data || [];
  DB_PEMBAYARAN = bayar.data || [];
  DB_METODE = m.data || [];
  CATATAN_GLOBAL = cfg.data?.value || '';
}

// ---------- SESSION ----------
function loadSession() {
  const raw = localStorage.getItem('kas_si25_session');
  if (raw) CURRENT_USER = JSON.parse(raw);
}

function saveSession() {
  if (CURRENT_USER) {
    localStorage.setItem('kas_si25_session', JSON.stringify(CURRENT_USER));
  } else {
    localStorage.removeItem('kas_si25_session');
  }
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

  const mahasiswa = DB_USERS.filter(u => !u.is_bendahara);
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
  SELECTED_USER = DB_USERS.find(u => u.nim === nim);
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

  const user = DB_USERS.find(u => u.nim === nim && u.password === pass && u.is_bendahara);
  if (!user) {
    err.textContent = 'Nama atau password salah.';
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
  
  const searchInput = document.getElementById('search-nama');
  const nimInput = document.getElementById('login-nim');
  const passInput = document.getElementById('login-pass');
  const btnMasuk = document.getElementById('btn-masuk-mhs');

  if (searchInput) searchInput.value = '';
  if (nimInput) nimInput.value = '';
  if (passInput) passInput.value = '';
  if (btnMasuk) btnMasuk.disabled = true;

  setLoginMode('mhs');
  renderNamaList('');
  go('login');
  toast('👋 Berhasil keluar');
}

window.doLogout = doLogout;

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
  const menu = CURRENT_USER.is_bendahara ? MENU_BENDAHARA : MENU_MHS;

  const nav = document.getElementById('sidebar-nav');
  const bottomNav = document.getElementById('bottom-nav');

  if (nav) {
    nav.innerHTML = menu.map(m => `
      <div class="nav-item ${m.id === currentView ? 'active' : ''}" onclick="go('${m.id}')">
        <span class="nav-icon">${m.icon}</span>
        <span>${m.label}</span>
      </div>
    `).join('');
  }

  if (bottomNav) {
    bottomNav.innerHTML = menu.map(m => `
      <div class="nav-item ${m.id === currentView ? 'active' : ''}" onclick="go('${m.id}')">
        <span class="nav-icon">${m.icon}</span>
        <span>${m.label}</span>
      </div>
    `).concat(`
      <div class="nav-item" onclick="doLogout()" style="color: var(--rose, #f43f5e);">
        <span class="nav-icon">🚪</span>
        <span>Keluar</span>
      </div>
    `).join('');
  }

  const sideAvatar = document.getElementById('side-avatar');
  const sideName = document.getElementById('side-name');
  const sideRole = document.getElementById('side-role');

  if (sideAvatar) sideAvatar.textContent = CURRENT_USER.nama.charAt(0).toUpperCase();
  if (sideName) sideName.textContent = CURRENT_USER.nama;
  if (sideRole) sideRole.textContent = CURRENT_USER.is_bendahara ? 'Bendahara' : 'Mahasiswa';

  const today = new Date();
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const dateStr = `${today.getDate()} ${bulan[today.getMonth()]} ${today.getFullYear()}`;
  const d1 = document.getElementById('topbar-date');
  const d2 = document.getElementById('topbar-date-2');
  if (d1) d1.textContent = dateStr;
  if (d2) d2.textContent = dateStr;
}

// ---------- ROUTING ----------
async function go(page) {
  const bottomNav = document.getElementById('bottom-nav');

  // 1. Jika balik ke login / logout, LANGSUNG sembunyikan Bottom Nav & Stop render
  if (page === 'login' || !CURRENT_USER) {
    if (bottomNav) bottomNav.style.display = 'none';

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const loginPage = document.getElementById('page-login');
    if (loginPage) loginPage.classList.add('active');

    CURRENT_USER = null;
    return;
  }

  // 2. Jika user terautentikasi, tampilkan Bottom Nav khusus layar HP
  if (bottomNav) {
    bottomNav.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
  }

  // 3. Perpindahan halaman aplikasi
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-app').classList.add('active');

  let viewId = 'view-' + page;
  if (page === 'mhs' || page === 'bendahara' || page === 'bayar' || page === 'pengaturan') {
    currentView = page;
  } else {
    currentView = CURRENT_USER?.is_bendahara ? 'bendahara' : 'mhs';
    viewId = 'view-' + currentView;
  }

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.add('active');

  renderNav();
  await loadAllData();

  if (page === 'mhs') renderMhsDashboard();
  if (page === 'bendahara') renderBendaharaDashboard();
  if (page === 'bayar') renderBayarPage();
  if (page === 'pengaturan') renderPengaturan();

  window.scrollTo(0, 0);
}

function backToDashboard() {
  if (!CURRENT_USER) {
    go('login');
    return;
  }
  if (CURRENT_USER.is_bendahara) {
    go('bendahara');
  } else {
    go('mhs');
  }
}

// ---------- DASHBOARD MAHASISWA ----------
function renderMhsDashboard() {
  if (!CURRENT_USER || CURRENT_USER.is_bendahara) return;

  document.getElementById('mhs-greeting').textContent = `Halo, ${CURRENT_USER.nama} 👋`;

  // 1. Tagihan Mhs
  const tagihanSaya = DB_TAGIHAN
    .filter(t => t.nim === CURRENT_USER.nim)
    .sort((a, b) => {
      const pA = DB_PERIODE.find(x => x.id === a.periode_id);
      const pB = DB_PERIODE.find(x => x.id === b.periode_id);
      return (pA?.id || a.periode_id) - (pB?.id || b.periode_id);
    });

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

  // 2. REKAP TOTAL UANG KAS KESELURUHAN KELAS
  const totalKasGlobal = DB_PEMBAYARAN
    .filter(p => p.status === 'disetujui' || p.status === 'lunas' || p.status === 'diverifikasi')
    .reduce((total, p) => total + parseInt(p.nominal || 0, 10), 0);
  
  const totalKasGlobalEl = document.getElementById('mhs-total-kas-global');
  if (totalKasGlobalEl) {
    totalKasGlobalEl.textContent = rupiah(totalKasGlobal);
  }

  // 3. LOGIKA PRIORITAS DITAMPILKAN DI HERO CARD
  const tunggakanList = tagihanSaya.filter(t => t.status === 'belum' || t.status === 'ditolak');
  const waitingList = tagihanSaya.filter(t => t.status === 'menunggu_verifikasi');

  const heroEl = document.getElementById('mhs-hero');

  if (tunggakanList.length > 0) {
    const totalTunggakanNominal = tunggakanList.reduce((s, t) => s + t.nominal, 0);
    const idTunggakan = tunggakanList.map(t => t.id);

    heroEl.innerHTML = `
      <div class="hero-tagihan-info">
        <div>
          <div class="hero-label">Tagihan Belum Lunas</div>
          <div class="hero-periode">${tunggakanList.length} Minggu Belum Dibayar</div>
          <div class="hero-value">${rupiah(totalTunggakanNominal)}</div>
          <div style="margin-top:14px"><span class="card-status status-belum">❌ Belum Bayar</span></div>
        </div>
        <button class="btn-primary" style="width:auto;padding:14px 28px;margin-top:10px" onclick="bukaBayarDirect([${idTunggakan.join(',')}])">Bayar Sekarang</button>
      </div>
    `;
  } else if (waitingList.length > 0) {
    const totalWaitingNominal = waitingList.reduce((s, t) => s + t.nominal, 0);
    heroEl.innerHTML = `
      <div class="hero-tagihan-info">
        <div>
          <div class="hero-label">Status Verifikasi</div>
          <div class="hero-periode">${waitingList.length} Tagihan Menunggu Verifikasi</div>
          <div class="hero-value">${rupiah(totalWaitingNominal)}</div>
          <div style="margin-top:14px"><span class="card-status status-pending">🟡 Menunggu Verifikasi</span></div>
        </div>
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

  // --- RENDER DAFTAR TAGIHAN SAYA ---
  const list = document.getElementById('mhs-periode-list');
  if (tagihanSaya.length === 0) {
    list.innerHTML = '<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:20px">Belum ada tagihan</div>';
  } else {
    list.innerHTML = tagihanSaya.map(t => {
      const p = DB_PERIODE.find(x => x.id === t.periode_id);
      if (!p) return '';
      
      const bayarDitolak = DB_PEMBAYARAN.find(pem => (
        pem.tagihan_id === t.id || 
        (pem.tagihan_ids && Array.isArray(pem.tagihan_ids) && pem.tagihan_ids.includes(t.id))
      ) && pem.status === 'ditolak');
      
      let badgeClass = 'status-belum';
      let badgeText = '❌ Belum';
      if (t.status === 'lunas') { badgeClass = 'status-lunas'; badgeText = '✅ Lunas'; }
      if (t.status === 'menunggu_verifikasi') { badgeClass = 'status-pending'; badgeText = '🟡 Menunggu'; }
      if (t.status === 'ditolak') { badgeClass = 'status-ditolak'; badgeText = '🔴 Ditolak'; }

      return `
        <div class="tagihan-item" style="display: flex; flex-direction: column; gap: 6px; padding: 14px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-soft); border-radius: 12px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div>
              <div class="tgl" style="font-weight: 600; font-size: 13.5px;">${p.nama} · ${formatTanggal(p.mulai)} – ${formatTanggal(p.selesai)}</div>
              <div class="nom" style="font-weight: 700; color: var(--gold-soft); font-size: 14px; margin-top: 2px;">${rupiah(t.nominal)}</div>
            </div>
            <span class="card-status ${badgeClass}">${badgeText}</span>
          </div>

          ${t.status === 'ditolak' && bayarDitolak && bayarDitolak.alasan_tolak ? `
            <div style="margin-top: 6px; padding: 8px 10px; background: rgba(244, 63, 94, 0.1); border-left: 3px solid var(--rose); border-radius: 4px; font-size: 11.5px; color: #fca5a5;">
              <strong>Alasan Ditolak:</strong> "${bayarDitolak.alasan_tolak}"
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // --- RENDER AKTIVITAS ---
  const activity = document.getElementById('mhs-activity');
  const myPembayaran = DB_PEMBAYARAN
    .filter(p => p.nim === CURRENT_USER.nim)
    .sort((a,b) => b.id - a.id)
    .slice(0, 6);

  if (myPembayaran.length === 0) {
    activity.innerHTML = '<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:20px">Belum ada aktivitas</div>';
  } else {
    activity.innerHTML = myPembayaran.map(p => {
      let rincianMinggu = 'Kas';
      if (p.tagihan_ids && Array.isArray(p.tagihan_ids)) {
        rincianMinggu = `${p.tagihan_ids.length} Minggu`;
      } else if (p.tagihan_id) {
        const tag = DB_TAGIHAN.find(t => t.id === p.tagihan_id);
        const per = tag ? DB_PERIODE.find(x => x.id === tag.periode_id) : null;
        if (per) rincianMinggu = per.nama;
      }

      let dotClass = 'gold';
      let text = '';
      const statusLower = (p.status || '').toLowerCase();

      if (statusLower === 'disetujui' || statusLower === 'diterima' || statusLower === 'lunas') { 
        dotClass = 'green'; 
        text = `Pembayaran (${rincianMinggu}) disetujui`; 
      }
      else if (statusLower === 'ditolak') { 
        dotClass = 'rose'; 
        text = `Bukti (${rincianMinggu}) ditolak`; 
      }
      else { 
        text = `Bukti (${rincianMinggu}) dikirim, menunggu verifikasi`; 
      }

      return `
        <div class="activity-item" style="margin-bottom: 12px;">
          <div class="activity-dot ${dotClass}"></div>
          <div class="activity-body" style="width: 100%;">
            <div class="activity-text" style="font-size: 13px; font-weight: 600;">${text}</div>
            <div class="activity-time" style="font-size: 12px; color: var(--text-dim);">${rupiah(p.nominal)}</div>
            
            ${statusLower === 'ditolak' && p.alasan_tolak ? `
              <div style="margin-top: 6px; padding: 6px 8px; background: rgba(244, 63, 94, 0.1); border-left: 2px solid var(--rose); border-radius: 4px; font-size: 11px; color: #fca5a5;">
                "${p.alasan_tolak}"
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }
}

function bukaBayarDirect(idsArray) {
  TAGIHAN_TERPILIH_IDS = idsArray && idsArray.length ? [...idsArray] : [];
  METODE_TERPILIH = DB_METODE.length > 0 ? DB_METODE[0].id : null;
  go('bayar');
}

// ---------- DASHBOARD BENDAHARA ----------
function renderBendaharaDashboard() {
  if (!CURRENT_USER || !CURRENT_USER.is_bendahara) return;

  const periodeAktif = DB_PERIODE.find(p => p.status === 'aktif') || DB_PERIODE[0];
  if (!periodeAktif) return;

  const tagihanPeriode = DB_TAGIHAN.filter(t => t.periode_id === periodeAktif.id);
  const sudahBayarArr = tagihanPeriode.filter(t => t.status === 'lunas');
  const belumArr = tagihanPeriode.filter(t => t.status === 'belum');
  const pendingCount = DB_PEMBAYARAN.filter(p => p.status === 'menunggu').length;
  const persen = tagihanPeriode.length
    ? Math.round((sudahBayarArr.length / tagihanPeriode.length) * 100)
    : 0;

  const totalKasGlobal = DB_PEMBAYARAN
    .filter(p => p.status === 'disetujui' || p.status === 'lunas' || p.status === 'diverifikasi')
    .reduce((total, p) => total + parseInt(p.nominal || 0, 10), 0);

  document.getElementById('bend-total').textContent = rupiah(totalKasGlobal);
  document.getElementById('bend-periode-badge').textContent = `Total Kas Masuk Keseluruhan`;
  document.getElementById('bend-progress-fill').style.width = persen + '%';
  document.getElementById('bend-progress-text').textContent =
    `${sudahBayarArr.length} / ${tagihanPeriode.length} mahasiswa (${periodeAktif.nama})`;
  document.getElementById('bend-progress-percent').textContent = persen + '%';

  document.getElementById('bend-sudah').textContent = `${sudahBayarArr.length}/${tagihanPeriode.length}`;
  document.getElementById('bend-pending').textContent = pendingCount;
  document.getElementById('bend-belum').textContent = belumArr.length;
  document.getElementById('bend-terkumpul').textContent = rupiah(totalKasGlobal);
  document.getElementById('bend-pending-badge').textContent = pendingCount;

  // ---------- MENUNGGU VERIFIKASI ----------
  const pendingList = document.getElementById('bend-pending-list');
  const pendings = DB_PEMBAYARAN.filter(p => p.status === 'menunggu');

  if (pendings.length === 0) {
    pendingList.innerHTML = `
      <div style="color:var(--text-dim);font-size:13px;text-align:center;padding:32px 20px;line-height:1.6">
        <div style="font-size:28px;margin-bottom:8px;opacity:0.5">✨</div>
        Tidak ada antrian verifikasi
      </div>`;
  } else {
    pendingList.innerHTML = pendings.map(p => {
      const user = DB_USERS.find(u => u.nim === p.nim);

      let infoTagihan = 'Kas';
      if (p.tagihan_ids && Array.isArray(p.tagihan_ids)) {
        infoTagihan = `${p.tagihan_ids.length} minggu sekaligus`;
      } else if (p.tagihan_id) {
        const tag = DB_TAGIHAN.find(t => t.id === p.tagihan_id);
        const per = DB_PERIODE.find(x => x.id === tag?.periode_id);
        if (per) infoTagihan = per.nama;
      }

      return `
        <div class="list-item">
          <div class="info">
            <div class="nama">${escapeHtml(user?.nama || 'Mhs')}</div>
            <div class="nim">${user?.nim || '-'} · Paket: ${infoTagihan} · <strong style="color:var(--gold-soft)">${rupiah(p.nominal)}</strong></div>
          </div>
          <button class="btn-small btn-success" onclick="openVerify(${p.id})">Verifikasi</button>
        </div>
      `;
    }).join('');
  }

   // ---------- STATUS MAHASISWA ----------
  const tagihanList = document.getElementById('bend-tagihan-list');

  const sorted = [...tagihanPeriode].sort((a, b) => {
    const rank = { 'belum': 0, 'ditolak': 1, 'menunggu_verifikasi': 2, 'lunas': 3 };
    const ra = rank[a.status] ?? 9;
    const rb = rank[b.status] ?? 9;
    if (ra !== rb) return ra - rb;
    const ua = DB_USERS.find(x => x.nim === a.nim)?.nama || '';
    const ub = DB_USERS.find(x => x.nim === b.nim)?.nama || '';
    return ua.localeCompare(ub);
  });

  tagihanList.innerHTML = sorted.map((t, idx) => {
    const u = DB_USERS.find(x => x.nim === t.nim);
    const initial = (u?.nama || 'M').charAt(0).toUpperCase();
    const colorClass = `avatar-c${(idx % 8) + 1}`;

    let cls = 'status-belum', txt = '● Belum';
    if (t.status === 'lunas')              { cls = 'status-lunas';   txt = '✓ Lunas'; }
    if (t.status === 'menunggu_verifikasi'){ cls = 'status-pending'; txt = '◐ Menunggu'; }
    if (t.status === 'ditolak')            { cls = 'status-ditolak'; txt = '✕ Ditolak'; }

    return `
      <div class="row-mhs">
        <span class="row-mhs__avatar ${colorClass}">${initial}</span>
        <div class="row-mhs__meta">
          <span class="row-mhs__name">${escapeHtml(u?.nama || 'Mhs')}</span>
          <span class="row-mhs__nim">${u?.nim || '-'}</span>
        </div>
        <span class="card-status ${cls}">${txt}</span>
      </div>
    `;
  }).join('');
}

// ---------- BAYAR KAS MULTI-PERIODE ----------
function renderBayarPage() {
  if (!CURRENT_USER) return;

  const myBelumTagihan = DB_TAGIHAN
    .filter(t => t.nim === CURRENT_USER.nim && (t.status === 'belum' || t.status === 'ditolak'))
    .sort((a, b) => {
      const pA = DB_PERIODE.find(x => x.id === a.periode_id);
      const pB = DB_PERIODE.find(x => x.id === b.periode_id);
      return (pA?.id || a.periode_id) - (pB?.id || b.periode_id);
    });

  if (TAGIHAN_TERPILIH_IDS.length === 0 && myBelumTagihan.length > 0) {
    TAGIHAN_TERPILIH_IDS = [myBelumTagihan[0].id];
  }

  const containerCheckbox = document.getElementById('bayar-checkbox-list');
  if (containerCheckbox) {
    if (myBelumTagihan.length === 0) {
      containerCheckbox.innerHTML = `<div style="color:var(--text-dim);font-size:12.5px;padding:10px 0;">Semua tagihan lo sudah lunas / sedang diverifikasi!</div>`;
    } else {
      containerCheckbox.innerHTML = myBelumTagihan.map(t => {
        const p = DB_PERIODE.find(x => x.id === t.periode_id);
        const isChecked = TAGIHAN_TERPILIH_IDS.includes(t.id);
        return `
          <label class="tagihan-checkbox-item">
            <input type="checkbox" class="custom-checkbox" value="${t.id}" ${isChecked ? 'checked' : ''} onchange="onCheckboxTagihanChange(this)">
            <div style="flex: 1; font-size: 13.5px;">
              <strong>${p?.nama || 'Minggu'}</strong> (${formatTanggal(p?.mulai)}) — <span style="color: var(--gold-soft); font-weight:700;">${rupiah(t.nominal)}</span>
            </div>
          </label>
        `;
      }).join('');
    }
  }

  updateTotalNominalBayar();

  document.getElementById('bayar-file').value = '';
  document.getElementById('bayar-catatan').value = '';

  const grid = document.getElementById('metode-grid');

  if (DB_METODE.length === 0) {
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

  if (!DB_METODE.find(m => m.id === METODE_TERPILIH)) {
    METODE_TERPILIH = DB_METODE[0].id;
  }

  grid.innerHTML = DB_METODE.map(m => `
    <div class="metode-card ${METODE_TERPILIH === m.id ? 'selected' : ''}" onclick="pilihMetode(${m.id})">
      <span class="metode-icon">${tipeIcon(m.tipe)}</span>
      <div class="metode-name">${escapeHtml(m.nama)}</div>
      <div class="metode-tipe-label">${tipeLabel(m.tipe)}</div>
    </div>
  `).join('');

  renderMetodeDetail();
}

function onCheckboxTagihanChange(el) {
  const val = parseInt(el.value);
  if (el.checked) {
    if (!TAGIHAN_TERPILIH_IDS.includes(val)) TAGIHAN_TERPILIH_IDS.push(val);
  } else {
    TAGIHAN_TERPILIH_IDS = TAGIHAN_TERPILIH_IDS.filter(id => id !== val);
  }
  updateTotalNominalBayar();
}

function updateTotalNominalBayar() {
  const selectedTagihan = DB_TAGIHAN.filter(t => TAGIHAN_TERPILIH_IDS.includes(t.id));
  const total = selectedTagihan.reduce((s, t) => s + t.nominal, 0);

  const displayEl = document.getElementById('bayar-nominal-display');
  const periodeText = document.getElementById('bayar-periode');

  if (displayEl) displayEl.textContent = rupiah(total);
  if (periodeText) {
    periodeText.textContent = selectedTagihan.length
      ? `${selectedTagihan.length} Tagihan Minggu Terpilih`
      : 'Pilih minimal 1 minggu tagihan';
  }
}

function pilihMetode(id) {
  METODE_TERPILIH = id;
  document.querySelectorAll('.metode-card').forEach((el) => {
    const mId = el.getAttribute('onclick')?.match(/\d+/)?.[0];
    el.classList.toggle('selected', String(mId) === String(id));
  });
  renderMetodeDetail();
}

function renderMetodeDetail() {
  const m = DB_METODE.find(x => x.id === METODE_TERPILIH);
  const detail = document.getElementById('metode-detail');

  if (!m) { detail.innerHTML = ''; return; }

  if (m.tipe === 'qris') {
    if (m.qris_image_url) {
      detail.innerHTML = `
        <div class="qris-box">
          <img src="${m.qris_image_url}" alt="QRIS ${escapeHtml(m.nama)}"
               id="qris-image" crossorigin="anonymous">
          <div class="qris-caption">Scan pakai m-banking / e-wallet</div>
          <div class="qris-actions">
            <button class="btn-download-qris" onclick="downloadQRIS()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download QRIS
            </button>
          </div>
        </div>
        ${m.catatan ? `<div class="qris-hint"${/* CATATAN_GLOBAL ? `<div class="qris-hint">${escapeHtml(CATATAN_GLOBAL)}</div>` : '' */ ''}>${escapeHtml(m.catatan)}</div>` : ''}
        
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
          <div class="copy-value">${escapeHtml(m.atas_nama)}</div>
        </div>
      </div>
      ${m.catatan ? `<div style="padding-top:10px;font-size:12px;color:var(--text-dim);font-style:italic">${escapeHtml(m.catatan)}</div>` : ''}
      ${/* CATATAN_GLOBAL ? `<div style="padding-top:8px;font-size:12px;color:var(--text-dim);font-style:italic">${escapeHtml(CATATAN_GLOBAL)}</div>` : '' */ ''}
    </div>
  `;
}

async function submitBukti() {
  const selectedTagihan = DB_TAGIHAN.filter(t => TAGIHAN_TERPILIH_IDS.includes(t.id));
  const nominalOtomatis = selectedTagihan.reduce((s, t) => s + t.nominal, 0);
  const fileInput = document.getElementById('bayar-file');
  const catatan = document.getElementById('bayar-catatan').value;
  const btnSubmit = document.querySelector('#view-bayar .btn-primary');

  if (TAGIHAN_TERPILIH_IDS.length === 0) {
    toast('Pilih minimal 1 tagihan minggu yang mau dibayar');
    return;
  }
  if (!fileInput.files[0]) {
    toast('Pilih file bukti transfer dulu');
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerText = '⏳ Mengunggah...';
  }

  try {
    const file = fileInput.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${CURRENT_USER.nim}.${fileExt}`;

    toast('⏳ Mengunggah bukti...');

    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('bukti-transfer')
      .upload(fileName, file);

    if (uploadError) {
      toast('Gagal unggah bukti: ' + uploadError.message);
      return;
    }

    const { data: urlData } = supabaseClient.storage
      .from('bukti-transfer')
      .getPublicUrl(fileName);

    const publicUrl = urlData ? urlData.publicUrl : '';

    const metode = DB_METODE.find(x => x.id === METODE_TERPILIH);
    const metodeInfo = metode ? `${metode.nama} (${tipeLabel(metode.tipe)})` : '-';

    const { error: insertError } = await supabaseClient.from('pembayaran').insert([
      {
        tagihan_id: TAGIHAN_TERPILIH_IDS[0],
        tagihan_ids: TAGIHAN_TERPILIH_IDS,
        nim: CURRENT_USER.nim,
        bukti_url: publicUrl,
        nominal: nominalOtomatis,
        catatan: catatan,
        metode: metodeInfo,
        status: 'menunggu'
      }
    ]);

    if (insertError) {
      toast('Gagal menyimpan data pembayaran');
      return;
    }

    await supabaseClient.from('tagihan')
      .update({ status: 'menunggu_verifikasi' })
      .in('id', TAGIHAN_TERPILIH_IDS);

    toast('✅ Bukti pembayaran terkirim!');
    await loadAllData();
    go('mhs');
  } catch (err) {
    console.error(err);
    toast('Terjadi kesalahan saat mengirim bukti');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerText = 'Kirim Bukti Pembayaran';
    }
  }
}

// ---------- VERIFIKASI (BENDAHARA) ----------
function openVerify(pembayaranId) {
  VERIFY_ID = pembayaranId;
  const p = DB_PEMBAYARAN.find(x => x.id === pembayaranId);
  const user = DB_USERS.find(u => u.nim === p.nim);

  let rincianPaketStr = '';
  if (p.tagihan_ids && Array.isArray(p.tagihan_ids)) {
    const listNamaPeriode = p.tagihan_ids.map(id => {
      const tg = DB_TAGIHAN.find(t => t.id === id);
      const pr = tg ? DB_PERIODE.find(x => x.id === tg.periode_id) : null;
      return pr ? pr.nama : 'Minggu';
    });
    rincianPaketStr = listNamaPeriode.join(', ');
  } else if (p.tagihan_id) {
    const tag = DB_TAGIHAN.find(t => t.id === p.tagihan_id);
    const per = DB_PERIODE.find(x => x.id === tag?.periode_id);
    rincianPaketStr = per?.nama || 'Kas';
  }

  const gambarHtml = p?.bukti_url 
    ? `<img src="${p.bukti_url}" class="bukti-img" alt="Bukti transfer" onerror="this.onerror=null;this.src='https://via.placeholder.com/400x300?text=Gambar+Gagal+Dimuat';">`
    : `<div style="padding: 20px; text-align: center; color: var(--rose);">⚠️ Tidak ada gambar bukti</div>`;

  document.getElementById('verify-content').innerHTML = `
    <p><strong>${escapeHtml(user?.nama || 'Mahasiswa')}</strong></p>
    <p style="color:var(--text-dim);font-size:12px;font-family:monospace">${user?.nim || '-'}</p>
    <p style="margin-top:14px;font-family:Fraunces,serif;font-size:15px">Paket Pembayaran: ${rincianPaketStr}</p>
    <p style="font-size:18px;font-weight:700;color:var(--gold-soft);margin-top:4px">${rupiah(p.nominal)}</p>
    ${p.metode ? `<p style="font-size:12px;color:var(--text-soft);margin-top:4px">Metode: ${escapeHtml(p.metode)}</p>` : ''}
    ${p.catatan ? `<p style="font-size:12px;color:var(--text-dim);margin-top:4px">Catatan: ${escapeHtml(p.catatan)}</p>` : ''}
    ${gambarHtml}
  `;
  document.getElementById('modal-verify').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-verify').classList.remove('active');
  document.getElementById('area-alasan-tolak').classList.add('hidden');
  document.getElementById('verify-default-actions').classList.remove('hidden');
  document.getElementById('verify-reject-actions').classList.add('hidden');
  document.getElementById('input-alasan-tolak').value = '';
  VERIFY_ID = null;
}

async function approveBukti() {
  const p = DB_PEMBAYARAN.find(x => x.id === VERIFY_ID);
  if (!p) return;

  await supabaseClient.from('pembayaran').update({
    status: 'disetujui',
    verified_by: CURRENT_USER.nim,
    verified_at: new Date().toISOString()
  }).eq('id', p.id);

  const idsToUpdate = (p.tagihan_ids && Array.isArray(p.tagihan_ids)) ? p.tagihan_ids : [p.tagihan_id];
  await supabaseClient.from('tagihan').update({ status: 'lunas' }).in('id', idsToUpdate);

  closeModal();
  toast('✅ Pembayaran disetujui!');
  await loadAllData();
  go('bendahara');
}

function bukaFormPenolakan() {
  document.getElementById('area-alasan-tolak').classList.remove('hidden');
  document.getElementById('verify-default-actions').classList.add('hidden');
  document.getElementById('verify-reject-actions').classList.remove('hidden');
  document.getElementById('input-alasan-tolak').focus();
}

function batalPenolakan() {
  document.getElementById('area-alasan-tolak').classList.add('hidden');
  document.getElementById('verify-default-actions').classList.remove('hidden');
  document.getElementById('verify-reject-actions').classList.add('hidden');
  document.getElementById('input-alasan-tolak').value = '';
}

async function rejectBuktiKonfirmasi() {
  const alasan = document.getElementById('input-alasan-tolak').value.trim();
  if (!alasan) {
    toast('Isi alasan penolakan dulu ya!');
    return;
  }

  const p = DB_PEMBAYARAN.find(x => x.id === VERIFY_ID);
  if (!p) return;

  toast('⏳ Memproses penolakan...');

  await supabaseClient.from('pembayaran').update({
    status: 'ditolak',
    verified_by: CURRENT_USER.nim,
    verified_at: new Date().toISOString(),
    alasan_tolak: alasan
  }).eq('id', p.id);

  const idsToUpdate = (p.tagihan_ids && Array.isArray(p.tagihan_ids)) ? p.tagihan_ids : [p.tagihan_id];
  await supabaseClient.from('tagihan').update({ status: 'ditolak' }).in('id', idsToUpdate);

  closeModal();
  toast('❌ Bukti pembayaran berhasil ditolak');
  await loadAllData();
  go('bendahara');
}

// ---------- PENGATURAN ----------
function renderPengaturan() {
  renderMetodeList();
  document.getElementById('setting-catatan').value = CATATAN_GLOBAL;
  hideMetodeForm();
}

function renderMetodeList() {
  const list = document.getElementById('metode-list');
  document.getElementById('metode-count').textContent = DB_METODE.length;

  if (DB_METODE.length === 0) {
    list.innerHTML = `
      <div class="metode-empty">
        <div style="font-size:28px;margin-bottom:8px;opacity:0.5">💳</div>
        Belum ada metode pembayaran.<br>
        Klik <strong>+ Tambah Metode</strong> buat mulai.
      </div>
    `;
    return;
  }

  list.innerHTML = DB_METODE.map(m => {
    let sub = m.tipe === 'qris'
      ? (m.qris_image_url ? '✓ QRIS ter-upload' : '⚠ QRIS belum di-upload')
      : `${m.nomor || '-'} · ${m.atas_nama || '-'}`;

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
  METODE_QRIS_FILE = null;

  const form = document.getElementById('metode-form');
  const title = document.getElementById('metode-form-title');

  if (id) {
    const m = DB_METODE.find(x => x.id === id);
    if (!m) return;

    title.textContent = 'Edit Metode';
    document.getElementById('metode-id').value = m.id;
    document.getElementById('metode-tipe').value = m.tipe;
    document.getElementById('metode-nama').value = m.nama || '';
    document.getElementById('metode-nomor').value = m.nomor || '';
    document.getElementById('metode-atasnama').value = m.atas_nama || '';
    document.getElementById('metode-catatan').value = m.catatan || '';
  } else {
    title.textContent = 'Tambah Metode';
    document.getElementById('metode-id').value = '';
    document.getElementById('metode-tipe').value = 'bank';
    document.getElementById('metode-nama').value = '';
    document.getElementById('metode-nomor').value = '';
    document.getElementById('metode-atasnama').value = '';
    document.getElementById('metode-catatan').value = '';
  }

  onMetodeTipeChange();
  form.classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideMetodeForm() {
  document.getElementById('metode-form').classList.add('hidden');
  METODE_EDIT_ID = null;
  METODE_QRIS_FILE = null;
}

function onMetodeTipeChange() {
  const tipe = document.getElementById('metode-tipe').value;
  document.getElementById('metode-nomor-group').classList.toggle('hidden', tipe === 'qris');
  document.getElementById('metode-qris-group').classList.toggle('hidden', tipe !== 'qris');
}

function onQrisUpload(input) {
  METODE_QRIS_FILE = input.files[0];
}

async function saveMetode() {
  const tipe = document.getElementById('metode-tipe').value;
  const nama = document.getElementById('metode-nama').value.trim();
  const nomor = document.getElementById('metode-nomor').value.trim();
  const atasNama = document.getElementById('metode-atasnama').value.trim();
  const catatan = document.getElementById('metode-catatan').value.trim();
  const id = document.getElementById('metode-id').value;

  if (!nama) { toast('Isi nama metode dulu'); return; }

  let qrisUrl = null;

  if (tipe === 'qris' && METODE_QRIS_FILE) {
    const fileName = `qris_${Date.now()}.${METODE_QRIS_FILE.name.split('.').pop()}`;
    await supabaseClient.storage.from('qris-image').upload(fileName, METODE_QRIS_FILE);
    const { data } = supabaseClient.storage.from('qris-image').getPublicUrl(fileName);
    qrisUrl = data.publicUrl;
  }

  const payload = {
    tipe,
    nama,
    nomor: tipe === 'qris' ? '' : nomor,
    atas_nama: tipe === 'qris' ? '' : atasNama,
    catatan,
  };
  if (qrisUrl) payload.qris_image_url = qrisUrl;

  if (id) {
    await supabaseClient.from('metode_pembayaran').update(payload).eq('id', id);
  } else {
    await supabaseClient.from('metode_pembayaran').insert([payload]);
  }

  toast('✅ Metode tersimpan!');
  hideMetodeForm();
  go('pengaturan');
}

async function deleteMetode(id) {
  const m = DB_METODE.find(x => x.id === id);
  if (!m || !confirm(`Hapus metode "${m.nama}"?`)) return;

  await supabaseClient.from('metode_pembayaran').delete().eq('id', id);
  toast('🗑 Metode dihapus');
  go('pengaturan');
}

async function saveCatatanGlobal() {
  const val = document.getElementById('setting-catatan').value.trim();
  await supabaseClient.from('pengaturan_global').upsert({ key: 'catatan_global', value: val });
  toast('✅ Catatan tersimpan!');
}

// ---------- INIT ----------
async function initApp() {
  loadSession();
  await loadAllData();

  if (CURRENT_USER) {
    go(CURRENT_USER.is_bendahara ? 'bendahara' : 'mhs');
  } else {
    setLoginMode('mhs');
    renderNamaList('');
    go('login');
  }
}

initApp();

document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') loginBendahara();
});
/* ============================================
   PATCH v4 — Sidebar Toggle · Animations · Ripple · Counter
   ============================================ */

/* ---------- 1. SIDEBAR TOGGLE (Desktop) ---------- */
(function initSidebarToggle() {
  const app = document.getElementById('page-app');
  if (!app) return;

  // Restore state
  try {
    if (localStorage.getItem('si25_sidebar_hidden') === '1') {
      app.classList.add('sidebar-hidden');
    }
  } catch (e) {}

  function syncExpand() {
    const hidden = app.classList.contains('sidebar-hidden');
    document.querySelectorAll('.btn-sidebar-toggle').forEach(btn => {
      btn.setAttribute('aria-expanded', String(!hidden));
    });
  }

  function toggle() {
    app.classList.toggle('sidebar-hidden');
    const hidden = app.classList.contains('sidebar-hidden');
    try { localStorage.setItem('si25_sidebar_hidden', hidden ? '1' : '0'); } catch (e) {}
    syncExpand();
    haptic(8);
  }

  document.querySelectorAll('.btn-sidebar-toggle').forEach(btn => {
    btn.addEventListener('click', toggle);
  });

  // Shortcut: tombol "["
  document.addEventListener('keydown', (e) => {
    if (e.key !== '[' || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    if (['input','textarea','select'].includes(tag)) return;
    toggle();
  });

  // Reset di mobile
  const mq = window.matchMedia('(max-width: 900px)');
  const onMQ = (e) => {
    if (e.matches) {
      app.classList.remove('sidebar-hidden');
      syncExpand();
    }
  };
  mq.addEventListener ? mq.addEventListener('change', onMQ) : mq.addListener(onMQ);

  syncExpand();
})();

/* ---------- 2. HAPTIC FEEDBACK ---------- */
function haptic(ms = 10) {
  if (navigator.vibrate && window.innerWidth <= 900) {
    try { navigator.vibrate(ms); } catch (e) {}
  }
}
window.haptic = haptic;

/* ---------- 3. RIPPLE ON TAP ---------- */
function attachRipple(el) {
  if (!el || el.dataset.ripple) return;
  el.dataset.ripple = '1';
  el.style.position = el.style.position || 'relative';
  el.style.overflow = 'hidden';

  el.addEventListener('pointerdown', (e) => {
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top  = (e.clientY - rect.top  - size / 2) + 'px';
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
    haptic(6);
  });
}

function applyRippleToAll() {
  document.querySelectorAll(
    '.btn-primary, .quick-action, .metode-card, .nav-item, .btn-success, .btn-danger, .nama-item, .list-item'
  ).forEach(attachRipple);
}

/* ---------- 4. SCROLL-REVEAL (stagger) ---------- */
function applyStagger() {
  document.querySelectorAll('.anim-up').forEach(el => {
    const d = el.dataset.delay || '0';
    el.style.setProperty('--stagger', d);
  });
}

function revealInView() {
  const els = document.querySelectorAll('.anim-up:not(.in-view)');
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -20px 0px' });

  els.forEach(el => io.observe(el));
}

/* ---------- 5. COUNTER ANGKA (Rp & digit) ---------- */
function animateCounter(el) {
  if (!el || el.dataset.counted === 'done') return;
  const original = el.textContent.trim();
  const isRp = original.startsWith('Rp');
  const num = parseInt(original.replace(/[^\d]/g, ''), 10);
  if (!num || isNaN(num)) return;

  el.dataset.counted = 'done';
  const dur = 700;
  const start = performance.now();
  const from = 0;

  function tick(now) {
    const t = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = Math.floor(from + (num - from) * eased);
    el.textContent = (isRp ? 'Rp' : '') + val.toLocaleString('id-ID');
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = original;
  }
  requestAnimationFrame(tick);
}

function runCounters() {
  document.querySelectorAll('[data-counter]').forEach(animateCounter);
}

/* ---------- 6. SCROLL TO ELEMENT HELPER ---------- */
window.scrollToElement = function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }],
    { duration: 500, easing: 'ease-out' }
  );
};

/* ---------- 7. MUAT ULANG EFEK SETELAH RENDER ---------- */
const _origGo = window.go;
window.go = async function (page) {
  await _origGo(page);

  // Hapus efek lama biar diulang dari awal
  document.querySelectorAll('.anim-up').forEach(el => el.classList.remove('in-view'));
  document.querySelectorAll('[data-counter]').forEach(el => delete el.dataset.counted);

  // Reset dan jalankan lagi
  applyStagger();
  revealInView();
  applyRippleToAll();

  // Counter angka (delay dikit biar terasa)
  setTimeout(runCounters, 200);
};

/* ---------- 8. INIT ---------- */
document.addEventListener('DOMContentLoaded', () => {
  applyStagger();
  revealInView();
  applyRippleToAll();
  setTimeout(runCounters, 400);
});

// Ulang tiap kali ada perubahan isi (list dimuat ulang)
const _obs = new MutationObserver(() => {
  applyRippleToAll();
  revealInView();
});
_obs.observe(document.body, { childList: true, subtree: true });

/* ---------- 9. TOAST: bikin lebih hidup ---------- */
const _origToast = window.toast;
window.toast = function (msg) {
  if (typeof _origToast === 'function') _origToast(msg);
  haptic(12);
};

/* ---------- 10. LIST-ITEM & QUICK-ACTION: micro-bounce ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('.quick-action, .nama-item, .metode-card, .nav-item, .btn-primary, .btn-success, .btn-danger');
  if (!el) return;
  el.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(.96)' }, { transform: 'scale(1)' }],
    { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' }
  );
}, true);

document.querySelectorAll('.btn-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('page-app').classList.toggle('sidebar-hidden');
  });
});

/* ============================================================
   SPLASH SCREEN — Auto-hide setelah loading
   ============================================================ */
(function initSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;

  // Cek apakah user baru buka / refresh (bukan navigasi internal)
  const navEntries = performance.getEntriesByType?.('navigation') || [];
  const isReload = navEntries[0]?.type === 'reload';
  const isFirstVisit = !sessionStorage.getItem('kas_si25_splash_shown');

  // Kalau lo mau splash muncul TERUS tiap buka app, ganti kondisi jadi `true`
  // Kalau cuma pertama kali per session, biarkan `isFirstVisit`
  const shouldShow = isFirstVisit;

  if (!shouldShow) {
    splash.remove();
    return;
  }

  // Tandai sudah ditampilkan
  sessionStorage.setItem('kas_si25_splash_shown', '1');

  // Auto-hide setelah animasi selesai (~1.9 detik)
  const MIN_DURATION = 1900;
  const startTime = Date.now();

  function hideSplash() {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, MIN_DURATION - elapsed);
    setTimeout(() => {
      splash.classList.add('is-done');
      // Hapus dari DOM setelah transition selesai
      setTimeout(() => splash.remove(), 600);
    }, remaining);
  }

  // Tunggu window + fonts loaded kalau memungkinkan
  if (document.readyState === 'complete') {
    hideSplash();
  } else {
    window.addEventListener('load', hideSplash);
  }

  // Failsafe: paksa hide setelah 3 detik (kalaupun load event gak fire)
  setTimeout(hideSplash, 3000);
})();