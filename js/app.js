const { createClient } = supabase;
const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const $ = (s, root = document) => root.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d) ? s : new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
  }).format(d);
}

function cardJadwal(x) {
  return `<article class="jadwal-item">
    <h4>${esc(x.nama)}</h4>
    <p>${esc(fmtDate(x.tanggal))}<br>${esc(x.tempat)}<br>${esc(x.jam)}<br>Khadim: ${esc(x.khadim || '-')}</p>
  </article>`;
}

async function loadJadwal() {
  const target = $('#jadwal-list');
  if (!target) return;

  const { data, error } = await sb.from('jadwal').select('*').order('tanggal').order('jam');
  if (error) {
    target.innerHTML = '<p>Jadwal belum dapat dimuat. Periksa konfigurasi Supabase.</p>';
    return;
  }
  target.innerHTML = data.length
    ? data.map(cardJadwal).join('')
    : '<p>Belum ada jadwal ibadah.</p>';

  const bulanEl = $('#jadwal-bulan');
  const khadimEl = $('#jadwal-khadim');

  if (bulanEl) {
    const { data: bulanData } = await sb.from('bulan')
      .select('*').eq('aktif', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (bulanData && bulanData.length) {
      const b = bulanData[0];
      bulanEl.textContent = b.nama;

      if (khadimEl) {
        const url = b.foto_path
          ? sb.storage.from('dokumentasi').getPublicUrl(b.foto_path).data.publicUrl
          : '';
        if (url) {
          khadimEl.innerHTML = `
            <figure class="khadim-figure">
              <img src="${esc(url)}" alt="${esc(b.foto_judul || 'Khadim')}">
              ${b.foto_judul ? `<figcaption>${esc(b.foto_judul)}</figcaption>` : ''}
            </figure>`;
          khadimEl.hidden = false;
        } else {
          khadimEl.innerHTML = '';
          khadimEl.hidden = true;
        }
      }
    } else {
      bulanEl.textContent = data.length
        ? new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(data[0].tanggal + 'T00:00:00'))
        : 'Jadwal Ibadah';
      if (khadimEl) { khadimEl.innerHTML = ''; khadimEl.hidden = true; }
    }
  }
}

async function loadGallery() {
  const target = $('#galeri-grid');
  if (!target) return;
  const { data, error } = await sb.from('dokumentasi').select('*').order('created_at', { ascending: false });
  if (error) {
    target.innerHTML = '<p>Dokumentasi belum dapat dimuat. Periksa konfigurasi Supabase.</p>';
    return;
  }
  const photos = (data || []).map(x => ({
    ...x,
    url: x.url || (x.path ? sb.storage.from('dokumentasi').getPublicUrl(x.path).data.publicUrl : '')
  })).filter(x => x.url);

  target.innerHTML = photos.length
    ? photos.map(x => `
        <figure class="galeri-kartu">
          <a class="galeri-item" href="${esc(x.url)}" target="_blank" rel="noopener">
            <img loading="lazy" src="${esc(x.url)}" alt="${esc(x.judul || 'Dokumentasi Torang Pekawan')}">
          </a>
          ${x.judul ? `<figcaption>${esc(x.judul)}</figcaption>` : ''}
        </figure>`).join('')
    : '<p>Dokumentasi akan segera hadir.</p>';
}

async function loadKegiatan() {
  const target = $('#kegiatan-list');
  if (!target) return;
  const { data, error } = await sb.from('kegiatan').select('*').order('created_at', { ascending: false });
  if (error) {
    target.innerHTML = '<p>Kegiatan belum dapat dimuat. Periksa konfigurasi Supabase.</p>';
    return;
  }
  const items = (data || []).map(x => ({
    ...x,
    url: sb.storage.from('dokumentasi').getPublicUrl(x.path).data.publicUrl
  }));

  target.innerHTML = items.length
    ? items.map(x => `
        <article class="kegiatan-kartu">
          <a class="kegiatan-foto" href="${esc(x.url)}" target="_blank" rel="noopener">
            <img loading="lazy" src="${esc(x.url)}" alt="${esc(x.judul || 'Kegiatan Torang Pekawan')}">
          </a>
          <h3 class="kegiatan-judul">${esc(x.judul || 'Tanpa judul')}</h3>
        </article>`).join('')
    : '<p>Belum ada kegiatan.</p>';
}

