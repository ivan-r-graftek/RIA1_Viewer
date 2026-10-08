/* Files explorer tab: key images tree + sample viewer. Uses keyimages.js for walking, parsing and typing. */
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const iso=ms=>new Date(ms).toISOString();
const fmtTs=ms=>iso(ms).slice(0,10)+' '+iso(ms).slice(11,23);
const fmtKB=b=>b==null?'':b>=1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
const TYPE_ORDER=['ib','md','fe','other','unk'],ABBR={ib:'IB',md:'MD',fe:'FE',other:'?',unk:'—'};
const LOG_LABEL={Continuous:'Continuous Logs',Main:'Main Logs','Key images':'Key images'};
const IMAGES={Continuous:['frameGrab.bmp'],Main:['frameGrab0.png','frameGrab1.png','segmented0.png','segmented1.png']};
const CAPTION={'framegrab.bmp':'Continuous frame (left and right)','framegrab0.png':'frameGrab0 · left side','framegrab1.png':'frameGrab1 · right side',
  'segmented0.png':'segmented0 · left classes','segmented1.png':'segmented1 · right classes'};

const S={handle:null,files:null,range:null,loaded:null,launch:Date.now()-new Date().getTimezoneOffset()*60000,all:[],shown:[],byId:new Map(),open:new Set(),sel:null,typeOff:new Set(),busy:false,cancel:false,urls:[],imgs:[],tok:0,sub:{timing:'',files:''}};

/* ---- tabs ---- */
function setTab(t){
  const cur=document.body.dataset.tab||'timing';if(cur!==t){S.sub[cur]=$('sub').textContent;}
  document.body.dataset.tab=t;
  document.querySelectorAll('.tabs [role=tab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===t));
  $('tab-timing').hidden=t!=='timing';$('tab-files').hidden=t!=='files';
  $('sub').textContent=S.sub[t]||'';$('sub').title=$('sub').textContent;}
document.querySelectorAll('.tabs [role=tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
document.querySelectorAll('.subtabs [role=tab]').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.subtabs [role=tab]').forEach(x=>x.setAttribute('aria-selected',x===b));
  $('fx-key').hidden=b.dataset.sub!=='key';$('fx-cal').hidden=b.dataset.sub!=='cal';$('fx-res').hidden=b.dataset.sub!=='res';});
function setSub(t){S.sub.files=t;if(document.body.dataset.tab==='files'){$('sub').textContent=t;$('sub').title=t;}}

/* ---- virtual FS over a directory handle or a webkitdirectory FileList ---- */
function vfsHandle(h){if(h.kind==='directory')return {name:h.name,kind:'dir',list:async()=>{const o=[];for await(const c of h.values())o.push(vfsHandle(c));return o;}};
  return {name:h.name,kind:'file',file:()=>h.getFile()};}
function vfsFileList(files){const top={kids:new Map()};
  for(const f of files){const p=(f.webkitRelativePath||f.name).split('/');let n=top;
    for(let i=0;i<p.length-1;i++){let k=n.kids.get(p[i]);if(!k){k={name:p[i],kind:'dir',kids:new Map()};k.list=async()=>[...k.kids.values()];n.kids.set(p[i],k);}n=k;}
    n.kids.set(p[p.length-1],{name:p[p.length-1],kind:'file',file:async()=>f});}
  return top.kids.values().next().value||null;}

/* ---- remembered folder (IndexedDB keeps the directory handle between launches; the browser still asks to allow access) ---- */
const IDB={db:null,open(){return this.db||(this.db=new Promise((res,rej)=>{const r=indexedDB.open('ria-viewer',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}));},
  async get(k){try{const db=await this.open();return await new Promise(res=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null);});}catch(e){return null;}},
  async set(k,v){try{const db=await this.open();await new Promise(res=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(v,k);tx.oncomplete=tx.onerror=()=>res();});}catch(e){}}};
const DEFAULT_ROOT='E:\\RIA Data';
function showRoot(){const n=S.handle?S.handle.name:S.files?S.files.name:null;
  $('fxRoot').textContent=n?(n.toLowerCase()==='ria data'?DEFAULT_ROOT:n):DEFAULT_ROOT;
  $('fxRoot').title=n?'Folder chosen: '+n:'Default folder. The first Load files asks you to pick it once (browsers do not let a page open a path by name); it is remembered after that.';
  $('fxRoot').classList.toggle('unset',!n);}
