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

/* ============ JADWAL ============ */
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

  // Bulan + foto khadim
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

/* ============ DOKUMENTASI ============ */
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

/* ============ KEGIATAN ============ */
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

/* ============ FOTO BINGKAI ============ */
async function loadBingkai() {
  const target = $('#foto-bingkai');
  if (!target) return;
  const { data, error } = await sb.from('pengaturan').select('value').eq('key', 'foto_bingkai').maybeSingle();
  if (error) return;
  const path = data?.value || '';
  if (!path) return;
  const url = sb.storage.from('dokumentasi').getPublicUrl(path).data.publicUrl;
  target.innerHTML = `<img src="${esc(url)}" alt="Foto Torang Pekawan">`;
}

/* ============ RENUNGAN ============ */
async function loadRenungan() {
  const target = $('#renungan');
  if (!target) return;
  const { data, error } = await sb.from('pengaturan').select('key, value')
    .in('key', ['renungan_ayat', 'renungan_judul', 'renungan_isi']);
  if (error) return; // placeholder tetap tampil

  const r = Object.fromEntries((data || []).map(x => [x.key, x.value || '']));
  if (!r.renungan_isi.trim()) return;

  target.innerHTML = `
    ${r.renungan_ayat ? `<p class="renungan-ayat">${esc(r.renungan_ayat)}</p>` : ''}
    ${r.renungan_judul ? `<h2 class="renungan-judul">${esc(r.renungan_judul)}</h2>` : ''}
    <div class="renungan-isi">${esc(r.renungan_isi)}</div>`;
}

/* ============ INIT ============ */
document.addEventListener('DOMContentLoaded', () => {
  loadJadwal();
  loadGallery();
  loadKegiatan();
  loadBingkai();
  loadRenungan();
});