async function loadBingkai() {
  const target = $('#foto-bingkai');
  if (!target) return;
  
  const { data, error } = await sb.from('pengaturan').select('value').eq('key', 'foto_bingkai').maybeSingle();
  if (error) return;
  
  let items = [];
  try {
    items = JSON.parse(data?.value) || [];
    if (!Array.isArray(items)) items = [data.value]; 
  } catch(e) {
    if (data?.value) items = [data.value];
  }

  // Konversi jika ada data lama yang masih berupa string biasa
  items = items.map(item => typeof item === 'string' ? { path: item, judul: '' } : item);

  if (!items.length) {
    target.innerHTML = `<div class="foto-jadwal-kosong"><i class="bi bi-image"></i></div>`;
    return;
  }

  // Jika hanya 1 foto
  if (items.length === 1) {
    const item = items[0];
    const url = sb.storage.from('dokumentasi').getPublicUrl(item.path).data.publicUrl;
    target.innerHTML = `
      <a href="${esc(url)}" target="_blank" rel="noopener" class="bingkai-container">
        <img src="${esc(url)}" class="bingkai-img" alt="Foto Torang Pekawan">
        ${item.judul ? `<div class="overlay-bingkai">${esc(item.judul)}</div>` : ''}
      </a>
    `;
    return;
  }

  // Jika lebih dari 1, buat Carousel (Slider)
  const indicators = items.map((_, i) => `
    <button type="button" data-bs-target="#carouselBingkai" data-bs-slide-to="${i}" class="${i === 0 ? 'active' : ''}" aria-label="Slide ${i+1}"></button>
  `).join('');

  const slides = items.map((item, i) => {
    const url = sb.storage.from('dokumentasi').getPublicUrl(item.path).data.publicUrl;
    return `
      <div class="carousel-item ${i === 0 ? 'active' : ''}">
        <a href="${esc(url)}" target="_blank" rel="noopener" class="bingkai-container">
          <img src="${esc(url)}" class="d-block w-100 bingkai-img" alt="Foto Torang Pekawan">
          ${item.judul ? `<div class="overlay-bingkai">${esc(item.judul)}</div>` : ''}
        </a>
      </div>
    `;
  }).join('');

  target.innerHTML = `
    <div id="carouselBingkai" class="carousel slide" data-bs-ride="carousel" data-bs-touch="true">
      <div class="carousel-indicators">${indicators}</div>
      <div class="carousel-inner">${slides}</div>
      <button class="carousel-control-prev" type="button" data-bs-target="#carouselBingkai" data-bs-slide="prev">
        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
      </button>
      <button class="carousel-control-next" type="button" data-bs-target="#carouselBingkai" data-bs-slide="next">
        <span class="carousel-control-next-icon" aria-hidden="true"></span>
      </button>
    </div>
  `;
}

async function loadRenungan() {
  const target = document.querySelector('#renungan');
  if (!target) return;

  target.innerHTML = '<p>Memuat renungan...</p>';

  const { data, error } = await sb
    .from('pengaturan')
    .select('key, value')
    .in('key', ['renungan_ayat', 'renungan_judul', 'renungan_isi']);

  if (error) {
    console.error('Renungan gagal dimuat:', error);
    target.innerHTML = '<p>Renungan gagal dimuat. Periksa koneksi dan izin akses Supabase.</p>';
    return;
  }

  const r = Object.fromEntries((data || []).map(x => [x.key, x.value || '']));
  const isi = (r.renungan_isi || '').trim();

  if (!isi) {
    target.innerHTML = `<div class="renungan-kosong"><p>Renungan belum tersedia.</p></div>`;
    return;
  }

  target.innerHTML = `
    ${r.renungan_ayat ? `<p class="renungan-ayat">${esc(r.renungan_ayat)}</p>` : ''}
    ${r.renungan_judul ? `<h2 class="renungan-judul">${esc(r.renungan_judul)}</h2>` : ''}
    <div class="renungan-isi">${esc(isi)}</div>`;
}

async function loadLogoNavbar() {
  const target = document.querySelector('.navbar-logo');
  if (!target) return;
  
  const { data } = await sb.from('pengaturan').select('value').eq('key', 'logo_navbar').maybeSingle();
  if (data && data.value) {
    const url = sb.storage.from('dokumentasi').getPublicUrl(data.value).data.publicUrl;
    target.src = url;
  } else {
    target.src = 'assets/foto/logo-pekawan.png'; // Fallback
  }
}

async function loadHero() {
  const target = document.querySelector('#hero-image');
  if (!target) return;

  const { data } = await sb.from('pengaturan').select('value').eq('key', 'foto_hero').maybeSingle();
  if (data && data.value) {
    const url = sb.storage.from('dokumentasi').getPublicUrl(data.value).data.publicUrl;
    target.src = url;
    target.style.display = 'block'; 
  } else {
    target.src = 'assets/foto/pekawan.jpg'; // Fallback
  }
}

/* ============ INIT ============ */
document.addEventListener('DOMContentLoaded', () => {
  loadLogoNavbar();
  loadHero();
  loadJadwal();
  loadGallery();
  loadKegiatan();
  loadBingkai();
  loadRenungan();
});