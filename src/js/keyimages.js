/* Key images explorer core: folder walking, header.txt parsing and sample typing. No DOM (testable in Node).
   Folders are read through a small virtual FS so the browser (File System Access handles or a
   webkitdirectory FileList) and Node (fs) share the same code:
     dir node  {name, kind:'dir',  list():Promise<node[]>}
     file node {name, kind:'file', file():Promise<File-like {size,lastModified,text()}>}
   Times are wall-clock ms encoded as UTC, like core.js. */
const KI_SAMPLE=/^(\d{4})-(\d{2})-(\d{2})_(\d{2})\.(\d{2})\.(\d{2})\.(\d{3})$/;
const KI_MONTH=/^(\d{4})-(\d{2})$/, KI_DAY=/^\d{2}$/;
const KI_TYPES={inbag:{key:'ib',label:'In-Bag'},minidump:{key:'md',label:'Mini-Dump'},fryerexit:{key:'fe',label:'Fryer Exit'}};
const DAY_MS=86400000;

function kiSampleTime(n){const m=KI_SAMPLE.exec(n);return m?Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6],+m[7]):null;}
function kiDaySpan(day){const [y,m,d]=day.split('-').map(Number);const a=Date.UTC(y,m-1,d);return [a,a+DAY_MS];}
function kiInRange(t,r){return (!r||r.from==null||t>=r.from)&&(!r||r.to==null||t<=r.to);}
function kiOverlaps(span,r){return (!r||r.from==null||span[1]>r.from)&&(!r||r.to==null||span[0]<=r.to);}

/* header.txt is INI-like: [Section] then Key=Value; ';' starts a comment. Section and key lookup ignore case. */
function kiParseHeader(text){const sec={};let cur='';
  for(const raw of String(text).split(/\r?\n/)){const line=raw.replace(/(^|\s);.*$/,'').trim();if(!line)continue;
    const m=/^\[(.+)\]$/.exec(line);if(m){cur=m[1].trim();sec[cur]=sec[cur]||{};continue;}
    const i=line.indexOf('=');if(i<0)continue;(sec[cur]=sec[cur]||{})[line.slice(0,i).trim()]=line.slice(i+1).trim();}
  return sec;}
function kiGet(h,section,key){if(!h)return '';const s=Object.keys(h).find(k=>k.toLowerCase()===section.toLowerCase());if(s==null)return '';
  const k=Object.keys(h[s]).find(k=>k.toLowerCase()===key.toLowerCase());return k==null?'':h[s][k];}
const kiNorm=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');

function kiLogFromFiles(names){const n=names.map(x=>x.toLowerCase());
  if(n.includes('framegrab.bmp'))return 'Continuous';if(n.includes('framegrab0.png')||n.includes('framegrab1.png'))return 'Main';return '';}

/* Sample type from header.txt [Acquisition ID]:
   Continuous Logs: RecycleContent decides (In-Bag or Mini-Dump). Per the runbook, a Mini-Dump sample must have
   both RecycleContent and FryerContent = Mini-Dump; RecycleContent=In-Bag with FryerContent=Mini-Dump is a Key mis-tag
   and RIA computes no Mini-Dump result for it.
   Main Logs: FryerContent decides (Fryer Exit, or Mini-Dump, which RIA logs to the Mini-Dump results instead).
   Other values (Normalization, Calibration, ...) are shown as they are. */
function kiClassify(h,log){
  const rc=kiGet(h,'Acquisition ID','RecycleContent'),fc=kiGet(h,'Acquisition ID','FryerContent');
  const R=kiNorm(rc),F=kiNorm(fc),warn=[];
  if(!rc&&!fc)return {key:'unk',label:'Unknown',rc,fc,by:'',warn:['header.txt has no RecycleContent or FryerContent']};
  let by;
  if(log==='Continuous')by='RecycleContent';else if(log==='Main')by='FryerContent';
  else by=(R==='inbag'||R==='minidump')?'RecycleContent':'FryerContent';
  const v=by==='RecycleContent'?R:F,raw=by==='RecycleContent'?rc:fc;
  const t=KI_TYPES[v]||{key:'other',label:raw||'(empty)'};
  if(log!=='Main'&&R==='minidump'&&F!=='minidump')warn.push(`RecycleContent is Mini-Dump but FryerContent is "${fc}"; a Mini-Dump sample should have both set to Mini-Dump.`);
  if(log!=='Main'&&R==='inbag'&&F==='minidump')warn.push('FryerContent is Mini-Dump but RecycleContent is In-Bag: RIA treats this as In-Bag and writes no Mini-Dump result (Key header mis-tag, see runbook "Mini-Dump Results Not Being Generated").');
  return {key:t.key,label:t.label,rc,fc,by,warn};}

/* Find the sample folders inside the range, opening only the month and day folders that overlap it.
   root may be RIA Data (Main Logs\key images and/or Continuous Logs\key images are searched, per opt.logs),
   a Main Logs / Continuous Logs folder, a key images folder, or a single month, day or sample folder.
   Only folder names are read here; nothing inside a sample folder is opened. Returns {jobs:[{node,log,g}],notes,searched}. */
const KI_LOGDIR={Main:'Main Logs',Continuous:'Continuous Logs'};
async function kiDirs(n){return (await n.list()).filter(k=>k.kind==='dir');}
async function kiChild(n,name){name=name.toLowerCase();return (await kiDirs(n)).find(k=>k.name.toLowerCase()===name)||null;}
function kiMonths(r){const out=[];const a=new Date(r.from),b=new Date(r.to);
  for(let y=a.getUTCFullYear(),m=a.getUTCMonth();y<b.getUTCFullYear()||(y===b.getUTCFullYear()&&m<=b.getUTCMonth());m===11?(y++,m=0):m++)
    out.push(y+'-'+String(m+1).padStart(2,'0'));
  return out;}
