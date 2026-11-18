/* Admin editor for the Jija Studio homepage campaign carousel. */
(() => {
  const $ = id => document.getElementById(id);
  const list = $('home-banner-editor-list'), addButton = $('add-home-banner'), saveButton = $('save-home-banners'), status = $('home-banners-status');
  if (!list || !addButton || !saveButton || !status) return;
  const SETTINGS_KEY = 'jijaAdminSettings';
  let draft = [], products = readProducts(), dirty = false;
  function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
  function settingsNow() { const v = readJson(SETTINGS_KEY, {}); return v && typeof v === 'object' ? v : {}; }
  function readProducts() {
    const saved = readJson('jijaAdminProducts', []);
    const rows = Array.isArray(saved) ? saved : (saved && typeof saved === 'object' ? Object.values(saved) : []);
    return rows.filter(p => p && typeof p === 'object' && !p._deleted && p.published !== false && p.name && p.id);
  }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function statusText(message, error = false) { status.textContent = message; status.style.color = error ? '#a32222' : ''; }
  function normalise(row, i) {
    return {
      id: String(row?.id || ('campaign-' + (i + 1) + '-' + Date.now())),
      active: row?.active !== false, eyebrow: String(row?.eyebrow || ''), title: String(row?.title || ''),
      subtitle: String(row?.subtitle || ''), ctaText: String(row?.ctaText || 'Shop now'),
      mediaType: row?.mediaType === 'video' ? 'video' : 'image',
      mediaUrl: String(row?.mediaUrl || row?.image || row?.src || ''), mobileMediaUrl: String(row?.mobileMediaUrl || ''),
      alt: String(row?.alt || ''), duration: Math.max(3, Math.min(60, Number(row?.duration) || 10)),
      destinationType: ['product','category','url','shop'].includes(row?.destinationType) ? row.destinationType : 'shop',
      productId: String(row?.productId || ''), category: String(row?.category || ''), destinationUrl: String(row?.destinationUrl || '')
    };
  }
  function initialDraft() {
    const s = settingsNow();
    if (Array.isArray(s.homeBanners)) return s.homeBanners.map((b, i) => normalise(b, i));
    if (s.bannerSrc) return [normalise({id:'legacy-banner',title:s.heroTitle||'',subtitle:s.heroSubtitle||'',mediaType:s.bannerType||'image',mediaUrl:s.bannerSrc,alt:s.bannerAlt||'Jija Studio featured banner',duration:10,ctaText:'Shop now',destinationType:'shop'},0)];
    return [];
  }
  function categoryOptions(selected) {
    const s = settingsNow();
    const names = [...new Set([...products.map(p=>p.category),...(Array.isArray(s.categories)?s.categories:[]),...(Array.isArray(s.collectionCards)?s.collectionCards.map(c=>c?.category):[]),selected]
      .map(x=>String(x||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    return '<option value="">Choose a category</option>'+names.map(n=>'<option value="'+esc(n)+'" '+(n===selected?'selected':'')+'>'+esc(n)+'</option>').join('');
  }
  function productOptions(selected) {
    if (!products.length) return '<option value="">No published products loaded yet</option>';
    return '<option value="">Choose a product</option>'+products.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name)))
      .map(p=>'<option value="'+esc(p.id)+'" '+(String(p.id)===String(selected)?'selected':'')+'>'+esc(p.name)+' · '+esc(p.category||'Uncategorised')+'</option>').join('');
  }
  function previewHtml(b) {
    if (!b.mediaUrl) return '<div class="admin-banner-empty-preview">Add a media URL or upload an image to preview this frame.</div>';
    return b.mediaType==='video'
      ? '<video class="admin-preview" data-preview-media controls muted playsinline preload="metadata" src="'+esc(b.mediaUrl)+'"></video>'
      : '<img class="admin-preview" data-preview-media src="'+esc(b.mediaUrl)+'" alt="'+esc(b.alt||b.title||'Campaign banner preview')+'">';
  }
  function render() {
    if (!draft.length) { list.innerHTML='<div class="admin-banner-empty-preview">No campaign frames yet. Add a banner to start a homepage slideshow.</div>'; return; }
    list.innerHTML = draft.map((b,i) => `
      <section class="home-banner-editor-card" data-banner-index="${i}" style="border:1px solid var(--line);border-radius:12px;padding:14px;margin:12px 0;background:#fff">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px">
          <strong>Banner frame ${i+1}</strong><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px"><input data-field="active" type="checkbox" ${b.active?'checked':''} style="width:auto;min-height:0"> Publish</label>
          <button type="button" class="button button-outline" data-up="${i}" ${i===0?'disabled':''} aria-label="Move up">↑</button>
          <button type="button" class="button button-outline" data-down="${i}" ${i===draft.length-1?'disabled':''} aria-label="Move down">↓</button>
          <button type="button" class="button button-outline" data-remove="${i}">Remove</button></div>
        </div>
        <div class="admin-grid">
          <div class="admin-field"><label>Media type</label><select data-field="mediaType"><option value="image" ${b.mediaType==='image'?'selected':''}>Image banner</option><option value="video" ${b.mediaType==='video'?'selected':''}>Video campaign</option></select></div>
          <div class="admin-field"><label>Auto-advance duration (seconds)</label><input type="number" min="3" max="60" data-field="duration" value="${esc(b.duration)}"><small>Images default to 10 seconds. Videos advance when playback finishes.</small></div>
          <div class="admin-field full"><label>Main image / video URL or path</label><input data-field="mediaUrl" value="${esc(b.mediaUrl)}" placeholder="https://... or images/new-saree-banner.jpg"><small>${b.mediaType==='video'?'Use an HTTPS video URL from the Media URL converter.':'Use a wide desktop banner; uploaded images are compressed.'}</small></div>
          <div class="admin-field full"><label>Upload main banner image</label><input type="file" accept="image/png,image/jpeg,image/webp" data-upload="mediaUrl"><small>Images up to 5 MB are compressed before saving. For video, use the Media URL converter tab.</small></div>
          <div class="admin-field full"><label>Mobile banner image URL (optional)</label><input data-field="mobileMediaUrl" value="${esc(b.mobileMediaUrl)}" placeholder="Portrait mobile banner URL (optional)"><small>Without a separate mobile image, the full desktop image is shown without cropping.</small></div>
          <div class="admin-field full"><label>Upload mobile banner image (optional)</label><input type="file" accept="image/png,image/jpeg,image/webp" data-upload="mobileMediaUrl"></div>
          <div class="admin-field"><label>Image description (alt text)</label><input data-field="alt" value="${esc(b.alt)}" placeholder="New festive saree collection"></div>
          <div class="admin-field"><label>Campaign label / overline</label><input data-field="eyebrow" value="${esc(b.eyebrow)}" placeholder="NEW ARRIVAL · FESTIVE EDIT"></div>
          <div class="admin-field full"><label>Headline</label><input data-field="title" value="${esc(b.title)}" placeholder="The new saree collection"></div>
          <div class="admin-field full"><label>Short description</label><textarea data-field="subtitle" rows="2" placeholder="A new look for your special moments">${esc(b.subtitle)}</textarea></div>
          <div class="admin-field"><label>Button text</label><input data-field="ctaText" value="${esc(b.ctaText)}" placeholder="Shop the collection"></div>
          <div class="admin-field"><label>Click destination</label><select data-field="destinationType"><option value="shop" ${b.destinationType==='shop'?'selected':''}>Shop all products</option><option value="category" ${b.destinationType==='category'?'selected':''}>Product category</option><option value="product" ${b.destinationType==='product'?'selected':''}>Specific product</option><option value="url" ${b.destinationType==='url'?'selected':''}>Custom page / URL</option></select></div>
          <div class="admin-field campaign-destination-product" ${b.destinationType==='product'?'':'hidden'}><label>Linked product</label><select data-field="productId">${productOptions(b.productId)}</select></div>
          <div class="admin-field campaign-destination-category" ${b.destinationType==='category'?'':'hidden'}><label>Product category</label><select data-field="category">${categoryOptions(b.category)}</select></div>
          <div class="admin-field full campaign-destination-url" ${b.destinationType==='url'?'':'hidden'}><label>Custom destination URL</label><input data-field="destinationUrl" value="${esc(b.destinationUrl)}" placeholder="shop.html?category=Sarees or https://..."></div>
          <div class="admin-field full"><label>Frame preview</label><div data-preview-wrap>${previewHtml(b)}</div></div>
        </div>
      </section>`).join('');
    bindCardEvents();
  }
  function bindCardEvents() {
    list.querySelectorAll('[data-banner-index]').forEach(card => {
      const i=Number(card.dataset.bannerIndex);
      card.querySelectorAll('[data-field]').forEach(field => field.addEventListener(field.type==='checkbox'||field.tagName==='SELECT'?'change':'input', () => {
        const key=field.dataset.field;
        draft[i][key]=field.type==='checkbox'?field.checked:(key==='duration'?Number(field.value):field.value);
        dirty=true;
        if(key==='destinationType') updateVisibility(card,draft[i]);
        if(['mediaUrl','alt','title','mediaType'].includes(key)) updatePreview(card,draft[i]);
      }));
      card.querySelectorAll('[data-upload]').forEach(input => input.addEventListener('change',async e=>{
        const file=e.target.files?.[0]; if(!file)return;
        if(file.size>5_000_000){statusText('Choose an image under 5 MB; it will be compressed.',true);e.target.value='';return;}
        statusText('Compressing banner image…');
        try{draft[i][input.dataset.upload]=await compressImage(file);dirty=true;render();statusText('Image ready. Save the banner carousel to publish it.');}
        catch(err){statusText(err.message||'Could not process this image.',true);}
      }));
      card.querySelector('[data-remove]')?.addEventListener('click',()=>{draft.splice(i,1);dirty=true;render();statusText('Frame removed from the draft. Save to publish.');});
      card.querySelector('[data-up]')?.addEventListener('click',()=>move(i,-1));
      card.querySelector('[data-down]')?.addEventListener('click',()=>move(i,1));
    });
  }
  function updatePreview(card,b) {
    const wrap=card.querySelector('[data-preview-wrap]'); if(!wrap)return;
    if(!b.mediaUrl){wrap.innerHTML='<div class="admin-banner-empty-preview">Add a media URL or upload an image to preview this frame.</div>';return;}
    if(b.mediaType==='video'){
      if(!wrap.querySelector('video[data-preview-media]')) wrap.innerHTML='<video class="admin-preview" data-preview-media controls muted playsinline preload="metadata"></video>';
      wrap.querySelector('video[data-preview-media]').src=b.mediaUrl;
    }else{
      if(!wrap.querySelector('img[data-preview-media]')) wrap.innerHTML='<img class="admin-preview" data-preview-media alt="">';
      const img=wrap.querySelector('img[data-preview-media]');img.src=b.mediaUrl;img.alt=b.alt||b.title||'Campaign preview';
    }
  }
  function updateVisibility(card,b) {
    const map={product:'.campaign-destination-product',category:'.campaign-destination-category',url:'.campaign-destination-url'};
    Object.entries(map).forEach(([type,selector])=>{const field=card.querySelector(selector);if(field)field.hidden=b.destinationType!==type;});
  }
  function move(i,delta){const j=i+delta;if(j<0||j>=draft.length)return;[draft[i],draft[j]]=[draft[j],draft[i]];dirty=true;render();statusText('Banner order updated. Save to publish.');}
  function compressImage(file) {
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onerror=()=>reject(new Error('Could not read that image.'));
      reader.onload=()=>{
        const img=new Image();img.onerror=()=>reject(new Error('Could not process this image. Try JPG or PNG.'));
        img.onload=()=>{
          let scale=Math.min(1,1200/Math.max(img.width,img.height)),quality=.72,data='';
          for(let n=0;n<5;n++){
            const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
            const ctx=canvas.getContext('2d');if(!ctx)return reject(new Error('Image compression is unavailable.'));
            ctx.drawImage(img,0,0,canvas.width,canvas.height);data=canvas.toDataURL('image/jpeg',quality);
            if(data.length<=560000)return resolve(data);
            if(quality>.48)quality=Math.max(.42,quality-.12);else scale*=.82;
          }
          if(data.length>700000)return reject(new Error('Image is still too large. Use a smaller image or Media URL converter.'));
          resolve(data);
        };img.src=String(reader.result||'');
      };reader.readAsDataURL(file);
    });
  }
  function validate() {
    const rows=draft.map((b,i)=>normalise(b,i)), active=rows.filter(b=>b.active);
    if(active.some(b=>!b.mediaUrl.trim()))throw new Error('Every published banner needs an image/video URL or upload. Unpublish incomplete frames.');
    for(const b of active){
      if(b.destinationType==='product'&&!b.productId)throw new Error('Choose the linked product for every product banner.');
      if(b.destinationType==='category'&&!b.category)throw new Error('Choose a category for every category banner.');
      if(b.destinationType==='url'&&!b.destinationUrl.trim())throw new Error('Enter a destination URL for the custom-link banner.');
      if(b.destinationType==='url'&&/^(?:javascript|data|vbscript):/i.test(b.destinationUrl.trim()))throw new Error('Custom destination must be a safe page URL.');
    }
    return rows;
  }
  addButton.addEventListener('click',()=>{
    draft.push(normalise({id:'campaign-'+Date.now(),active:true,mediaType:'image',duration:10,ctaText:'Shop now',destinationType:'shop'},draft.length));
    dirty=true;render();list.lastElementChild?.scrollIntoView({behavior:'smooth',block:'center'});statusText('New frame added. Add media and details, then save.');
  });
  saveButton.addEventListener('click',async()=>{
    let rows;try{rows=validate();}catch(err){statusText(err.message||'Check banner fields.',true);return;}
    if(typeof window.jijaSaveFirebaseSettings!=='function'){statusText('Firebase admin connection is not ready. Wait for “Connected to Firebase”.',true);return;}
    const s=settingsNow(),first=rows.find(b=>b.active);
    const data={...s,homeBanners:rows,bannerSrc:first?.mediaUrl||'',bannerType:first?.mediaType||'image',bannerAlt:first?.alt||''};
    saveButton.disabled=true;statusText('Saving banner carousel to Firebase…');
    try{
      localStorage.setItem(SETTINGS_KEY,JSON.stringify(data));await window.jijaSaveFirebaseSettings(data);
      draft=rows.map((b,i)=>normalise(b,i));dirty=false;render();
      statusText(rows.some(b=>b.active)?'Saved. Published banners will rotate and link to the selected products or collections.':'Saved with no active banners; fallback hero content will be used.');
    }catch(err){statusText('Save failed: '+(err.message||'Firebase write error')+'. Check the connection or media size.',true);}
    finally{saveButton.disabled=false;}
  });
  function reloadDraft(){if(dirty)return;draft=initialDraft();render();}
  draft=initialDraft();render();
  window.addEventListener('jija:admin-firebase-ready',event=>{
    const remote=event.detail&&Array.isArray(event.detail.products)?event.detail.products:null;
    if(remote)products=remote.filter(p=>p&&!p._deleted&&p.published!==false&&p.name&&p.id);
    reloadDraft();
    if(!dirty)render();
  });
  $('save-home')?.addEventListener('click',()=>window.setTimeout(()=>{if(!dirty){products=readProducts();reloadDraft();}},150));
})();