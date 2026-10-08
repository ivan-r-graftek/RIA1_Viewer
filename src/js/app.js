const $=id=>document.getElementById(id);
let dShowAll=false;let DT=null;
const DATA={records:[],names:[]};let R=null;const CH={};let selBurst=null;
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const fmtT=ms=>{const d=new Date(ms);return d.toISOString().slice(11,19);};
const fmtDT=ms=>{const d=new Date(ms);return d.toISOString().slice(5,10)+' '+d.toISOString().slice(11,16);};
const fmtD=ms=>new Date(ms).toISOString().slice(0,10);
const r1=v=>v==null?'':(Math.round(v*10)/10);
const r2=v=>v==null?'':(Math.round(v*100)/100);
function opts(){return {waitThr:+$('thr').value||10,burstGap:60,cadenceMin:20,ceiling:+$('cam').value};}

function loadFiles(list){
  const err=[];let pending=list.length;if(!pending)return;
  for(const f of list){const rd=new FileReader();
    rd.onload=()=>{const p=parseCSV(rd.result);const k=csvKind(p.header);
      if(!k){err.push(f.name+': not a KeyImageFiles CSV (needs Folder, Kind, Name, Created, Modified)');}
      else{const recs=k==='summary'?p.rows:fromFiles(p.rows,k);DATA.records.push(...recs);
        const hostCol=k==='raw'&&p.rows.length?p.rows[0].Host:'';
        DATA.names.push(f.name+' ('+recs.length+' samples'+(hostCol?', '+hostCol:'')+')');}
      if(--pending===0){$('err').textContent=err.join(' · ');if(DATA.records.length){show();}else{$('err').textContent=err.join(' · ')||'No rows found';}}};
    rd.readAsText(f);}
}
function loadDir(list){const fl=[...list];if(!fl.length)return;$('err').textContent='';$('prog').textContent='Reading '+fl.length+' file entries…';
  setTimeout(()=>{const ent=[];let root='';
    for(const f of fl){const rp=(f.webkitRelativePath||f.name).split('/');if(rp.length<2)continue;if(!root)root=rp[0];
      ent.push({folder:rp[rp.length-2],name:rp[rp.length-1],lm:localWall(f.lastModified)});}
    const recs=fromFolder(ent);$('prog').textContent='';
    if(!recs.length){$('err').textContent='No sample folders found under "'+root+'". Pick a key images day folder such as E:\\RIA Data\\Continuous Logs\\key images\\2026-10\\07.';return;}
    DATA.records.push(...recs);DATA.approx=true;
    DATA.names.push('folder '+root+' ('+recs.length+' samples'+(recs.skipped?', '+recs.skipped+' without ready.txt skipped':'')+')');show();},30);}
function show(){$('s-guide').open=false;$('empty').hidden=true;$('app').hidden=false;$('ctl').hidden=false;render();}
$('drop').onclick=()=>$('file').click();
$('drop').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click();}};
$('addBtn').onclick=()=>$('file').click();
$('addDir').onclick=()=>$('dir').click();$('dirBtn').onclick=()=>$('dir').click();$('csvBtn').onclick=()=>$('file').click();
$('dir').onchange=e=>{loadDir(e.target.files);e.target.value='';};
$('file').onchange=e=>{loadFiles([...e.target.files]);e.target.value='';};
['dragover','dragenter'].forEach(t=>document.addEventListener(t,e=>{e.preventDefault();$('drop').classList.add('over');}));
['dragleave','drop'].forEach(t=>document.addEventListener(t,e=>{e.preventDefault();$('drop').classList.remove('over');}));
document.addEventListener('drop',e=>loadFiles([...e.dataTransfer.files]));
$('clrBtn').onclick=()=>{selBurst=null;DATA.approx=false;DATA.records=[];DATA.names=[];Object.values(CH).forEach(c=>c.destroy());for(const k in CH)delete CH[k];$('app').hidden=true;$('empty').hidden=false;$('ctl').hidden=true;$('err').textContent='';};
$('thr').onchange=()=>render();
['dMetric','dThr','dBin','dLog'].forEach(id=>$(id).onchange=()=>drawDelay());['dFilt','dType'].forEach(id=>$(id).onchange=()=>{dShowAll=false;drawDelayList();});
$('dMore').onclick=()=>{dShowAll=true;drawDelayList();};$('cam').onchange=()=>render();
$('bsel').onchange=e=>{selBurst=+e.target.value;drawStair();};
$('rsel').onchange=e=>{selBurst=+e.target.value;drawStair();};
$('expAll').onclick=()=>document.querySelectorAll('details.sec').forEach(d=>d.open=true);
$('colAll').onclick=()=>document.querySelectorAll('details.sec').forEach(d=>d.open=false);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(R)render();});

const bgPlugin={id:'bg',beforeDraw(c){const x=c.ctx;x.save();x.globalCompositeOperation='destination-over';x.fillStyle=css('--bg');x.fillRect(0,0,c.width,c.height);x.restore();}};
const hlinePlugin={id:'hline',afterDatasetsDraw(c,a,o){if(!o||!o.lines)return;const x=c.ctx;for(const L of o.lines){const sc=c.scales[L.axis||'y'];if(!sc)continue;const y=sc.getPixelForValue(L.v);if(y<c.chartArea.top||y>c.chartArea.bottom)continue;
  x.save();x.strokeStyle=L.color;x.lineWidth=L.w||1.5;x.setLineDash(L.dash||[6,4]);x.beginPath();x.moveTo(c.chartArea.left,y);x.lineTo(c.chartArea.right,y);x.stroke();
  x.setLineDash([]);x.font='11px system-ui';const w=x.measureText(L.label).width;const lx=L.left?c.chartArea.left+6:c.chartArea.right-w-6;x.lineWidth=3;x.strokeStyle=css('--bg');x.strokeText(L.label,lx,y-4);x.fillStyle=L.color;x.fillText(L.label,lx,y-4);x.restore();}}};
const vlinePlugin={id:'vline',afterDatasetsDraw(c,a,o){if(!o||!o.lines)return;const x=c.ctx;for(const L of o.lines){const sc=c.scales.x;const px=sc.getPixelForValue(L.v);if(px<c.chartArea.left||px>c.chartArea.right)continue;
  x.save();x.strokeStyle=L.color;x.lineWidth=1.5;x.setLineDash([6,4]);x.beginPath();x.moveTo(px,c.chartArea.top);x.lineTo(px,c.chartArea.bottom);x.stroke();x.setLineDash([]);x.fillStyle=L.color;x.font='11px system-ui';x.fillText(L.label,px+4,c.chartArea.top+12);x.restore();}}};
