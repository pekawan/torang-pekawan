const { createClient } = supabase;
const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const $ = (s,root=document)=>root.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const msg=(s,ok=false)=>{const e=$('#msg');if(e){e.textContent=s;e.className='alert '+(ok?'alert-success':'alert-danger');e.hidden=false;}};
async function initAdmin(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){location.href='login.html';return;}
 $('#admin-email').textContent=session.user.email||'Admin';
 await Promise.all([listJadwal(),listPhotos()]);
}
async function listJadwal(){
 const box=$('#admin-jadwal');if(!box)return;
 const {data,error}=await sb.from('jadwal').select('*').order('tanggal').order('jam');
 if(error){msg('Gagal membaca jadwal: '+error.message);return;}
 box.innerHTML=(data||[]).map(x=>`<tr><td>${esc(x.nama)}</td><td>${esc(x.tanggal)}</td><td>${esc(x.jam)}</td><td>${esc(x.tempat)}</td><td><button class="btn btn-sm btn-danger" data-del-jadwal="${x.id}">Hapus</button></td></tr>`).join('')||'<tr><td colspan="5">Belum ada jadwal.</td></tr>';
}
async function listPhotos(){
 const box=$('#admin-foto');if(!box)return;
 const {data,error}=await sb.from('dokumentasi').select('*').order('created_at',{ascending:false});
 if(error){msg('Gagal membaca dokumentasi: '+error.message);return;}
 box.innerHTML=(data||[]).map(x=>`<tr><td>${esc(x.judul)}</td><td>${esc(x.path||x.url)}</td><td><button class="btn btn-sm btn-danger" data-del-photo="${x.id}" data-path="${esc(x.path||'')}">Hapus</button></td></tr>`).join('')||'<tr><td colspan="3">Belum ada dokumentasi.</td></tr>';
}
document.addEventListener('DOMContentLoaded',async()=>{
 if($('#login-form')){
  $('#login-form').addEventListener('submit',async e=>{e.preventDefault();const {error}=await sb.auth.signInWithPassword({email:$('#email').value,password:$('#password').value});if(error)msg('Login gagal: '+error.message);else location.href='index.html';});
  return;
 }
 if($('#admin-jadwal')) await initAdmin();
 $('#logout')?.addEventListener('click',async()=>{await sb.auth.signOut();location.href='login.html';});
 $('#jadwal-form')?.addEventListener('submit',async e=>{e.preventDefault();const payload={nama:$('#nama').value.trim(),tanggal:$('#tanggal').value,tempat:$('#tempat').value.trim(),jam:$('#jam').value.trim(),khadim:$('#khadim').value.trim()};const {error}=await sb.from('jadwal').insert(payload);if(error)msg('Gagal menyimpan: '+error.message);else{msg('Jadwal berhasil disimpan.',true);e.target.reset();await listJadwal();}});
 $('#upload-form')?.addEventListener('submit',async e=>{e.preventDefault();const file=$('#foto').files[0];if(!file){msg('Pilih foto terlebih dahulu.');return;}if(file.size>5*1024*1024){msg('Ukuran foto maksimal 5 MB.');return;}const path=`${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const {error:upErr}=await sb.storage.from('dokumentasi').upload(path,file,{upsert:false});if(upErr){msg('Upload gagal: '+upErr.message);return;}const {error}=await sb.from('dokumentasi').insert({judul:$('#judul-foto').value.trim(),path});if(error){msg('File terunggah tetapi metadata gagal disimpan: '+error.message);return;}msg('Foto berhasil diunggah.',true);e.target.reset();await listPhotos();});
 document.addEventListener('click',async e=>{
  const j=e.target.closest('[data-del-jadwal]');if(j&&confirm('Hapus jadwal ini?')){const {error}=await sb.from('jadwal').delete().eq('id',j.dataset.delJadwal);if(error)msg(error.message);else{msg('Jadwal dihapus.',true);await listJadwal();}}
  const p=e.target.closest('[data-del-photo]');if(p&&confirm('Hapus dokumentasi ini?')){if(p.dataset.path){const {error:se}=await sb.storage.from('dokumentasi').remove([p.dataset.path]);if(se){msg(se.message);return;}}const {error}=await sb.from('dokumentasi').delete().eq('id',p.dataset.delPhoto);if(error)msg(error.message);else{msg('Dokumentasi dihapus.',true);await listPhotos();}}
 });
});
