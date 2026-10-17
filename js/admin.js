const { createClient } = supabase;
const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const $ = (s, root = document) => root.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const msg = (s, ok = false) => {
  const e = $('#msg');
  if (e) { e.textContent = s; e.className = 'alert ' + (ok ? 'alert-success' : 'alert-danger'); e.hidden = false; }
};
const MAX_SIZE = 5 * 1024 * 1024;
const BUCKET = 'dokumentasi';

function publicUrl(path) {
  if (!path) return '';
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function initAdmin() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = 'login.html'; return; }
  const emailEl = $('#admin-email');
  if (emailEl) emailEl.textContent = session.user.email || 'Admin';
  await Promise.all([
    listJadwal(),
    listBulan(),
    listPhotos(),
    listKegiatan(),
    loadBingkai(),
    loadRenungan()
  ]);
}

/* ============ JADWAL ============ */
async function listJadwal() {
  const box = $('#admin-jadwal'); if (!box) return;
  const { data, error } = await sb.from('jadwal').select('*').order('tanggal').order('jam');
  if (error) { msg('Gagal membaca jadwal: ' + error.message); return; }
  box.innerHTML = (data || []).map(x => `
    <tr>
      <td>${esc(x.nama)}</td>
      <td>${esc(x.tanggal)}</td>
      <td>${esc(x.jam)}</td>
      <td>${esc(x.tempat)}</td>
      <td><button class="btn btn-sm btn-danger" data-del-jadwal="${x.id}">Hapus</button></td>
    </tr>`).join('') || '<tr><td colspan="5">Belum ada jadwal.</td></tr>';
}