function hatch(color){const p=document.createElement('canvas');p.width=p.height=8;const x=p.getContext('2d');x.fillStyle=color;x.fillRect(0,0,8,8);x.strokeStyle='rgba(255,255,255,.75)';x.lineWidth=2;x.beginPath();x.moveTo(0,8);x.lineTo(8,0);x.moveTo(-2,2);x.lineTo(2,-2);x.moveTo(6,10);x.lineTo(10,6);x.stroke();return x.createPattern(p,'repeat');}

function base(extra){const g=css('--grid'),t=css('--muted');Chart.defaults.color=t;Chart.defaults.font.family=css('--font-body');Chart.defaults.font.size=11;
  return Object.assign({responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false}}},extra||{});}
function axis(title,more){return Object.assign({title:{display:!!title,text:title},grid:{color:css('--grid')},border:{color:css('--border')}},more||{});}
function mk(id,cfg){if(CH[id])CH[id].destroy();cfg.plugins=[bgPlugin,hlinePlugin,vlinePlugin,...(cfg.plugins||[])];CH[id]=new Chart($(id),cfg);return CH[id];}

function render(){
  R=analyze(DATA.records,opts());const {S,B,K}=R;const o=opts();
  $('modeNote').hidden=!S.some(s=>s.approx);
  $('c7note').textContent=S.some(s=>s.moveS!=null)?'':'Copy time needs file Created times: load the script CSV for this chart. Folder mode cannot read them.';
  if(!S.length){$('err').textContent='No usable rows (need NameTime_1 and FirstCopiedOnRIA).';return;}
  const days=[...new Set(S.map(s=>fmtD(s.cap)))];
  $('loaded').textContent='Loaded: '+DATA.names.join(', ')+' · '+days.join(', ');
  $('sub').textContent=(days.length>1?days[0]+' to '+days[days.length-1]:days[0])+' · '+K.samples+' samples in '+K.bursts+' bursts · '+r1(100*K.inc/K.samples)+'% arrived without BCRT handoff files';
  $('sub').title=$('sub').textContent;
  const kp=[
    ['ok',K.samples,'samples in '+K.bursts+' bursts'],
    ['bad',r1(100*K.inc/K.samples)+'%',K.inc+' samples without BCRT handoff files'],
    ['ok',r2(K.readyMed)+' s','median RIA interval when samples were ready'],
    ['bad',r1(K.waitS/60)+' min','RIA waiting on samples not ready ('+K.waits+' waits)'],
    ['bad',K.waits?Math.round(100*K.waitsInc/K.waits)+'%':'–','of waits were on incomplete samples'],
    ['bad',K.worst?r1(K.worst.span/60)+' min':'–','longest burst ('+(K.worst?fmtDT(K.worst.start):'')+')']];
  $('kpis').innerHTML=kp.map(k=>'<div class="kpi '+k[0]+'"><div class="v">'+k[1]+'</div><div class="l">'+k[2]+'</div></div>').join('');
  const slow=B.filter(b=>b.waits>0).sort((a,b)=>b.wait-a.wait);
  const off=B.filter(b=>b.offCadence),ov=B.filter(b=>b.overlap),ce=B.filter(b=>b.overCeil);
  const F=[
    'When a sample was ready, RIA picked up the next one a median of '+r2(K.readyMed)+' s later.',
    K.inc+' of '+K.samples+' samples ('+r1(100*K.inc/K.samples)+'%) reached the mailbox without the BCRT handoff files (ready1.txt, bcrt.settings).',
    'RIA waited '+K.waits+' times for a sample that was not ready ('+r1(K.waitS/60)+' min in total); '+K.waitsInc+' of those waits were on incomplete samples. '+(K.incWaitShare!=null?r1(K.incWaitShare)+'% of incomplete samples triggered a wait, against '+r1(K.compWaitShare)+'% of complete samples.':''),
    slow.length?'Slowest bursts: '+slow.slice(0,4).map(b=>fmtDT(b.start)+' ('+b.n+' samples, '+r1(b.span/60)+' min, '+b.waits+' waits)').join('; ')+'.':'No burst had a wait at the current threshold.',
    'Time before RIA picked up the first sample of each burst totals '+r1(K.preS/60)+' min; it is not split between Key and RIA by this data.'];
  if(off.length)F.push(off.length+' burst(s) arrived less than '+o.cadenceMin+' min after the previous one: '+off.map(b=>fmtDT(b.start)).join(', ')+'.');
  if(ov.length)F.push(ov.length+' burst(s) were still being picked up when the next burst was captured: '+ov.map(b=>fmtDT(b.start)).join(', ')+'.');
  if(ce.length)F.push(ce.length+' burst(s) exceeded the '+o.ceiling+'-sample queue ceiling: '+ce.map(b=>fmtDT(b.start)+' ('+b.n+')').join(', ')+'.');
  $('findings').innerHTML=F.map(f=>'<li>'+f+'</li>').join('');
  const bs=$('bsel');bs.innerHTML=B.map(b=>'<option value="'+b.id+'">'+fmtDT(b.start)+' · '+b.n+' samples'+(b.waits?' · '+b.waits+' waits':'')+'</option>').join('');
  if(selBurst==null||!B[selBurst]) selBurst=slow.length?slow[0].id:0;bs.value=selBurst;$('rsel').innerHTML=bs.innerHTML;$('rsel').value=selBurst;
  const OK=css('--ok'),BAD=css('--bad'),NEU=css('--neutral');
  const multi=days.length>1;const tick=v=>multi?fmtDT(v):fmtT(v).slice(0,5);
  const span=(K.to-K.from)/3600000;const tstep=span<=26?3600000*Math.max(1,Math.ceil(span/12)):undefined;const xmin=tstep?Math.floor(K.from/tstep)*tstep:undefined,xmax=tstep?Math.ceil(K.to/tstep)*tstep:undefined;

  mk('c1',{type:'scatter',data:{datasets:[
    {label:'Complete',data:S.filter(s=>s.complete).map(s=>({x:s.cap,y:s.pickS,f:s.folder})),backgroundColor:OK,pointStyle:'circle',pointRadius:3},
    {label:'Incomplete',data:S.filter(s=>!s.complete).map(s=>({x:s.cap,y:s.pickS,f:s.folder})),backgroundColor:BAD,borderColor:BAD,pointStyle:'crossRot',pointRadius:4,borderWidth:2}]},
    options:base({scales:{x:axis('Capture time',{type:'linear',min:xmin,max:xmax,ticks:{callback:tick,stepSize:tstep,maxTicksLimit:14}}),y:axis('Seconds from capture to RIA pickup',{beginAtZero:true})},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.raw.f+' · '+r1(c.raw.y)+' s'}}}})});

  const lab=B.map(b=>multi?fmtDT(b.start):fmtT(b.start).slice(0,5));
  const c2=mk('c2',{type:'bar',data:{labels:lab,datasets:[
    {label:'Capture to first pickup',data:B.map(b=>r1(b.pre)),backgroundColor:NEU,stack:'s'},
    {label:'RIA moving ready samples',data:B.map(b=>r1(b.move)),backgroundColor:OK,stack:'s'},
    {label:'RIA waiting for a sample not ready',data:B.map(b=>r1(b.wait)),backgroundColor:hatch(BAD),borderColor:BAD,borderWidth:1,stack:'s'}]},
    options:base({scales:{x:axis('Burst start',{stacked:true}),y:axis('Seconds, first capture to last pickup',{stacked:true,beginAtZero:true})},
      plugins:{legend:{display:true,position:'top',labels:{boxWidth:12}},tooltip:{callbacks:{footer:it=>{const b=B[it[0].dataIndex];return b.n+' samples · '+b.inc+' incomplete · '+b.waits+' waits';}}}},
      onClick:(e,el)=>{if(el.length){selBurst=B[el[0].index].id;$('bsel').value=selBurst;$('s-stair').open=true;drawStair();$('s-stair').scrollIntoView({behavior:'smooth'});}}})});

  drawStair();

  const bins=[[0,1,'<1'],[1,2,'1–2'],[2,5,'2–5'],[5,10,'5–10'],[10,30,'10–30'],[30,35,'30–35'],[35,60,'35–60'],[60,1e9,'≥60']];
  const G=S.filter(s=>s.gap!=null);
  const cnt=(ok)=>bins.map(b=>G.filter(s=>s.complete===ok&&s.gap>=b[0]&&s.gap<b[1]).length);
  mk('c4',{type:'bar',data:{labels:bins.map(b=>b[2]+' s'),datasets:[
    {label:'Complete',data:cnt(true),backgroundColor:OK},
    {label:'Incomplete',data:cnt(false),backgroundColor:hatch(BAD),borderColor:BAD,borderWidth:1}]},
    options:base({scales:{x:axis('Seconds since previous RIA pickup in the same burst'),y:axis('Samples (log scale)',{type:'logarithmic',min:0.8,grace:'10%',ticks:{callback:v=>[1,2,5,10,20,50,100,200,500,1000].includes(v)?v:''}})},
      plugins:{legend:{display:true,position:'top',labels:{boxWidth:12}}}})});

  mk('c5',{data:{labels:lab,datasets:[
    {type:'bar',label:'% incomplete',data:B.map(b=>r1(b.pctInc)),backgroundColor:hatch(BAD),borderColor:BAD,borderWidth:1,yAxisID:'y'},
    {type:'line',label:'Longest run of incomplete samples',data:B.map(b=>b.maxRun),borderColor:css('--text'),backgroundColor:css('--text'),pointStyle:'triangle',pointRadius:4,borderDash:[4,3],yAxisID:'y2'}]},
    options:base({scales:{x:axis('Burst start'),y:axis('% of burst without BCRT handoff files',{min:0,max:100}),y2:axis('Consecutive incomplete samples',{position:'right',beginAtZero:true,grid:{display:false}})},
      plugins:{legend:{display:true,position:'top',labels:{boxWidth:12}}}})});

  mk('c6',{data:{labels:lab,datasets:[
    {type:'bar',label:'Samples in burst',data:B.map(b=>b.n),backgroundColor:B.map(b=>b.overCeil?BAD:OK),yAxisID:'y'},
    {type:'line',label:'Minutes since previous burst',data:B.map(b=>b.sincePrev==null?null:r1(b.sincePrev)),borderColor:css('--text'),backgroundColor:css('--text'),pointStyle:B.map(b=>b.offCadence?'rectRot':'circle'),pointRadius:B.map(b=>b.offCadence?6:3),yAxisID:'y2'}]},
    options:base({scales:{x:axis('Burst start'),y:axis('Samples',{beginAtZero:true,suggestedMax:o.ceiling*1.15}),y2:axis('Minutes since previous burst',{position:'right',beginAtZero:true,grid:{display:false}})},
      plugins:{legend:{display:true,position:'top',labels:{boxWidth:12}},hline:{lines:[{v:o.ceiling,left:true,label:'queue ceiling '+o.ceiling,color:BAD},{v:o.cadenceMin,axis:'y2',left:true,label:o.cadenceMin+' min: off-cadence below (diamond)',color:css('--muted')}]}}})});

  const mv=S.filter(s=>s.moveS!=null);
  mk('c7',{type:'scatter',data:{datasets:[{label:'Copy time',data:mv.map(s=>({x:s.cap,y:s.moveS,f:s.folder})),backgroundColor:OK,pointRadius:2}]},
    options:base({scales:{x:axis('Capture time',{type:'linear',min:xmin,max:xmax,ticks:{callback:tick,stepSize:tstep,maxTicksLimit:14}}),y:axis('Seconds to copy one sample',{beginAtZero:true})},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.raw.f+' · '+r2(c.raw.y)+' s'}}}})});

  const H=['Burst start','Samples','Incomplete','% incomplete','Longest run','First pickup s','Last sample pickup s','Burst span min','RIA move s','Waits','Wait s','Min since prev','Flags'];
  $('tab').innerHTML='<thead><tr>'+H.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+B.map(b=>{
    const fl=(b.waits?'<span class="badge bad">waits</span>':'')+(b.offCadence?'<span class="badge check">off-cadence</span>':'')+(b.overlap?'<span class="badge warn">overlap</span>':'')+(b.overCeil?'<span class="badge bad">over ceiling</span>':'');
    return '<tr class="click'+(b.wait>=60?' flag':'')+'" data-b="'+b.id+'"><td class="mono">'+fmtD(b.start)+' '+fmtT(b.start)+'</td><td>'+b.n+'</td><td>'+b.inc+'</td><td>'+r1(b.pctInc)+'</td><td>'+b.maxRun+'</td><td>'+r1(b.pre)+'</td><td>'+r1(b.maxPickS)+'</td><td>'+r1(b.span/60)+'</td><td>'+r1(b.move)+'</td><td>'+b.waits+'</td><td>'+r1(b.wait)+'</td><td>'+(b.sincePrev==null?'':r1(b.sincePrev))+'</td><td>'+fl+'</td></tr>';}).join('')+'</tbody>';
  drawReady();drawDelay();
  $('tab').querySelectorAll('tr.click').forEach(tr=>tr.onclick=()=>{selBurst=+tr.dataset.b;$('bsel').value=selBurst;$('s-stair').open=true;drawStair();$('s-stair').scrollIntoView({behavior:'smooth'});});
}
function drawStair(){
  const b=R.B[selBurst];if(!b)return;$('bsel').value=selBurst;$('rsel').value=selBurst;drawReadyChart();const OK=css('--ok'),BAD=css('--bad');
  mk('c3',{data:{datasets:[
    {type:'line',data:b.samples.map(s=>({x:s.idx,y:s.pickS})),borderColor:css('--neutral'),borderWidth:1,pointRadius:0,order:2},
    {type:'scatter',label:'Complete',data:b.samples.filter(s=>s.complete).map(s=>({x:s.idx,y:s.pickS,s})),backgroundColor:OK,pointStyle:'circle',pointRadius:5,order:1},
    {type:'scatter',label:'Incomplete',data:b.samples.filter(s=>!s.complete).map(s=>({x:s.idx,y:s.pickS,s})),backgroundColor:BAD,borderColor:BAD,pointStyle:'crossRot',pointRadius:6,borderWidth:2.5,order:1}]},
    options:base({scales:{x:axis('Sample number within burst (capture order) · burst '+fmtDT(b.start),{type:'linear',min:0,max:b.n+1,ticks:{stepSize:5}}),y:axis('Seconds from capture to RIA pickup',{beginAtZero:true})},
      plugins:{legend:{display:false},tooltip:{filter:i=>!!i.raw.s,callbacks:{label:c=>{const s=c.raw.s;return s.folder+' · pickup '+r1(s.pickS)+' s'+(s.gap!=null?' · '+r2(s.gap)+' s after previous':'')+(s.complete?'':' · no BCRT handoff files');}}}}})});
}