if(window.showDirectoryPicker)IDB.get('root').then(h=>{if(h&&!S.handle&&!S.files){S.handle=h;showRoot();changed();}});
async function pickFolder(){
  if(!window.showDirectoryPicker){$('fxDir').click();return null;}
  try{const h=await window.showDirectoryPicker({id:'riadata',mode:'read',startIn:S.handle||undefined});S.handle=h;S.files=null;IDB.set('root',h);showRoot();return h;}
  catch(e){if(e.name!=='AbortError')prog('Folder picker failed: '+e.message);return null;}}
async function rootNode(){
  if(S.files)return S.files;
  if(!S.handle&&!(await pickFolder()))return null;
  try{let p=await S.handle.queryPermission({mode:'read'});if(p!=='granted')p=await S.handle.requestPermission({mode:'read'});
    if(p!=='granted'){prog('Access to '+S.handle.name+' was not allowed. Click Load files again and allow it, or use Change… to pick the folder.');return null;}}
  catch(e){if(!(await pickFolder()))return null;}
  return vfsHandle(S.handle);}

/* ---- range: From/To, preset to launch time back 1 day ---- */
const toInput=ms=>ms==null?'':iso(ms).slice(0,19);
function fromInput(v){const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(v||'');return m?Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0)):null;}
const logOk=l=>{const w=$('fxLog').value;return !w||!l||l===w;};
const PRESET={h1:3600e3,h8:8*3600e3,d1:86400e3,d7:7*86400e3};
function preset(p){const end=Math.floor(S.launch/1000)*1000;
  if(p==='today'){$('fxFrom').value=toInput(Math.floor(end/86400e3)*86400e3);$('fxTo').value=toInput(end);}
  else if(PRESET[p]){$('fxFrom').value=toInput(end-PRESET[p]);$('fxTo').value=toInput(end);}
  changed();}
function readRange(){const r={from:fromInput($('fxFrom').value),to:fromInput($('fxTo').value)};
  if(r.from!=null&&r.to!=null&&r.from>r.to)[r.from,r.to]=[r.to,r.from];return r;}
function changed(){const r=readRange(),days=r.from!=null&&r.to!=null?(r.to-r.from)/86400e3:null;
  $('fxSpan').textContent=days==null?'set both From and To':days<=1?Math.round(days*240)/10+' h':Math.round(days*10)/10+' days';
  $('fxSpan').classList.toggle('bad',days==null||days>31);
  const L=S.loaded,need=!L||r.from!==L.from||r.to!==L.to||$('fxLog').value!==L.log||S.handle!==L.handle||S.files!==L.files;
  $('fxLoad').classList.toggle('stale',!!L&&need);$('fxLoad').textContent=L&&need?'Load files (selection changed)':'Load files';}

/* ---- load: find the sample folders in range, then read their headers. Each load replaces the previous one. ---- */
const CONFIRM_ABOVE=3000;
$('fxOpen').onclick=async()=>{if(!S.busy){await pickFolder();changed();}};
$('fxDir').onchange=e=>{const fl=[...e.target.files];e.target.value='';if(fl.length){S.files=vfsFileList(fl);S.handle=null;showRoot();changed();}};
$('fxLoad').onclick=()=>load();
$('fxPreset').onchange=e=>{if(e.target.value){preset(e.target.value);e.target.value='';}};
[$('fxFrom'),$('fxTo')].forEach(i=>{i.onchange=changed;i.onkeydown=e=>{if(e.key==='Enter'){changed();load();}};});
$('fxLog').onchange=()=>{changed();if(S.loaded){S.open.clear();build();}};
$('fxCancel').onclick=()=>{S.cancel=true;};
function prog(t){$('fxProg').textContent=t;}
function busy(b){S.busy=b;['fxLog','fxOpen','fxLoad','fxPreset','fxFrom','fxTo'].forEach(id=>$(id).disabled=b);$('fxCancel').hidden=!b;}