/* ============ BULAN ============ */
async function listBulan() {
  const box = $('#admin-bulan'); if (!box) return;
  const { data, error } = await sb.from('bulan').select('*').order('created_at', { ascending: false });
  if (error) { msg('Gagal membaca bulan: ' + error.message); return; }
  box.innerHTML = (data || []).map(x => {
    const url = publicUrl(x.foto_path);
    return `
      <tr>
        <td>${esc(x.nama)}</td>
        <td>${url ? `<img src="${esc(url)}" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:8px">` : '-'}</td>
        <td>${x.aktif
          ? '<span class="badge bg-success">Aktif</span>'
          : '<span class="badge bg-secondary">Nonaktif</span>'}</td>
        <td>
          <button class="btn btn-sm btn-warning" data-edit-bulan="${x.id}" data-nama="${esc(x.nama)}">Edit</button>
          <button class="btn btn-sm btn-outline-secondary" data-toggle-bulan="${x.id}" data-aktif="${x.aktif}">
            ${x.aktif ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
          <button class="btn btn-sm btn-danger" data-del-bulan="${x.id}">Hapus</button>
        </td>
      </tr>`;
  }).join('') || '<tr><td colspan="4">Belum ada bulan.</td></tr>';

  await loadKhadimForm();
}

async function simpanBulan() {
  const id = $('#bulan-id').value;
  const nama = $('#bulan-nama').value.trim();
  if (!nama) { msg('Nama bulan tidak boleh kosong.'); return; }

  if (id) {
    const { error } = await sb.from('bulan').update({ nama }).eq('id', id);
    if (error) { msg('Gagal update bulan: ' + error.message); return; }
    msg('Bulan berhasil diperbarui.', true);
  } else {
    const { error: e1 } = await sb.from('bulan').update({ aktif: false }).neq('id', 0);
    if (e1) { msg('Gagal reset status bulan: ' + e1.message); return; }
    const { error } = await sb.from('bulan').insert({ nama, aktif: true });
    if (error) { msg('Gagal menambah bulan: ' + error.message); return; }
    msg('Bulan berhasil ditambahkan & diaktifkan.', true);
  }

  resetFormBulan();
  await listBulan();
}

function resetFormBulan() {
  $('#bulan-id').value = '';
  $('#bulan-nama').value = '';
  $('#bulan-submit').textContent = 'Tambah bulan';
}

/* ============ FOTO KHADIM ============ */
async function getBulanAktif() {
  const { data } = await sb.from('bulan')
    .select('*').eq('aktif', true)
    .order('created_at', { ascending: false })
    .limit(1);
  return data && data.length ? data[0] : null;
}

async function loadKhadimForm() {
  const aktif = await getBulanAktif();
  const judulInput = $('#khadim-judul');
  const preview = $('#khadim-preview');

  if (!aktif) {
    if (judulInput) judulInput.value = '';
    if (preview) preview.innerHTML = '<p class="text-muted small mb-0">Belum ada bulan aktif. Tambahkan bulan dulu.</p>';
    return;
  }

  if (judulInput) judulInput.value = aktif.foto_judul || '';
  if (preview) {
    const url = publicUrl(aktif.foto_path);
    preview.innerHTML = url
      ? `<img src="${esc(url)}" alt="Foto khadim" style="max-width:200px;border-radius:12px;border:3px solid #fff;box-shadow:0 4px 12px rgba(67,48,124,0.2)">`
      : '<p class="text-muted small mb-0">Belum ada foto khadim untuk bulan ini.</p>';
  }
}

async function simpanKhadim(file) {
  const aktif = await getBulanAktif();
  if (!aktif) { msg('Belum ada bulan aktif. Tambahkan bulan dulu.'); return; }

  let fotoPath = aktif.foto_path || '';

  if (file) {
    if (file.size > MAX_SIZE) { msg('Ukuran foto maksimal 5 MB.'); return; }

    if (fotoPath) {
      await sb.storage.from(BUCKET).remove([fotoPath]);
    }

    const newPath = `khadim/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: upErr } = await sb.storage.from(BUCKET).upload(newPath, file, { upsert: false });
    if (upErr) { msg('Upload gagal: ' + upErr.message); return; }
    fotoPath = newPath;
  }

  const judul = $('#khadim-judul').value.trim();

  const { error } = await sb.from('bulan').update({
    foto_path: fotoPath,
    foto_judul: judul
  }).eq('id', aktif.id);

  if (error) { msg('Gagal menyimpan foto khadim: ' + error.message); return; }
  msg('Foto khadim berhasil disimpan.', true);
  await listBulan();
}

async function hapusKhadim() {
  const aktif = await getBulanAktif();
  if (!aktif) return;
  if (aktif.foto_path) {
    await sb.storage.from(BUCKET).remove([aktif.foto_path]);
  }
  await sb.from('bulan').update({ foto_path: '', foto_judul: '' }).eq('id', aktif.id);
  msg('Foto khadim dihapus.', true);
  await listBulan();
}

/* ============ DOKUMENTASI ============ */
async function listPhotos() {
  const box = $('#admin-foto'); if (!box) return;
  const { data, error } = await sb.from('dokumentasi').select('*').order('created_at', { ascending: false });
  if (error) { msg('Gagal membaca dokumentasi: ' + error.message); return; }
  box.innerHTML = (data || []).map(x => {
    const url = publicUrl(x.path);
    return `
      <tr>
        <td>${url ? `<img src="${esc(url)}" alt="" style="width:80px;height:60px;object-fit:cover;border-radius:8px">` : '-'}</td>
        <td>${esc(x.judul) || '<em class="text-muted">Tanpa judul</em>'}</td>
        <td><small>${esc(x.path)}</small></td>
        <td><button class="btn btn-sm btn-danger" data-del-photo="${x.id}" data-path="${esc(x.path || '')}">Hapus</button></td>
      </tr>`;
  }).join('') || '<tr><td colspan="4">Belum ada dokumentasi.</td></tr>';
}

/* ============ KEGIATAN ============ */
async function listKegiatan() {
  const box = $('#admin-kegiatan'); if (!box) return;
  const { data, error } = await sb.from('kegiatan').select('*').order('created_at', { ascending: false });
  if (error) { msg('Gagal membaca kegiatan: ' + error.message); return; }
  box.innerHTML = (data || []).map(x => {
    const url = publicUrl(x.path);
    return `
      <tr>
        <td>${url ? `<img src="${esc(url)}" alt="" style="width:100px;height:70px;object-fit:cover;border-radius:8px">` : '-'}</td>
        <td>${esc(x.judul) || '<em class="text-muted">Tanpa judul</em>'}</td>
        <td><small>${esc(x.path)}</small></td>
        <td><button class="btn btn-sm btn-danger" data-del-kegiatan="${x.id}" data-path="${esc(x.path || '')}">Hapus</button></td>
      </tr>`;
  }).join('') || '<tr><td colspan="4">Belum ada kegiatan.</td></tr>';
}

/* ============ FOTO BINGKAI (MULTIPLE) ============ */
async function loadBingkai() {
  const box = $('#bingkai-preview'); if (!box) return;
  const { data, error } = await sb.from('pengaturan').select('value').eq('key', 'foto_bingkai').maybeSingle();
  if (error) return;
  
  let paths = [];
  try {
    paths = JSON.parse(data?.value) || [];
    if (!Array.isArray(paths)) paths = data.value ? [data.value] : [];
  } catch(e) { if (data?.value) paths = [data.value]; }

  if (!paths.length) {
    box.innerHTML = `<div class="foto-jadwal-kosong"><i class="bi bi-image"></i></div>`;
    return;
  }

  box.innerHTML = paths.map(path => {
    const url = publicUrl(path);
    return `<img src="${esc(url)}" alt="Foto bingkai" style="width:120px;height:80px;object-fit:cover;border-radius:8px;margin:4px;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.2)">`;
  }).join('');
}

async function simpanBingkai(jsonArray) {
  const { data: existing } = await sb.from('pengaturan').select('key').eq('key', 'foto_bingkai').maybeSingle();
  if (existing) {
    return await sb.from('pengaturan').update({ value: jsonArray, updated_at: new Date().toISOString() }).eq('key', 'foto_bingkai');
  }
  return await sb.from('pengaturan').insert({ key: 'foto_bingkai', value: jsonArray });
}

async function getBingkaiPath() {
  const { data } = await sb.from('pengaturan').select('value').eq('key', 'foto_bingkai').maybeSingle();
  return data?.value || '';
}

/* ============ RENUNGAN ============ */
const RENUNGAN_KEYS = ['renungan_ayat', 'renungan_judul', 'renungan_isi'];

async function getRenungan() {
  const { data, error } = await sb.from('pengaturan').select('key, value').in('key', RENUNGAN_KEYS);
  if (error) return { error };
  const r = Object.fromEntries((data || []).map(x => [x.key, x.value]));
  return { ayat: r.renungan_ayat || '', judul: r.renungan_judul || '', isi: r.renungan_isi || '' };
}

async function setPengaturan(key, value) {
  const { data: ada, error: e1 } = await sb.from('pengaturan').select('key').eq('key', key).maybeSingle();
  if (e1) return { error: e1 };

  const hasil = ada
    ? await sb.from('pengaturan').update({ value, updated_at: new Date().toISOString() }).eq('key', key).select('key')
    : await sb.from('pengaturan').insert({ key, value }).select('key');

  if (!hasil.error && (!hasil.data || !hasil.data.length)) {
    return { error: { message: `"${key}" tidak tersimpan: ditolak kebijakan akses (RLS).` } };
  }
  return hasil;
}

function updateHitungRenungan() {
  const isi = $('#renungan-isi'), hitung = $('#renungan-hitung');
  if (isi && hitung) hitung.textContent = `${isi.value.length} / 5000`;
}

async function loadRenungan() {
  if (!$('#renungan-form')) return;
  const r = await getRenungan();
  if (r.error) { msg('Gagal membaca renungan: ' + r.error.message); return; }
  $('#renungan-ayat').value = r.ayat;
  $('#renungan-judul').value = r.judul;
  $('#renungan-isi').value = r.isi;
  updateHitungRenungan();
}

async function simpanRenungan(kosong = false) {
  const ayat = kosong ? '' : $('#renungan-ayat').value.trim();
  const judul = kosong ? '' : $('#renungan-judul').value.trim();
  const isi = kosong ? '' : $('#renungan-isi').value.trim();

  if (ayat.length > 100 || judul.length > 100) { msg('Ayat dan judul maksimal 100 karakter.'); return; }
  if (isi.length > 5000) { msg('Isi renungan maksimal 5000 karakter.'); return; }

  const hasil = await Promise.all([
    setPengaturan('renungan_ayat', ayat),
    setPengaturan('renungan_judul', judul),
    setPengaturan('renungan_isi', isi)
  ]);
  const gagal = hasil.find(h => h.error);
  if (gagal) { msg('Gagal menyimpan renungan: ' + gagal.error.message); return; }

  msg(kosong ? 'Renungan dikosongkan.' : 'Renungan berhasil disimpan.', true);
  await loadRenungan();
}

/* ============ EVENT ============ */
document.addEventListener('DOMContentLoaded', async () => {
  /* --- LOGIN --- */
  if ($('#login-form')) {
    $('#login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const { error } = await sb.auth.signInWithPassword({
        email: $('#email').value,
        password: $('#password').value
      });
      if (error) msg('Login gagal: ' + error.message);
      else location.href = 'index.html';
    });
    return;
  }

  /* --- INIT --- */
  if ($('#admin-jadwal') || $('#admin-foto') || $('#admin-kegiatan') || $('#admin-bulan') || $('#bingkai-preview') || $('#renungan-form')) {
    await initAdmin();
  }

  /* --- LOGOUT --- */
  $('#logout')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    location.href = 'login.html';
  });

  /* --- TAMBAH JADWAL --- */
  $('#jadwal-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      nama: $('#nama').value.trim(),
      tanggal: $('#tanggal').value,
      tempat: $('#tempat').value.trim(),
      jam: $('#jam').value.trim(),
      khadim: $('#khadim').value.trim()
    };
    const { error } = await sb.from('jadwal').insert(payload);
    if (error) msg('Gagal menyimpan: ' + error.message);
    else { msg('Jadwal berhasil disimpan.', true); e.target.reset(); await listJadwal(); }
  });

  /* --- BULAN FORM --- */
  $('#bulan-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    await simpanBulan();
  });

  /* --- FOTO KHADIM --- */
  $('#khadim-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const file = $('#khadim-file').files[0] || null;
    await simpanKhadim(file);
    e.target.reset();
  });

  $('#hapus-khadim')?.addEventListener('click', async () => {
    if (!confirm('Hapus foto khadim bulan ini?')) return;
    await hapusKhadim();
  });

  /* --- UPLOAD DOKUMENTASI --- */
  $('#upload-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const file = $('#foto').files[0];
    if (!file) { msg('Pilih foto terlebih dahulu.'); return; }
    if (file.size > MAX_SIZE) { msg('Ukuran foto maksimal 5 MB.'); return; }

    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (upErr) { msg('Upload gagal: ' + upErr.message); return; }

    const { error } = await sb.from('dokumentasi').insert({
      judul: $('#judul-foto').value.trim(),
      path
    });
    if (error) { msg('File terunggah tetapi metadata gagal disimpan: ' + error.message); return; }
    msg('Foto berhasil diunggah.', true);
    e.target.reset();
    await listPhotos();
  });

  /* --- UPLOAD KEGIATAN --- */
  $('#kegiatan-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const file = $('#foto-kegiatan').files[0];
    if (!file) { msg('Pilih foto terlebih dahulu.'); return; }
    if (file.size > MAX_SIZE) { msg('Ukuran foto maksimal 5 MB.'); return; }

    const path = `kegiatan/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (upErr) { msg('Upload gagal: ' + upErr.message); return; }

    const { error } = await sb.from('kegiatan').insert({
      judul: $('#judul-kegiatan').value.trim(),
      path
    });
    if (error) { msg('File terunggah tetapi metadata gagal disimpan: ' + error.message); return; }
    msg('Kegiatan berhasil diunggah.', true);
    e.target.reset();
    await listKegiatan();
  });

  /* --- UPLOAD FOTO BINGKAI (MULTIPLE) --- */
  $('#bingkai-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const files = $('#bingkai-file').files;
    if (!files.length) { msg('Pilih minimal satu foto.'); return; }

    msg('Sedang mengunggah...', true);
    const uploadPromises = Array.from(files).map(async (file) => {
      if (file.size > MAX_SIZE) throw new Error(`File ${file.name} melebihi 5 MB.`);
      const path = `bingkai/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (error) throw error;
      return path;
    });

    try {
      const newPaths = await Promise.all(uploadPromises);
      
      const oldPathStr = await getBingkaiPath();
      let oldPaths = [];
      try {
        oldPaths = JSON.parse(oldPathStr) || [];
        if (!Array.isArray(oldPaths)) oldPaths = oldPathStr ? [oldPathStr] : [];
      } catch(err) { if (oldPathStr) oldPaths = [oldPathStr]; }
      
      const allPaths = [...oldPaths, ...newPaths];
      await simpanBingkai(JSON.stringify(allPaths));
      
      msg('Foto bingkai berhasil diunggah.', true);
      e.target.reset();
      await loadBingkai();
    } catch (err) {
      msg('Upload gagal: ' + err.message);
    }
  });

  /* --- HAPUS FOTO BINGKAI --- */
  $('#hapus-bingkai')?.addEventListener('click', async () => {
    if (!confirm('Hapus SEMUA foto bingkai?')) return;
    const oldPathStr = await getBingkaiPath();
    let oldPaths = [];
    try {
      oldPaths = JSON.parse(oldPathStr) || [];
      if (!Array.isArray(oldPaths)) oldPaths = oldPathStr ? [oldPathStr] : [];
    } catch(err) { if (oldPathStr) oldPaths = [oldPathStr]; }
    
    if (oldPaths.length) {
      await sb.storage.from(BUCKET).remove(oldPaths);
    }
    await simpanBingkai('[]');
    msg('Semua foto bingkai dihapus.', true);
    await loadBingkai();
  });

  /* --- RENUNGAN --- */
  $('#renungan-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    await simpanRenungan();
  });

  $('#renungan-isi')?.addEventListener('input', updateHitungRenungan);

  $('#hapus-renungan')?.addEventListener('click', async () => {
    if (!confirm('Kosongkan renungan di website?')) return;
    await simpanRenungan(true);
  });

  /* --- DELEGASI KLIK --- */
  document.addEventListener('click', async e => {
    /* Hapus jadwal */
    const j = e.target.closest('[data-del-jadwal]');
    if (j && confirm('Hapus jadwal ini?')) {
      const { error } = await sb.from('jadwal').delete().eq('id', j.dataset.delJadwal);
      if (error) msg(error.message);
      else { msg('Jadwal dihapus.', true); await listJadwal(); }
    }

    /* Hapus dokumentasi */
    const p = e.target.closest('[data-del-photo]');
    if (p && confirm('Hapus dokumentasi ini?')) {
      if (p.dataset.path) {
        const { error: se } = await sb.storage.from(BUCKET).remove([p.dataset.path]);
        if (se) { msg(se.message); return; }
      }
      const { error } = await sb.from('dokumentasi').delete().eq('id', p.dataset.delPhoto);
      if (error) msg(error.message);
      else { msg('Dokumentasi dihapus.', true); await listPhotos(); }
    }

    /* Hapus kegiatan */
    const k = e.target.closest('[data-del-kegiatan]');
    if (k && confirm('Hapus kegiatan ini?')) {
      if (k.dataset.path) {
        const { error: se } = await sb.storage.from(BUCKET).remove([k.dataset.path]);
        if (se) { msg(se.message); return; }
      }
      const { error } = await sb.from('kegiatan').delete().eq('id', k.dataset.delKegiatan);
      if (error) msg(error.message);
      else { msg('Kegiatan dihapus.', true); await listKegiatan(); }
    }

    /* Edit bulan */
    const eb = e.target.closest('[data-edit-bulan]');
    if (eb) {
      $('#bulan-id').value = eb.dataset.editBulan;
      $('#bulan-nama').value = eb.dataset.nama;
      $('#bulan-submit').textContent = 'Update bulan';
      $('#bulan-nama').focus();
      window.scrollTo({ top: $('#bulan-form').offsetTop - 100, behavior: 'smooth' });
    }

    /* Toggle aktif bulan */
    const tb = e.target.closest('[data-toggle-bulan]');
    if (tb) {
      const aktifBaru = tb.dataset.aktif !== 'true';
      if (aktifBaru) {
        await sb.from('bulan').update({ aktif: false }).neq('id', 0);
      }
      const { error } = await sb.from('bulan').update({ aktif: aktifBaru }).eq('id', tb.dataset.toggleBulan);
      if (error) msg(error.message);
      else { msg('Status bulan diperbarui.', true); await listBulan(); }
    }

    /* Hapus bulan */
    const db = e.target.closest('[data-del-bulan]');
    if (db && confirm('Hapus bulan ini?')) {
      const { error } = await sb.from('bulan').delete().eq('id', db.dataset.delBulan);
      if (error) msg(error.message);
      else { msg('Bulan dihapus.', true); await listBulan(); }
    }
  });
});