function drawReady(){const F=R.S.filter(s=>s.fl);const med=a=>{a=a.filter(x=>x!=null);return a.length?median(a):null;};
  if(!F.length){$('rKpis').innerHTML='';$('rTab').innerHTML='';$('rNote').textContent='Per-file timestamps need a KeyImageFiles CSV (or the older _files.csv); a _summary.csv only carries the counts.';return;}
  const n=F.length,nR1=F.filter(s=>s.fl.r1).length,bc=F.filter(s=>s.fl.bc).length,rd=F.filter(s=>s.fl.rd).length,byR=F.filter(s=>s.fl.rdByRIA).length,last=F.filter(s=>s.fl.rdLast).length;
  const r1d=med(F.map(s=>s.fl.r1&&s.fl.r1.w!=null?(s.fl.r1.w-s.cap)/1000:null)),bcd=med(F.map(s=>s.fl.bc&&s.fl.bc.w!=null?(s.fl.bc.w-s.cap)/1000:null)),
    hdd=med(F.map(s=>s.fl.hd&&s.fl.hd.w!=null?(s.fl.hd.w-s.cap)/1000:null)),rdp=med(F.map(s=>s.fl.rd&&s.fl.rd.c!=null?(s.fl.rd.c-s.pick)/1000:null)),
    bcBefore=F.filter(s=>s.fl.bc&&s.fl.r1&&s.fl.bc.w<s.fl.r1.w).length,mis=F.filter(s=>!s.fl.r1&&!s.fl.bc).length,odd=F.filter(s=>!!s.fl.r1!==!!s.fl.bc).length;
  $('rKpis').innerHTML=[
    ['ok',nR1+' / '+n,'samples with ready1.txt ('+r1(100*nR1/n)+'%)'],
    ['bad',mis,'samples with neither ready1.txt nor bcrt.settings'+(odd?' · '+odd+' with only one of them':'')],
    F.some(s=>s.fl.rd&&s.fl.rd.c!=null)?['ok',byR+' / '+rd,'ready.txt with Created = Modified, written by RIA']:['ok','n/a','ready.txt Created = Modified check needs the script CSV'],
    F.some(s=>s.fl.rd&&s.fl.rd.c!=null)?['ok',last+' / '+rd,'ready.txt is the last file RIA wrote in the folder']:['ok',rd+' / '+n,'samples with ready.txt in key images']
  ].map(k=>'<div class="kpi '+k[0]+'"><div class="v">'+k[1]+'</div><div class="l">'+k[2]+'</div></div>').join('');
  const T=[['File','Written by','Timestamp that survives in key images','What it tells you'],
    ['frameGrab, header.txt','Key CFG','Modified, median '+r2(hdd)+' s after capture','When the CFG wrote the image.'],
    ['bcrt.settings','Key CFG','Modified, median '+r2(bcd)+' s after capture'+(bcBefore?'; earlier than ready1.txt in '+bcBefore+' of '+bc:''),'Present only on samples that went the BCRT path. Stamped at capture, so it does not show when BCRT finished.'],
    ['ready1.txt','Key CFG','Modified, median '+r2(r1d)+' s after capture','Key\'s signal to BCRT that an image is waiting. Missing on '+(n-nR1)+' samples.'],
    ['Ready.txt (mailbox)','Key BCRT','None: replaced during the move','The handoff RIA waits for. When it is late or missing, RIA waits up to 30 s. Its real time can only be logged in the mailbox itself.'],
    ['ready.txt (key images)','RIA',F.some(s=>s.fl.rd&&s.fl.rd.c!=null)?'Created = Modified on '+byR+' of '+rd+', median '+r2(rdp)+' s after pickup':'Modified = end of RIA copy (used as the pickup time in folder mode)','RIA\'s own marker at the end of the copy. Never a Key or BCRT time.']];
  $('rTab').innerHTML='<thead><tr>'+T[0].map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+T.slice(1).map(r=>'<tr><td class="mono">'+r[0]+'</td><td>'+r[1]+'</td><td>'+r[2]+'</td><td>'+r[3]+'</td></tr>').join('')+'</tbody>';
  $('rNote').textContent='';drawReadyChart();}
