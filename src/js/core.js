function parseCSV(text){
  const rows=[];let row=[],f='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
    else if(c==='"')q=true;else if(c===','){row.push(f);f='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(f);f='';if(row.length>1||row[0]!=='')rows.push(row);row=[];}
    else f+=c;}
  if(f!==''||row.length){row.push(f);rows.push(row);}
  const h=rows.shift()||[];return {header:h,rows:rows.map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]===undefined?'':r[i]])))};
}
function tms(s){if(!s)return null;const m=/^(\d{4})-(\d{2})-(\d{2})[ T_](\d{2})[:.](\d{2})[:.](\d{2})(?:\.(\d{1,3}))?/.exec(s.trim());
  if(!m)return null;return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6],+((m[7]||'0').padEnd(3,'0')));}
function median(a){if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),k=s.length>>1;return s.length%2?s[k]:(s[k-1]+s[k])/2;}
function analyze(records,opt){
  const thr=opt.waitThr, bgap=opt.burstGap*1000;
  const seen=new Set();const S=[];
  for(const r of records){if(seen.has(r.Folder))continue;seen.add(r.Folder);
    const cap=tms(r.NameTime_1)||tms(r.Folder), pick=tms(r.FirstCopiedOnRIA), fm=tms(r.FolderModified_2);
    if(cap==null||pick==null)continue;
    const complete=!!(r.Ready1_W&&r.BcrtSettings_W);
    const s={approx:!!r._approx,folder:r.Folder,cap,pick,fm,complete,files:+r.FileCount||null,pickS:(pick-cap)/1000,moveS:fm!=null?(fm-pick)/1000:null,fl:null};
    if(r._files){const F=r._files.map(x=>({n:x.n,c:tms(x.c),w:tms(x.w)}));const g=n=>F.find(x=>x.n===n);
      const r1=g('ready1.txt'),rd=g('ready.txt'),bc=g('bcrt.settings'),hd=g('header.txt'),fg=F.find(x=>x.n.startsWith('framegrab'));
      s.fl={r1,rd,bc,hd,fg,rdByRIA:rd&&rd.c!=null&&rd.w!=null?Math.abs(rd.c-rd.w)<=2:null,
        rdLast:rd&&rd.c!=null?F.every(x=>x===rd||(x.c!=null&&x.c<=rd.c+2)):null};}
    S.push(s);}
  S.sort((a,b)=>a.cap-b.cap);
  const B=[];let cur=null;
  for(const s of S){if(!cur||s.cap-cur.last>bgap){cur={id:B.length,samples:[],last:s.cap};B.push(cur);}cur.samples.push(s);cur.last=s.cap;s.burst=cur.id;}
  for(const b of B){const sm=b.samples;
    sm.forEach((s,i)=>{s.idx=i+1;s.gap=i?(s.pick-sm[i-1].pick)/1000:null;s.wait=s.gap!=null&&s.gap>=thr;});
    let run=0,maxRun=0;for(const s of sm){run=s.complete?0:run+1;maxRun=Math.max(maxRun,run);}
    const gaps=sm.filter(s=>s.gap!=null);
    const lastPick=Math.max(...sm.map(s=>s.pick));
    Object.assign(b,{start:sm[0].cap,n:sm.length,inc:sm.filter(s=>!s.complete).length,maxRun,
      pre:sm[0].pickS,move:gaps.filter(s=>!s.wait).reduce((a,s)=>a+s.gap,0),
      wait:gaps.filter(s=>s.wait).reduce((a,s)=>a+s.gap,0),
      waits:gaps.filter(s=>s.wait).length,waitsInc:gaps.filter(s=>s.wait&&!s.complete).length,
      lastPick,span:(lastPick-sm[0].cap)/1000,maxPickS:Math.max(...sm.map(s=>s.pickS)),
      moveMed:median(gaps.filter(s=>!s.wait).map(s=>s.gap))});
    b.pctInc=100*b.inc/b.n;}
  B.forEach((b,i)=>{b.sincePrev=i?(b.start-B[i-1].start)/60000:null;
    b.offCadence=b.sincePrev!=null&&b.sincePrev<opt.cadenceMin;
    b.overlap=i<B.length-1&&B[i+1].start<b.lastPick;b.overCeil=b.n>opt.ceiling;});
  const gapsAll=S.filter(s=>s.gap!=null);
  const K={samples:S.length,bursts:B.length,inc:S.filter(s=>!s.complete).length,
    waits:gapsAll.filter(s=>s.wait).length,waitsInc:gapsAll.filter(s=>s.wait&&!s.complete).length,
    waitS:B.reduce((a,b)=>a+b.wait,0),moveS:B.reduce((a,b)=>a+b.move,0),preS:B.reduce((a,b)=>a+b.pre,0),
    readyMed:median(gapsAll.filter(s=>!s.wait&&s.complete).map(s=>s.gap)),
    worst:B.length?B.reduce((a,b)=>b.span>a.span?b:a):null,
    incWaitShare:null,compWaitShare:null};
  const gi=gapsAll.filter(s=>!s.complete),gc=gapsAll.filter(s=>s.complete);
  K.incWaitShare=gi.length?100*gi.filter(s=>s.wait).length/gi.length:null;
  K.compWaitShare=gc.length?100*gc.filter(s=>s.wait).length/gc.length:null;
  K.from=S.length?S[0].cap:null;K.to=S.length?S[S.length-1].cap:null;
  return {S,B,K};
}

