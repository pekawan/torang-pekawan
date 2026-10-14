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
  await Promise.all([listJadwal(), listPhotos(), listKegiatan(), loadBingkai()]);
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

/* ============ FOTO BINGKAI ============ */
async function loadBingkai() {
  const box = $('#bingkai-preview'); if (!box) return;
  const { data, error } = await sb.from('pengaturan').select('value').eq('key', 'foto_bingkai').maybeSingle();
  if (error) { msg('Gagal membaca foto bingkai: ' + error.message); return; }
  const path = data?.value || '';
  const url = publicUrl(path);
  box.innerHTML = url
    ? `<img src="${esc(url)}" alt="Foto bingkai" style="width:100%;max-height:280px;object-fit:cover;border-radius:16px">`
    : `<div class="foto-jadwal-kosong"><i class="bi bi-image"></i></div>`;
}

async function simpanBingkai(path) {
  const { data: existing } = await sb.from('pengaturan').select('key').eq('key', 'foto_bingkai').maybeSingle();
  if (existing) {
    return await sb.from('pengaturan').update({ value: path, updated_at: new Date().toISOString() }).eq('key', 'foto_bingkai');
  }
  return await sb.from('pengaturan').insert({ key: 'foto_bingkai', value: path });
}

async function getBingkaiPath() {
  const { data } = await sb.from('pengaturan').select('value').eq('key', 'foto_bingkai').maybeSingle();
  return data?.value || '';
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
  if ($('#admin-jadwal') || $('#admin-foto') || $('#admin-kegiatan') || $('#bingkai-preview')) {
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

  /* --- UPLOAD FOTO BINGKAI --- */
  $('#bingkai-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const file = $('#bingkai-file').files[0];
    if (!file) { msg('Pilih foto terlebih dahulu.'); return; }
    if (file.size > MAX_SIZE) { msg('Ukuran foto maksimal 5 MB.'); return; }

    const oldPath = await getBingkaiPath();
    const path = `bingkai/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (upErr) { msg('Upload gagal: ' + upErr.message); return; }

    const { error } = await simpanBingkai(path);
    if (error) { msg('Gagal menyimpan foto bingkai: ' + error.message); return; }

    if (oldPath && oldPath !== path) {
      await sb.storage.from(BUCKET).remove([oldPath]);
    }

    msg('Foto bingkai berhasil diunggah.', true);
    e.target.reset();
    await loadBingkai();
  });

  /* --- HAPUS FOTO BINGKAI --- */
  $('#hapus-bingkai')?.addEventListener('click', async () => {
    if (!confirm('Hapus foto bingkai?')) return;
    const oldPath = await getBingkaiPath();
    if (oldPath) await sb.storage.from(BUCKET).remove([oldPath]);
    await simpanBingkai('');
    msg('Foto bingkai dihapus.', true);
    await loadBingkai();
  });

  /* --- HAPUS (delegasi) --- */
  document.addEventListener('click', async e => {
    const j = e.target.closest('[data-del-jadwal]');
    if (j && confirm('Hapus jadwal ini?')) {
      const { error } = await sb.from('jadwal').delete().eq('id', j.dataset.delJadwal);
      if (error) msg(error.message);
      else { msg('Jadwal dihapus.', true); await listJadwal(); }
    }

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
  });
});