function drawReadyChart(){const b=R.B[selBurst];if(!b)return;const sm=b.samples.filter(s=>s.fl);if(!sm.length){if(CH.c0){CH.c0.destroy();delete CH.c0;}return;}
  const OK=css('--ok'),BAD=css('--bad'),NEU=css('--neutral'),TX=css('--text');const pt=(f,k)=>sm.filter(s=>s.fl[f]&&s.fl[f][k]!=null).map(s=>({x:(s.fl[f][k]-s.cap)/1000,y:s.idx,s}));
  mk('c0',{type:'scatter',data:{datasets:[
    {label:'header.txt',data:pt('hd','w'),backgroundColor:NEU,pointStyle:'rect',pointRadius:5},
    {label:'ready1.txt',data:pt('r1','w'),backgroundColor:OK,pointStyle:'triangle',pointRadius:6},
    {label:'bcrt.settings',data:pt('bc','w'),backgroundColor:TX,pointStyle:'rectRot',pointRadius:4},
    {label:'RIA pickup',data:sm.map(s=>({x:s.pickS,y:s.idx,s})),backgroundColor:'transparent',borderColor:OK,borderWidth:1.5,pointStyle:'circle',pointRadius:6},
    {label:'ready.txt (RIA)',data:pt('rd','c'),backgroundColor:BAD,borderColor:BAD,pointStyle:'star',pointRadius:7,borderWidth:1.5}]},
    options:base({scales:{x:axis('Seconds after capture · burst '+fmtDT(b.start),{beginAtZero:true}),y:axis('Sample number (capture order)',{reverse:true,min:0,max:b.n+1,ticks:{stepSize:5}})},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.dataset.label+' · '+c.raw.s.folder+' · '+r2(c.raw.x)+' s'+(c.raw.s.complete?'':' · no BCRT handoff files')}}}})});}