async function load(){if(S.busy)return;
  const r=readRange();if(r.from==null||r.to==null){prog('Set both From and To before loading.');$('fxFrom').focus();return;}
  const root=await rootNode();if(!root)return;
  busy(true);S.cancel=false;prog('Looking for sample folders in the selected '+$('fxSpan').textContent+'…');$('fxAvail').textContent='';
  const logs=$('fxLog').value?[$('fxLog').value]:['Main','Continuous'];
  let f,items;
  try{f=await kiFind(root,r,{logs,cancelled:()=>S.cancel,onProgress:(d,n)=>prog('Looking for sample folders… '+d+' day folders, '+n+' samples')});
    if(f.cancelled){busy(false);prog('Cancelled; the previous data is still shown.');return;}
    if(f.jobs.length>CONFIRM_ABOVE&&!confirm(f.jobs.length+' sample folders are in this range. Reading all their headers can take a while and use a lot of memory.\n\nLoad them anyway? Cancel to pick a shorter range.')){busy(false);prog('Not loaded: '+f.jobs.length+' sample folders in range. Pick a shorter range.');return;}
    prog('Reading headers 0 / '+f.jobs.length+'…');
    items=await kiLoad(f.jobs,{cancelled:()=>S.cancel,onProgress:(d,n)=>prog('Reading headers '+d+' / '+n+'…')});}
  catch(e){busy(false);prog('Loading failed: '+e.message);return;}
  busy(false);
  if(!items){prog('Cancelled; the previous data is still shown.');return;}
  // replace what was loaded before, and free its images
  clearView();S.sel=null;S.open.clear();S.range=r;S.all=items;S.byId=new Map(items.map(s=>[s.id,s]));
  S.loaded={from:r.from,to:r.to,log:$('fxLog').value,handle:S.handle,files:S.files};
  prog('');changed();
  const per={};items.forEach(s=>per[s.log]=(per[s.log]||0)+1);
  $('fxAvail').textContent='Loaded '+items.length+' sample folders'+(items.length?' ('+Object.keys(per).map(l=>(LOG_LABEL[l]||l)+' '+per[l]).join(', ')+')':'')+' from '+(f.searched.join(', ')||'nothing')+'.'+(f.notes.length?' '+f.notes.join('; ')+'.':'');
  build();}
preset('d1');showRoot();$('fxTree').innerHTML='<p class="files fxnone">Nothing loaded yet. Set the range and click Load files.</p>';

/* ---- tree ---- */
function filtered(){return S.all.filter(s=>kiInRange(s.t,S.range)&&logOk(s.log)).sort((a,b)=>a.log<b.log?-1:a.log>b.log?1:a.t-b.t);}
function counts(list){const c={};for(const s of list)c[s.cls.key]=(c[s.cls.key]||0)+1;return c;}
function mini(c){return TYPE_ORDER.filter(k=>c[k]).map(k=>`<span class="tb ${k}" title="${c[k]} ${k==='ib'?'In-Bag':k==='md'?'Mini-Dump':k==='fe'?'Fryer Exit':k==='unk'?'unknown':'other'}">${ABBR[k]} ${c[k]}</span>`).join('');}
function build(){
  const inRange=filtered();const c=counts(inRange);
  const labels={ib:'In-Bag',md:'Mini-Dump',fe:'Fryer Exit',other:'Other',unk:'No header'};
  $('fxChips').innerHTML=TYPE_ORDER.filter(k=>c[k]).map(k=>`<button class="chip ${k}${S.typeOff.has(k)?' off':''}" data-k="${k}" aria-pressed="${!S.typeOff.has(k)}" title="Show or hide ${labels[k]} samples"><span class="tb ${k}">${ABBR[k]}</span>${labels[k]} <b>${c[k]}</b></button>`).join('')
    +(inRange.some(s=>s.cls.warn.length)?`<button class="chip warn${S.typeOff.has('okonly')?' on':''}" data-k="okonly" aria-pressed="${S.typeOff.has('okonly')}" title="Show only samples with a warning">⚠ Warnings only <b>${inRange.filter(s=>s.cls.warn.length).length}</b></button>`:'');
  $('fxChips').querySelectorAll('.chip').forEach(b=>b.onclick=()=>{const k=b.dataset.k;S.typeOff.has(k)?S.typeOff.delete(k):S.typeOff.add(k);build();});
  S.shown=inRange.filter(s=>!S.typeOff.has(s.cls.key)&&(!S.typeOff.has('okonly')||s.cls.warn.length));
  const r=S.range||{};
  setSub(S.shown.length+' of '+S.all.length+' indexed samples'+(r.from!=null||r.to!=null?' · '+(r.from!=null?fmtTs(r.from).slice(0,16):'start')+' to '+(r.to!=null?fmtTs(r.to).slice(0,16):'end'):''));
  if(!S.shown.length){$('fxTree').innerHTML='<p class="files fxnone">'+(S.loaded?'No samples in the loaded range'+(S.all.length?' for this log and filter':'')+'.':'Nothing loaded yet. Set the range and click Load files.')+'</p>';return;}
  // default expansion: every log, its latest day and that day's first hour
  if(!S.open.size){const logs=new Set(S.shown.map(s=>s.log));logs.forEach(l=>{S.open.add('L|'+l);const ds=S.shown.filter(s=>s.log===l);const day=ds[ds.length-1].day,first=ds.find(s=>s.day===day);S.open.add('D|'+l+'|'+day);S.open.add('H|'+l+'|'+day+'|'+first.name.slice(11,13));});}
  renderTree();}
