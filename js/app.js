const { createClient } = supabase;
const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const $ = (s, root=document) => root.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fmtDate(s) {
  if (!s) return '';
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d) ? s : new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'short',year:'numeric'}).format(d);
}
function cardJadwal(x) {
 return `<article class="jadwal-item"><h4>${esc(x.nama)}</h4><p>${esc(fmtDate(x.tanggal))}<br>${esc(x.tempat)}<br>${esc(x.jam)}<br>Khadim: ${esc(x.khadim || '-')}</p></article>`;
}
async function loadJadwal() {
 const target = $('#jadwal-list');
 if (!target) return;
 const {data,error}=await sb.from('jadwal').select('*').order('tanggal').order('jam');
 if(error){ target.innerHTML='<p>Jadwal belum dapat dimuat. Periksa konfigurasi Supabase.</p>'; return; }
 target.innerHTML=data.length ? data.map(cardJadwal).join('') : '<p>Belum ada jadwal ibadah.</p>';
 const bulan=$('#jadwal-bulan'); if(bulan) bulan.textContent = data.length ? new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(data[0].tanggal+'T00:00:00')) : 'Jadwal Ibadah';
}
async function loadGallery() {
 const target=$('#galeri-grid'); if(!target) return;
 const {data,error}=await sb.from('dokumentasi').select('*').order('created_at',{ascending:false});
 if(error){target.innerHTML='<p>Dokumentasi belum dapat dimuat. Periksa konfigurasi Supabase.</p>';return;}
 const photos=(data||[]).map(x=>({...x,url:x.url || (x.path ? sb.storage.from('dokumentasi').getPublicUrl(x.path).data.publicUrl : '')})).filter(x=>x.url);
 target.innerHTML=photos.length?photos.map(x=>`<figure class="galeri-kartu"><a class="galeri-item" href="${esc(x.url)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(x.url)}" alt="${esc(x.judul||'Dokumentasi Torang Pekawan')}"></a>${x.judul?`<figcaption>${esc(x.judul)}</figcaption>`:''}</figure>`).join(''):'<p>Dokumentasi akan segera hadir.</p>';
}
document.addEventListener('DOMContentLoaded',()=>{loadJadwal();loadGallery();});