function delayTag(){const m=$('dMetric').value,thr=+$('dThr').value||0;
  return R.S.map(s=>{const v=m==='gap'?s.gap:s.pickS;return {s,v,tag:v==null?'n':(v>=thr?'d':'o')};});}
function drawDelay(){if(!R)return;DT=delayTag();const thr=+$('dThr').value||0,bw=Math.max(0.1,+$('dBin').value||5),m=$('dMetric').value;
  const OK=css('--ok'),BAD=css('--bad'),NEU=css('--neutral');const days=[...new Set(R.S.map(s=>fmtD(s.cap)))];const multi=days.length>1;
  const T=DT.filter(d=>d.tag!=='n'),D=T.filter(d=>d.tag==='d');
  const by=t=>{const a=T.filter(d=>t?d.s.complete:!d.s.complete),b=a.filter(d=>d.tag==='d');return [b.length,a.length];};
  const [dc,tc]=by(true),[di,ti]=by(false);
  const mname=m==='gap'?'interval since previous pickup':'capture to pickup';
  $('dKpis').innerHTML=[
    ['bad',D.length+' / '+T.length,'samples delayed ('+r1(T.length?100*D.length/T.length:0)+'%), '+mname+' ≥ '+thr+' s'],
    ['bad',r1(ti?100*di/ti:0)+'%','of incomplete samples delayed ('+di+' / '+ti+')'],
    ['ok',r1(tc?100*dc/tc:0)+'%','of complete samples delayed ('+dc+' / '+tc+')'],
    ['bad',r1(D.reduce((a,d)=>a+d.v,0)/60)+' min','total measured time on delayed samples'],
    ['ok',DT.length-T.length,'untagged'+(m==='gap'?' (first sample of each burst)':'')]
  ].map(k=>'<div class="kpi '+k[0]+'"><div class="v">'+k[1]+'</div><div class="l">'+k[2]+'</div></div>').join('');
  const vals=T.map(d=>d.v).sort((a,b)=>a-b);const p99=vals.length?vals[Math.min(vals.length-1,Math.floor(vals.length*0.995))]:0;
  const top=Math.max(thr+bw,Math.ceil(p99/bw)*bw);const nb=Math.min(200,Math.ceil(top/bw));
  const edges=[...Array(nb).keys()].map(i=>i*bw);const lab=edges.map(e=>r1(e));lab.push('≥'+r1(nb*bw));
  const cnt=ok=>{const c=new Array(nb+1).fill(0);T.filter(d=>d.s.complete===ok).forEach(d=>{c[Math.min(nb,Math.floor(d.v/bw))]++;});return c;};
  const thrIdx=thr/bw;
  const thrPlugin={id:'thrv',afterDatasetsDraw(c){const x=c.ctx,sc=c.scales.x;const i0=Math.floor(thrIdx),fr=thrIdx-i0;
    const a=sc.getPixelForValue(Math.min(i0,nb)),b=sc.getPixelForValue(Math.min(i0+1,nb));const step=(b-a)||((sc.getPixelForValue(1)-sc.getPixelForValue(0)));
    const px=a-step/2+fr*step;x.save();x.strokeStyle=BAD;x.lineWidth=1.5;x.setLineDash([6,4]);x.beginPath();x.moveTo(px,c.chartArea.top);x.lineTo(px,c.chartArea.bottom);x.stroke();
    x.setLineDash([]);x.font='11px system-ui';x.lineWidth=3;x.strokeStyle=css('--bg');const t='threshold '+thr+' s';x.strokeText(t,px+4,c.chartArea.top+12);x.fillStyle=BAD;x.fillText(t,px+4,c.chartArea.top+12);x.restore();}};
  const logY=$('dLog').checked;
  mk('c9a',{type:'bar',data:{labels:lab,datasets:[
    {label:'Complete',data:cnt(true),backgroundColor:OK,stack:'h',barPercentage:1,categoryPercentage:0.95},
    {label:'Incomplete',data:cnt(false),backgroundColor:hatch(BAD),borderColor:BAD,borderWidth:1,stack:'h',barPercentage:1,categoryPercentage:0.95}]},
    plugins:[thrPlugin],
    options:base({scales:{x:axis('Seconds, '+mname+' (bin '+bw+' s)',{stacked:true,ticks:{autoSkip:true,maxTicksLimit:16}}),
      y:axis('Samples'+(logY?' (log scale)':''),logY?{stacked:true,type:'logarithmic',min:0.8,ticks:{callback:v=>[1,2,5,10,20,50,100,200,500,1000,2000,5000].includes(v)?v:''}}:{stacked:true,beginAtZero:true})},
      plugins:{legend:{display:false},tooltip:{callbacks:{title:it=>{const i=it[0].dataIndex;return i<nb?r1(i*bw)+'–'+r1((i+1)*bw)+' s':'≥'+r1(nb*bw)+' s';}}}}})});
  const span=(R.K.to-R.K.from)/3600000;const tstep=span<=26?3600000*Math.max(1,Math.ceil(span/12)):undefined;
  const xmin=tstep?Math.floor(R.K.from/tstep)*tstep:undefined,xmax=tstep?Math.ceil(R.K.to/tstep)*tstep:undefined;const tick=v=>multi?fmtDT(v):fmtT(v).slice(0,5);
  mk('c9b',{type:'scatter',data:{datasets:[
    {label:'On time',data:T.filter(d=>d.tag==='o').map(d=>({x:d.s.cap,y:d.v,f:d.s.folder,c:d.s.complete})),backgroundColor:OK,pointStyle:'circle',pointRadius:2.5},
    {label:'Delayed',data:D.map(d=>({x:d.s.cap,y:d.v,f:d.s.folder,c:d.s.complete})),backgroundColor:BAD,borderColor:BAD,pointStyle:'crossRot',pointRadius:4,borderWidth:2}]},
    options:base({scales:{x:axis('Capture time',{type:'linear',min:xmin,max:xmax,ticks:{callback:tick,stepSize:tstep,maxTicksLimit:14}}),y:axis('Seconds, '+mname,{beginAtZero:true})},
      plugins:{legend:{display:false},hline:{lines:[{v:thr,left:true,label:'threshold '+thr+' s',color:BAD}]},tooltip:{callbacks:{label:c=>c.raw.f+' · '+r1(c.raw.y)+' s · '+(c.raw.c?'complete':'incomplete')}}}})});
  const B=R.B;const blab=B.map(b=>multi?fmtDT(b.start):fmtT(b.start).slice(0,5));
  const pb=B.map(b=>{const t=DT.filter(d=>d.s.burst===b.id&&d.tag!=='n');const dd=t.filter(d=>d.tag==='d');return {dc:dd.filter(d=>d.s.complete).length,di:dd.filter(d=>!d.s.complete).length,pct:t.length?100*dd.length/t.length:0};});
  mk('c9c',{data:{labels:blab,datasets:[
    {type:'bar',label:'Delayed, complete',data:pb.map(x=>x.dc),backgroundColor:OK,stack:'b',yAxisID:'y'},
    {type:'bar',label:'Delayed, incomplete',data:pb.map(x=>x.di),backgroundColor:hatch(BAD),borderColor:BAD,borderWidth:1,stack:'b',yAxisID:'y'},
    {type:'line',label:'% of burst delayed',data:pb.map(x=>r1(x.pct)),borderColor:css('--text'),backgroundColor:css('--text'),pointStyle:'triangle',pointRadius:4,borderDash:[4,3],yAxisID:'y2'}]},
    options:base({scales:{x:axis('Burst start',{stacked:true}),y:axis('Delayed samples',{stacked:true,beginAtZero:true}),y2:axis('% of tagged samples delayed',{position:'right',min:0,max:100,grid:{display:false}})},
      plugins:{legend:{display:true,position:'top',labels:{boxWidth:12}}}})});
  const hUsed=[...new Set(T.map(d=>new Date(d.s.cap).getUTCHours()))];const hrs=hUsed.length?[...Array(Math.max(...hUsed)-Math.min(...hUsed)+1).keys()].map(i=>i+Math.min(...hUsed)):[];const ph=hrs.map(h=>{const t=T.filter(d=>new Date(d.s.cap).getUTCHours()===h);const dd=t.filter(d=>d.tag==='d');return {n:t.length,d:dd.length,pct:t.length?100*dd.length/t.length:null};});
  mk('c9d',{data:{labels:hrs.map(h=>String(h).padStart(2,'0')+':00'),datasets:[
    {type:'bar',label:'% delayed',data:ph.map(x=>x.pct==null?null:r1(x.pct)),backgroundColor:hatch(BAD),borderColor:BAD,borderWidth:1,yAxisID:'y'},
    {type:'line',label:'Tagged samples',data:ph.map(x=>x.n||null),borderColor:css('--muted'),backgroundColor:css('--muted'),pointRadius:3,yAxisID:'y2',spanGaps:false}]},
    options:base({scales:{x:axis('Hour of capture'+(multi?' (all loaded days combined)':'')),y:axis('% of samples delayed',{min:0,max:100}),y2:axis('Tagged samples',{position:'right',beginAtZero:true,grid:{display:false}})},
      plugins:{legend:{display:true,position:'top',labels:{boxWidth:12}},tooltip:{callbacks:{footer:it=>{const x=ph[it[0].dataIndex];return x.d+' of '+x.n+' delayed';}}}}})});
  drawDelayList();}