async function kiFind(root,range,opt={}){
  if(!range||range.from==null||range.to==null)throw new Error('a From and To time are both needed');
  const logs=opt.logs||['Main','Continuous'],notes=[],keys=[],jobs=[],stop=()=>opt.cancelled&&opt.cancelled();
  const n=root.name,l=n.toLowerCase();
  if(KI_SAMPLE.test(n)){if(kiInRange(kiSampleTime(n),range))jobs.push({node:root,log:'',g:0});return {jobs,notes,searched:[n]};}
  if(l==='key images')keys.push({log:'',dir:root,kind:'key'});
  else if(KI_MONTH.test(n))keys.push({log:'',dir:root,kind:'month'});
  else if(KI_DAY.test(n))keys.push({log:'',dir:root,kind:'day'});
  else if(l==='main logs'||l==='continuous logs'){const lg=l==='main logs'?'Main':'Continuous',k=await kiChild(root,'key images');
    if(k)keys.push({log:lg,dir:k,kind:'key'});else notes.push('No "key images" folder in '+n);}
  else for(const lg of logs){const d=await kiChild(root,KI_LOGDIR[lg]),k=d&&await kiChild(d,'key images');
    if(k)keys.push({log:lg,dir:k,kind:'key'});else notes.push(KI_LOGDIR[lg]+'\key images not found in '+n);}
  const months=kiMonths(range);let folders=0;
  const take=(k,log,g)=>{const t=kiSampleTime(k.name);if(t!=null&&kiInRange(t,range))jobs.push({node:k,log,g});};
  for(const [g,key] of keys.entries()){
    if(key.kind==='day'){(await kiDirs(key.dir)).forEach(k=>take(k,key.log,g));continue;}
    const mdirs=key.kind==='month'?[key.dir]:(await kiDirs(key.dir)).filter(k=>months.includes(k.name));
    for(const m of mdirs){if(stop())return {cancelled:true,jobs:[],notes};
      for(const k of await kiDirs(m)){
        if(KI_SAMPLE.test(k.name))take(k,key.log,g);
        else if(KI_DAY.test(k.name)&&KI_MONTH.test(m.name)&&kiOverlaps(kiDaySpan(m.name+'-'+k.name),range)){
          if(stop())return {cancelled:true,jobs:[],notes};
          (await kiDirs(k)).forEach(x=>take(x,key.log,g));folders++;
          if(opt.onProgress)opt.onProgress(folders,jobs.length);}}}}
  return {jobs,notes,searched:keys.map(k=>k.log?KI_LOGDIR[k.log]:k.dir.name)};}

async function kiPool(jobs,n,fn){let i=0;const run=async()=>{while(i<jobs.length){const j=i++;await fn(jobs[j],j);}};
  await Promise.all(Array.from({length:Math.min(n,jobs.length)},run));}

async function kiReadSample(node,log){
  const files=(await node.list()).filter(f=>f.kind==='file');const names=files.map(f=>f.name);
  const has=n=>names.some(x=>x.toLowerCase()===n);
  const s={name:node.name,t:kiSampleTime(node.name),day:node.name.slice(0,10),log:log||kiLogFromFiles(names)||'Key images',
    files,hasReady:has('ready.txt'),hasReady1:has('ready1.txt'),hasBcrt:has('bcrt.settings'),raw:'',hdr:null,err:''};
  s.id=s.log+'/'+s.name;
  const hf=files.find(f=>f.name.toLowerCase()==='header.txt');
  if(hf){try{s.raw=await (await hf.file()).text();s.hdr=kiParseHeader(s.raw);}catch(e){s.err='header.txt could not be read: '+e.message;}}
  else s.err='No header.txt in this folder';
  s.cls=kiClassify(s.hdr,s.log);if(s.err)s.cls.warn.unshift(s.err);
  return s;}

/* Read the file list and header.txt of each sample folder found by kiFind. Returns samples sorted by time, or null if cancelled. */
async function kiLoad(jobs,opt={}){
  const out=new Array(jobs.length);let done=0;
  await kiPool(jobs,opt.concurrency||12,async(j,i)=>{if(opt.cancelled&&opt.cancelled())return;
    const s=await kiReadSample(j.node,j.log);s.g=j.g;out[i]=s;done++;
    if(opt.onProgress&&(done%25===0||done===jobs.length))opt.onProgress(done,jobs.length);});
  if(opt.cancelled&&opt.cancelled())return null;
  // a folder with no images (e.g. empty) takes the log type of the other samples from the same folder tree
  const best={};
  for(const s of out)if(s.log==='Main'||s.log==='Continuous'){const c=best[s.g]=best[s.g]||{};c[s.log]=(c[s.log]||0)+1;}
  for(const s of out)if(s.log!=='Main'&&s.log!=='Continuous'&&best[s.g]){const c=best[s.g];s.log=Object.keys(c).sort((a,b)=>c[b]-c[a])[0];s.id=s.log+'/'+s.name;s.cls=kiClassify(s.hdr,s.log);if(s.err)s.cls.warn.unshift(s.err);}
  return out.sort((a,b)=>a.t-b.t);}

if(typeof module!=='undefined')module.exports={kiSampleTime,kiParseHeader,kiGet,kiClassify,kiFind,kiLoad,kiMonths,kiDaySpan,kiInRange,kiOverlaps,kiLogFromFiles};