function group(list,keyf){const m=new Map();for(const s of list){const k=keyf(s);let g=m.get(k);if(!g){g=[];m.set(k,g);}g.push(s);}return m;}
function renderTree(){const h=[];
  for(const [log,ls] of group(S.shown,s=>s.log)){const lk='L|'+log,lo=S.open.has(lk);
    h.push(`<div class="tn l0" role="treeitem" aria-expanded="${lo}" data-k="${esc(lk)}"><span class="tt">${lo?'▾':'▸'}</span><span class="tl">${esc(LOG_LABEL[log]||log)}</span><span class="tc">${ls.length}</span>${mini(counts(ls))}</div>`);
    if(!lo)continue;
    for(const [day,ds] of group(ls,s=>s.day)){const dk='D|'+log+'|'+day,dop=S.open.has(dk);
      h.push(`<div class="tn l1" role="treeitem" aria-expanded="${dop}" data-k="${esc(dk)}"><span class="tt">${dop?'▾':'▸'}</span><span class="tl">${day}</span><span class="tc">${ds.length}</span>${mini(counts(ds))}</div>`);
      if(!dop)continue;
      for(const [hr,hs] of group(ds,s=>s.name.slice(11,13))){const hk='H|'+log+'|'+day+'|'+hr,ho=S.open.has(hk);
        h.push(`<div class="tn l2" role="treeitem" aria-expanded="${ho}" data-k="${esc(hk)}"><span class="tt">${ho?'▾':'▸'}</span><span class="tl">${hr}:00–${hr}:59</span><span class="tc">${hs.length}</span>${mini(counts(hs))}</div>`);
        if(!ho)continue;
        for(const s of hs){const so=S.open.has('S|'+s.id),sel=S.sel===s.id,w=s.cls.warn.length;
          h.push(`<div class="tn l3 smp${sel?' sel':''}" role="treeitem" aria-selected="${sel}" aria-expanded="${so}" data-id="${esc(s.id)}" title="${esc(s.name)}${w?' · '+esc(s.cls.warn.join(' ')):''}"><span class="tt" data-x="1">${so?'▾':'▸'}</span><span class="tb ${s.cls.key}">${ABBR[s.cls.key]}</span><span class="tl mono">${s.name.slice(11).replace(/\./g,(m,i)=>i===8?'.':':')}</span>${w?'<span class="twarn" aria-label="warning">⚠</span>':''}${s.hasReady?'':'<span class="tnr" title="No ready.txt">no ready</span>'}</div>`);
          if(so)for(const f of [...s.files].sort((a,b)=>a.name.localeCompare(b.name)))
            h.push(`<div class="tn l4 fl" role="treeitem" data-id="${esc(s.id)}" data-f="${esc(f.name)}"><span class="tl mono">${esc(f.name)}</span></div>`);}}}}
  $('fxTree').innerHTML=h.join('');
  const se=$('fxTree').querySelector('.smp.sel');if(se)se.scrollIntoView({block:'nearest'});}