function drawDelayList(){if(!DT)return;const f=$('dFilt').value,ty=$('dType').value;
  const L=DT.filter(d=>(f==='all'||d.tag===f)&&(ty==='all'||(ty==='c')===d.s.complete));
  const lim=dShowAll?L.length:Math.min(L.length,300);
  $('dCount').textContent=L.length+' samples'+(lim<L.length?' · showing first '+lim:'');
  $('dMore').hidden=lim>=L.length;$('dMore').textContent='Show all '+L.length+' rows';
  const H=['Folder','Burst','#','Capture','RIA pickup','Capture to pickup s','Interval s','Measure s','Tag','Type'];
  const tagB=t=>t==='d'?'<span class="badge bad">&#10007; delayed</span>':t==='o'?'<span class="badge ok">&#10003; on time</span>':'<span class="badge mut">untagged</span>';
  $('dTab').innerHTML='<thead><tr>'+H.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+L.slice(0,lim).map(d=>{const s=d.s;
    return '<tr class="click'+(d.tag==='d'?' flag':'')+'" data-b="'+s.burst+'"><td class="mono">'+s.folder+'</td><td class="mono">'+fmtT(R.B[s.burst].start).slice(0,5)+'</td><td>'+s.idx+'</td><td class="mono">'+fmtT(s.cap)+'</td><td class="mono">'+fmtT(s.pick)+'</td><td>'+r1(s.pickS)+'</td><td>'+(s.gap==null?'':r2(s.gap))+'</td><td>'+(d.v==null?'':r2(d.v))+'</td><td>'+tagB(d.tag)+'</td><td>'+(s.complete?'complete':'<span class="badge bad">incomplete</span>')+'</td></tr>';}).join('')+'</tbody>';
  $('dTab').querySelectorAll('tr.click').forEach(tr=>tr.onclick=()=>{selBurst=+tr.dataset.b;$('bsel').value=selBurst;$('s-stair').open=true;drawStair();$('s-stair').scrollIntoView({behavior:'smooth'});});}