function csvKind(h){if(h.includes('Kind')&&h.includes('Created')&&h.includes('Modified')&&h.includes('Name'))return 'raw';
  if(h.includes('CreatedOnRIA')&&h.includes('Written'))return 'files1';if(h.includes('FirstCopiedOnRIA'))return 'summary';return null;}
function fromFiles(rows,kind){const by=new Map();
  for(const r of rows){const k=r.Folder;if(!k)continue;let g=by.get(k);if(!g){g={files:[],fM:''};by.set(k,g);}
    if(kind==='raw'){if(r.Kind==='Folder'){g.fM=r.Modified;continue;}g.files.push({n:(r.Name||'').toLowerCase(),c:r.Created,w:r.Modified});}
    else g.files.push({n:(r.File||'').toLowerCase(),c:r.CreatedOnRIA,w:r.Written});}
  const out=[];
  for(const [k,g] of by){const f=g.files.filter(x=>tms(x.c)!=null);if(!f.length)continue;
    f.sort((a,b)=>tms(a.c)-tms(b.c));const has=n=>f.find(x=>x.n===n);
    out.push({Folder:k,NameTime_1:'',FirstCopiedOnRIA:f[0].c,FolderModified_2:f[f.length-1].c,
      Ready1_W:has('ready1.txt')?has('ready1.txt').w:'',BcrtSettings_W:has('bcrt.settings')?has('bcrt.settings').w:'',FileCount:String(f.length),_files:f});}
  return out;}
function msStr(ms){return new Date(ms).toISOString().replace('T',' ').slice(0,23);}
function localWall(ms){return ms-new Date(ms).getTimezoneOffset()*60000;}
/* Folder-browse mode: entries [{folder,name,lm}] with lm = local wall-clock ms (as UTC).
   The browser exposes only the Modified time, so RIA pickup is taken as the time RIA wrote
   its own ready.txt (end of the copy, Created = Modified on RIA). */
function fromFolder(entries){const by=new Map();
  for(const e of entries){let g=by.get(e.folder);if(!g){g=[];by.set(e.folder,g);}g.push({n:e.name.toLowerCase(),c:null,w:msStr(e.lm)});}
  const out=[];let skipped=0;
  for(const [k,f] of by){if(tms(k)==null)continue;const rd=f.find(x=>x.n==='ready.txt');if(!rd){skipped++;continue;}
    const has=n=>f.find(x=>x.n===n);
    out.push({Folder:k,NameTime_1:'',FirstCopiedOnRIA:rd.w,FolderModified_2:'',_approx:true,
      Ready1_W:has('ready1.txt')?has('ready1.txt').w:'',BcrtSettings_W:has('bcrt.settings')?has('bcrt.settings').w:'',FileCount:String(f.length),_files:f});}
  out.skipped=skipped;return out;}
if(typeof module!=='undefined')module.exports={parseCSV,analyze,tms,fromFiles,csvKind,fromFolder,localWall,msStr};