$('fxTree').onclick=e=>{const n=e.target.closest('.tn');if(!n)return;
  if(n.dataset.k){const k=n.dataset.k;S.open.has(k)?S.open.delete(k):S.open.add(k);renderTree();return;}
  const id=n.dataset.id;
  if(n.dataset.f){select(id,n.dataset.f);return;}
  if(e.target.dataset.x){const k='S|'+id;S.open.has(k)?S.open.delete(k):S.open.add(k);renderTree();return;}
  select(id);};
$('fxTree').onkeydown=e=>{if(!S.shown.length)return;
  const i=S.shown.findIndex(s=>s.id===S.sel);let j=null;
  if(e.key==='ArrowDown')j=i<0?0:Math.min(S.shown.length-1,i+1);else if(e.key==='ArrowUp')j=i<0?0:Math.max(0,i-1);
  else if(e.key==='Home')j=0;else if(e.key==='End')j=S.shown.length-1;
  else if((e.key==='ArrowRight'||e.key==='ArrowLeft')&&S.sel){const k='S|'+S.sel;e.key==='ArrowRight'?S.open.add(k):S.open.delete(k);renderTree();e.preventDefault();return;}
  if(j==null)return;e.preventDefault();select(S.shown[j].id);};
function step(d){const i=S.shown.findIndex(s=>s.id===S.sel);const j=i+d;if(j>=0&&j<S.shown.length)select(S.shown[j].id);}

/* ---- viewer ---- */
function clearView(){S.urls.forEach(u=>URL.revokeObjectURL(u));S.urls=[];S.imgs=[];}
function select(id,file){const s=S.byId.get(id);if(!s)return;S.sel=id;
  ['L|'+s.log,'D|'+s.log+'|'+s.day,'H|'+s.log+'|'+s.day+'|'+s.name.slice(11,13)].forEach(k=>S.open.add(k));
  renderTree();view(s,file);}
const fget=(s,n)=>s.files.find(f=>f.name.toLowerCase()===n.toLowerCase());
function row(k,v,cls){return v===''||v==null?'':`<dt>${esc(k)}</dt><dd${cls?' class="'+cls+'"':''}>${esc(v)}</dd>`;}
function idRow(h,sec,label){const id=kiGet(h,sec,'UniqueID'),dt=kiGet(h,sec,'DateTime');if(!id&&!dt)return '';
  return `<dt>${label}</dt><dd><span class="mono">${esc(dt)}</span>${id&&id!==dt?`<span class="fxid mono" title="UniqueID">${esc(id)}</span>`:''}</dd>`;}