const XLSX_CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=XLSX_CRC[(c^u8[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
const enc=s=>new TextEncoder().encode(s);
function zipStore(files){const chunks=[],cd=[];let off=0;const u16=v=>[v&255,(v>>8)&255],u32=v=>[v&255,(v>>8)&255,(v>>16)&255,(v>>24)&255];
  for(const f of files){const name=enc(f.name),data=f.data,crc=crc32(data);
    const lh=new Uint8Array([0x50,0x4b,3,4,...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0)]);
    chunks.push(lh,name,data);
    cd.push(new Uint8Array([0x50,0x4b,1,2,...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),name);
    off+=lh.length+name.length+data.length;}
  let cdLen=0;for(const c of cd)cdLen+=c.length;
  const eocd=new Uint8Array([0x50,0x4b,5,6,...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cdLen),...u32(off),...u16(0)]);
  const all=[...chunks,...cd,eocd];let total=0;for(const a of all)total+=a.length;const out=new Uint8Array(total);let p=0;for(const a of all){out.set(a,p);p+=a.length;}return out;}
const xesc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const colName=n=>{let s='';n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=(n-m-1)/26;}return s;};
function sheetXml(rows,widths){let x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
  if(widths&&widths.length){x+='<cols>'+widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols>';}
  x+='<sheetData>';rows.forEach((row,ri)=>{x+='<row r="'+(ri+1)+'">';row.forEach((v,ci)=>{const ref=colName(ci)+(ri+1);if(v===null||v===undefined||v==='')return;
    if(typeof v==='number'&&isFinite(v))x+='<c r="'+ref+'"'+(ri===0?' s="1"':'')+'><v>'+v+'</v></c>';else x+='<c r="'+ref+'" t="inlineStr"'+(ri===0?' s="1"':'')+'><is><t>'+xesc(v)+'</t></is></c>';});x+='</row>';});
  return x+'</sheetData></worksheet>';}
function buildXlsx(sheets){
  const ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>';
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>'<sheet name="'+xesc(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>';
  const wbr='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf xfId="0"/><xf xfId="0" fontId="1" applyFont="1"/></cellXfs></styleSheet>';
  const files=[{name:'[Content_Types].xml',data:enc(ct)},{name:'_rels/.rels',data:enc(rels)},{name:'xl/workbook.xml',data:enc(wb)},{name:'xl/_rels/workbook.xml.rels',data:enc(wbr)},{name:'xl/styles.xml',data:enc(styles)}];
  sheets.forEach((s,i)=>files.push({name:'xl/worksheets/sheet'+(i+1)+'.xml',data:enc(sheetXml(s.rows,s.widths))}));return zipStore(files);}
function sheets(){const {S,B,K}=R;const o=opts();const n=v=>v==null?null:Math.round(v*1000)/1000;
  const sum=[['Burst start','Samples','Incomplete','% incomplete','Longest incomplete run','Capture to first pickup s','Last sample pickup s','Burst span s','RIA moving s','Waits','Waits on incomplete','Wait s','Min since prev burst','Off-cadence','Overlap','Over ceiling']]
    .concat(B.map(b=>[fmtD(b.start)+' '+fmtT(b.start),b.n,b.inc,n(b.pctInc),b.maxRun,n(b.pre),n(b.maxPickS),n(b.span),n(b.move),b.waits,b.waitsInc,n(b.wait),n(b.sincePrev),b.offCadence?'yes':'',b.overlap?'yes':'',b.overCeil?'yes':'']));
  const dt=delayTag();const dm=$('dMetric').value==='gap'?'Interval since previous pickup':'Capture to pickup';const dth=+$('dThr').value||0;
  const rd=[['Folder','Burst start','Sample #','Capture','RIA pickup','Capture to pickup s','Gap from previous pickup s','Wait','Complete (BCRT handoff files)','RIA copy s','Delay measure s','Delay tag','ready1.txt written','ready.txt written by RIA (Created = Modified)']]
    .concat(S.map(s=>[s.folder,fmtD(R.B[s.burst].start)+' '+fmtT(R.B[s.burst].start),s.idx,new Date(s.cap).toISOString().replace('T',' ').slice(0,23),new Date(s.pick).toISOString().replace('T',' ').slice(0,23),n(s.pickS),n(s.gap),s.wait?'yes':'',s.complete?'yes':'no',n(s.moveS),n(dt[S.indexOf(s)].v),{d:'delayed',o:'on time',n:'untagged'}[dt[S.indexOf(s)].tag],s.fl&&s.fl.r1&&s.fl.r1.w!=null?new Date(s.fl.r1.w).toISOString().replace('T',' ').slice(0,23):'',s.fl?(s.fl.rdByRIA?'yes':'no'):'']));
  const G=S.filter(s=>s.gap!=null);
  const fits=[['Figure','Value','Note'],['Samples',K.samples,''],['Bursts',K.bursts,''],['Incomplete samples',K.inc,'no ready1.txt / bcrt.settings'],['% incomplete',n(100*K.inc/K.samples),''],
    ['Median pickup interval, ready complete samples s',n(K.readyMed),'gaps below wait threshold'],['Waits',K.waits,'gap >= '+o.waitThr+' s'],['Waits on incomplete samples',K.waitsInc,''],
    ['Total wait s',n(K.waitS),''],['Total RIA moving s',n(K.moveS),''],['Total capture to first pickup s',n(K.preS),'not attributable to Key or RIA from this data'],
    ['% incomplete samples that triggered a wait',n(K.incWaitShare),''],['% complete samples that triggered a wait',n(K.compWaitShare),'']];
  const about=[['Item','Value'],['Report','RIA continuous sample arrival timing'],['Version','{{VERSION}}'],['Exported',new Date().toISOString()],['Sources',DATA.names.join('; ')],
    ['Wait threshold s',o.waitThr],['Delay tag','delayed if '+dm.toLowerCase()+' >= '+dth+' s; first sample of a burst is untagged when the measure is the interval'],['Burst split','new burst when capture gap > '+o.burstGap+' s'],['Queue ceiling',o.ceiling],['Off-cadence','burst less than '+o.cadenceMin+' min after previous'],
    ['Caveat','Capture time is the sorter/CFG clock (folder name); pickup is the RIA server clock (first file Created). Check clock skew before quoting single-second values.'],
    ['Caveat','ready.txt inside key images is written by RIA when the move completes; it is not a Key/BCRT timestamp.'],
    ['Caveat','Complete = sample folder contains ready1.txt and bcrt.settings. Incomplete samples were moved without them.'],['Caveat','ready1.txt is written by the Key CFG (signal to BCRT). BCRT writes Ready.txt in the mailbox (signal to RIA); that time is not kept. ready.txt in key images is written by RIA.']];
  return [{name:'Summary',rows:sum,widths:[20,9,10,12,12,14,14,12,12,8,12,10,12,10,9,11]},{name:'Readings',rows:rd,widths:[26,20,9,24,24,14,14,7,12,10,14,11,24,18]},{name:'Fits',rows:fits,widths:[48,12,40]},{name:'About',rows:about,widths:[22,110]}];}
async function save(filename,blob,btn,okMsg){let dl=null;try{dl=(window.claude&&claude.use)?await claude.use('downloads'):null;}catch(e){dl=null;}
  try{if(dl){await dl.save({filename,data:blob});}else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();a.remove();}return okMsg;}
  catch(e){return (e&&(e.code==='cancelled'||e.code==='declined'))?'Cancelled':'Export failed';}}

$('guideBtn').onclick=()=>{const g=$('s-guide');g.open=true;g.scrollIntoView({behavior:'smooth'});};
$('dlScript').onclick=async()=>{const b=$('dlScript');b.disabled=true;$('dlMsg').textContent='';
  const crlf=s=>s.replace(/\r?\n/g,'\r\n');const bom=new Uint8Array([0xEF,0xBB,0xBF]);
  const ps=id=>{const src=enc(crlf($(id).textContent.replace(/^\n/,'')));const o=new Uint8Array(bom.length+src.length);o.set(bom);o.set(src,bom.length);return o;};
  const readme=enc(crlf(['RIA arrival timing scripts (page v{{VERSION}})','',
   'RIA_KeyImage_Files_v2.00.ps1  -  lists a key images day folder for the timing page',
   '  1. Right-click the .ps1 > Properties > tick Unblock > OK.',
   '  2. Copy it into the day folder, e.g. E:\\RIA Data\\Continuous Logs\\key images\\2026-10\\07\\',
   '  3. Right-click > Run with PowerShell, or:',
   '     powershell -ExecutionPolicy Bypass -File "E:\\RIA Data\\Continuous Logs\\key images\\2026-10\\07\\RIA_KeyImage_Files_v2.00.ps1"',
   '  4. Result on the Desktop: KeyImageFiles_<yyyy-MM-dd>.csv. Delete the script from the day folder.',
   '  5. Load the CSV into RIA_Arrival_Timing_v{{VERSION}}.html.','',
   'RIA_Mailbox_Watch_v1.00.ps1  -  read-only watcher for the Key Continuous mailbox',
   '  powershell -ExecutionPolicy Bypass -File .\\RIA_Mailbox_Watch_v1.00.ps1 -Minutes 65',
   '  Logs when ready1.txt and BCRT Ready.txt appear and estimates the CFG-RIA clock offset.',
   '  Output on the Desktop: MailboxWatch_<date_time>.csv','',
   'Both scripts only read; they never move, change or delete anything.'].join('\n')));
  const zip=zipStore([{name:'RIA_KeyImage_Files_v2.00.ps1',data:ps('ps1src')},{name:'RIA_Mailbox_Watch_v1.00.ps1',data:ps('ps1watch')},{name:'README.txt',data:readme}]);
  const m=await save('RIA_scripts.zip',new Blob([zip],{type:'application/zip'}),b,'Saved');$('dlMsg').textContent=m;b.disabled=false;};
function tag(){const d=[...new Set(R.S.map(s=>fmtD(s.cap)))];return d.length>1?d[0]+'_to_'+d[d.length-1]:d[0];}
$('xlsx').onclick=async()=>{const b=$('xlsx');b.disabled=true;$('expMsg').textContent='';const m=await save('RIA_arrival_timing_'+tag()+'.xlsx',new Blob([buildXlsx(sheets())],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),b,'Saved');$('expMsg').textContent=m;b.disabled=false;};
$('png').onclick=async()=>{const b=$('png');b.disabled=true;document.querySelectorAll('details.sec').forEach(d=>d.open=true);await new Promise(r=>setTimeout(r,250));
  const names={c1:'1_capture_to_pickup',c2:'2_burst_breakdown',c3:'3_burst_samples',c4:'4_pickup_interval',c5:'5_completeness',c6:'6_cadence_size',c7:'7_ria_copy_time',c9a:'9a_delay_histogram',c9b:'9b_delay_timeseries',c9c:'9c_delayed_per_burst',c9d:'9d_delayed_by_hour',c0:'0_ready_files_per_sample'};let last='';
  for(const id in names){const c=CH[id];if(!c)continue;c.resize();const url=c.toBase64Image('image/png',1);const blob=await (await fetch(url)).blob();last=await save(tag()+'_'+names[id]+'.png',blob,b,'Saved');if(last!=='Saved')break;}
  $('expMsg').textContent=last;b.disabled=false;};