async function view(s,file){const tok=++S.tok;clearView();
  const h=s.hdr,A='Acquisition ID',c=s.cls,i=S.shown.findIndex(x=>x.id===s.id);
  const flags=[['header.txt',!!fget(s,'header.txt')],['ready.txt',s.hasReady]];
  if(s.log==='Continuous')flags.push(['ready1.txt',s.hasReady1],['bcrt.settings',s.hasBcrt]);
  const wanted=IMAGES[s.log]||[...IMAGES.Main,...IMAGES.Continuous];
  const imgs=(s.log in IMAGES?wanted:wanted.filter(n=>fget(s,n)));
  $('fxView').innerHTML=`
  <div class="fxhead">
    <span class="tb big ${c.key}">${esc(c.label)}</span>
    <h2 class="mono">${esc(fmtTs(s.t))}</h2>
    <span class="files">${esc(LOG_LABEL[s.log]||s.log)} · key images · <span class="mono">${esc(s.name)}</span></span>
    <span class="sp"></span>
    <span class="files">${i+1} / ${S.shown.length}</span>
    <button id="fxPrev" ${i<=0?'disabled':''} title="Previous sample (↑)">‹ Prev</button><button id="fxNext" ${i>=S.shown.length-1?'disabled':''} title="Next sample (↓)">Next ›</button>
  </div>
  ${c.warn.map(w=>`<div class="note warnnote">⚠ ${esc(w)}</div>`).join('')}
  <div class="fxcols">
    <dl class="fxinfo">
      <dt>Sample type</dt><dd><b>${esc(c.label)}</b>${c.by?` <span class="files">from ${esc(c.by)} (${esc(LOG_LABEL[s.log]||s.log)})</span>`:''}</dd>
      ${row('RecycleContent',c.rc,c.by==='RecycleContent'?'key':'')}${row('FryerContent',c.fc,c.by==='FryerContent'?'key':'')}
      ${row('Acquired',kiGet(h,A,'DateTime'),'mono')}${row('BufferNumber',kiGet(h,A,'BufferNumber'))}${row('CameraID',kiGet(h,A,'CameraID'))}
      ${row('ImageFrames',kiGet(h,A,'ImageFrames'),'mono')}${row('Operator',kiGet(h,A,'Operator'))}
    </dl>
    <dl class="fxinfo">
      ${row('System ID',kiGet(h,'System ID','ID'))}${row('Keyware',kiGet(h,'System ID','KeywareVersion'))}${row('Settings',kiGet(h,'System ID','SettingsName'))}${row('Recycle lane',kiGet(h,'System ID','RecycleLocation'))}
      ${idRow(h,'Normalization ID','Normalization')}${idRow(h,'Color Table ID','Color table')}${idRow(h,'Targeting ID','Targeting')}
      <dt>Files</dt><dd>${flags.map(([n,ok])=>`<span class="badge ${ok?'ok':'bad'}" title="${ok?'present':'missing'}">${ok?'✓':'✗'} ${n}</span>`).join(' ')} <span class="files">${s.files.length} files</span></dd>
    </dl>
  </div>
  <div class="fximgs n${imgs.length}" id="fxImgs">${imgs.map((n,k)=>{const f=fget(s,n);return `<figure class="fxfig${f?'':' miss'}" data-i="${k}">
    <div class="fxim">${f?'<span class="files">loading…</span>':'<span class="files">not in this folder</span>'}</div>
    <figcaption><b class="mono">${esc(f?f.name:n)}</b> <span class="files">${esc(CAPTION[n.toLowerCase()]||'')}</span><span class="files fxdim"></span></figcaption></figure>`;}).join('')}</div>
  <details class="sec" id="fxRawD"><summary><span class="sp">header.txt</span></summary><div class="body"><pre class="fxpre">${esc(s.raw||'(none)')}</pre></div></details>
  <div id="fxFile"></div>`;
  $('fxPrev').onclick=()=>step(-1);$('fxNext').onclick=()=>step(1);
  S.imgs=imgs.map(n=>({n,f:fget(s,n),url:null,w:0,h:0,size:null}));
  $('fxImgs').querySelectorAll('.fxfig').forEach(fg=>fg.onclick=()=>{const k=+fg.dataset.i;if(S.imgs[k].url)lbOpen(k);});
  if(file){const lf=file.toLowerCase();if(lf==='header.txt')$('fxRawD').open=true;
    else if(!imgs.some(n=>n.toLowerCase()===lf))showText(s,file,tok);}
  await Promise.all(S.imgs.map(async(im,k)=>{if(!im.f)return;
    try{const blob=await im.f.file();if(tok!==S.tok)return;im.size=blob.size;im.url=URL.createObjectURL(blob);S.urls.push(im.url);
      const box=$('fxImgs').querySelector(`[data-i="${k}"]`);const img=new Image();img.alt=im.f.name;
      img.onload=()=>{im.w=img.naturalWidth;im.h=img.naturalHeight;box.querySelector('.fxdim').textContent=' · '+im.w+'×'+im.h+' · '+fmtKB(im.size);};
      img.onerror=()=>{box.querySelector('.fxim').innerHTML='<span class="files">this browser cannot display the file</span>';};
      img.src=im.url;const d=box.querySelector('.fxim');d.innerHTML='';d.appendChild(img);}
    catch(e){if(tok===S.tok)$('fxImgs').querySelector(`[data-i="${k}"] .fxim`).innerHTML='<span class="files">could not read: '+esc(e.message)+'</span>';}}));
  if(file&&tok===S.tok){const k=S.imgs.findIndex(im=>im.f&&im.f.name.toLowerCase()===file.toLowerCase());if(k>=0&&S.imgs[k].url)lbOpen(k);}}
async function showText(s,name,tok){const f=fget(s,name);if(!f)return;const b=await f.file();if(tok!==S.tok)return;
  const big=b.size>512*1024,t=big?'(file is '+fmtKB(b.size)+'; showing the first 512 KB)\n'+await b.slice(0,512*1024).text():await b.text();
  $('fxFile').innerHTML=`<details class="sec" open><summary><span class="sp mono">${esc(name)}</span><span class="files">${fmtKB(b.size)}</span></summary><div class="body"><pre class="fxpre">${esc(t)}</pre></div></details>`;
  $('fxFile').scrollIntoView({block:'nearest'});}

/* ---- lightbox: wheel zoom at cursor, drag to pan ---- */
const LB={k:0,z:1,x:0,y:0,drag:null};
function lbOpen(k){LB.k=k;$('lb').hidden=false;document.body.classList.add('lbon');lbShow();}
function lbClose(){$('lb').hidden=true;document.body.classList.remove('lbon');$('lbImg').removeAttribute('src');}
function lbAvail(d){let k=LB.k;do{k+=d;}while(k>=0&&k<S.imgs.length&&!S.imgs[k].url);return k>=0&&k<S.imgs.length?k:null;}
function lbShow(){const im=S.imgs[LB.k];$('lbTitle').textContent=im.f.name;
  $('lbInfo').textContent=(im.w?im.w+'×'+im.h+' · ':'')+fmtKB(im.size)+' · '+(CAPTION[im.n.toLowerCase()]||'');
  $('lbPrev').disabled=lbAvail(-1)==null;$('lbNext').disabled=lbAvail(1)==null;
  const img=$('lbImg');img.onload=()=>lbFit();img.src=im.url;if(img.complete&&img.naturalWidth)lbFit();}
function lbApply(){const img=$('lbImg');img.style.transform=`translate(${LB.x}px,${LB.y}px) scale(${LB.z})`;img.classList.toggle('px',LB.z>=2);}
function lbFit(){const st=$('lbStage').getBoundingClientRect(),img=$('lbImg');const w=img.naturalWidth||1,h=img.naturalHeight||1;
  LB.z=Math.min(st.width/w,st.height/h,1)||1;LB.x=(st.width-w*LB.z)/2;LB.y=(st.height-h*LB.z)/2;lbApply();}
function lbZoom(f,cx,cy){const z=Math.min(32,Math.max(0.05,LB.z*f));const r=z/LB.z;LB.x=cx-(cx-LB.x)*r;LB.y=cy-(cy-LB.y)*r;LB.z=z;lbApply();}
$('lbStage').addEventListener('wheel',e=>{e.preventDefault();const r=$('lbStage').getBoundingClientRect();lbZoom(e.deltaY<0?1.2:1/1.2,e.clientX-r.left,e.clientY-r.top);},{passive:false});
$('lbStage').onpointerdown=e=>{LB.drag={x:e.clientX-LB.x,y:e.clientY-LB.y};$('lbStage').setPointerCapture(e.pointerId);};
$('lbStage').onpointermove=e=>{if(!LB.drag)return;LB.x=e.clientX-LB.drag.x;LB.y=e.clientY-LB.drag.y;lbApply();};
$('lbStage').onpointerup=$('lbStage').onpointercancel=()=>{LB.drag=null;};
$('lbStage').ondblclick=e=>{const r=$('lbStage').getBoundingClientRect();if(LB.z<1)lbZoom(1/LB.z,e.clientX-r.left,e.clientY-r.top);else lbFit();};
$('lbFit').onclick=lbFit;$('lb1').onclick=()=>{const r=$('lbStage').getBoundingClientRect();lbZoom(1/LB.z,r.width/2,r.height/2);};
$('lbClose').onclick=lbClose;
$('lbPrev').onclick=()=>{const k=lbAvail(-1);if(k!=null){LB.k=k;lbShow();}};$('lbNext').onclick=()=>{const k=lbAvail(1);if(k!=null){LB.k=k;lbShow();}};
document.addEventListener('keydown',e=>{if($('lb').hidden)return;
  if(e.key==='Escape')lbClose();else if(e.key==='ArrowLeft')$('lbPrev').click();else if(e.key==='ArrowRight')$('lbNext').click();else return;e.preventDefault();});
window.addEventListener('resize',()=>{if(!$('lb').hidden)lbFit();});
})();
