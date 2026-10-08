// node tests/test_keyimages.js [RIA Data folder]  -- header typing, plus scan/index over a real folder (default Examples/RIA_Data, skipped if absent).
const assert=require('assert');const fs=require('fs');const path=require('path');
const K=require('../src/js/keyimages.js');

const H=(rc,fc)=>K.kiParseHeader(`[System ID]\nID=x ; comment\n[Acquisition ID]\nRecycleContent=${rc}\nFryerContent=${fc}\n`);
assert.strictEqual(K.kiGet(H('In-Bag','Fryer Exit'),'system id','id'),'x','comment stripped, case-insensitive');
assert.strictEqual(K.kiClassify(H('In-Bag','Fryer Exit'),'Continuous').label,'In-Bag');
assert.strictEqual(K.kiClassify(H('Mini-Dump','Mini-Dump'),'Continuous').label,'Mini-Dump');
assert.strictEqual(K.kiClassify(H('Mini-Dump','Mini-Dump'),'Continuous').warn.length,0);
assert.strictEqual(K.kiClassify(H('In-Bag','Mini-Dump'),'Continuous').warn.length,1,'mis-tag flagged');
assert.strictEqual(K.kiClassify(H('1st Pass','Fryer Exit'),'Main').label,'Fryer Exit');
assert.strictEqual(K.kiClassify(H('1st Pass','Minidump'),'Main').label,'Mini-Dump');
assert.strictEqual(K.kiClassify(H('Calibration','None'),'Main').key,'other');
assert.strictEqual(K.kiSampleTime('2026-10-07_00.19.02.942'),Date.UTC(2026,9,7,0,19,2,942));

// vfs that records which folders were listed, to prove only folders in range are opened
const opened=[];
function vfs(p){const st=fs.statSync(p),name=path.basename(p);
  if(st.isDirectory())return {name,kind:'dir',list:async()=>{opened.push(path.relative(root,p));return fs.readdirSync(p).map(n=>vfs(path.join(p,n)));}};
  return {name,kind:'file',file:async()=>({size:st.size,lastModified:st.mtimeMs,text:async()=>fs.readFileSync(p,'utf8')})};}
const root=process.argv[2]||path.join(__dirname,'..','Examples','RIA_Data');
const R=(a,b)=>({from:K.kiSampleTime(a),to:K.kiSampleTime(b)});

assert.deepStrictEqual(K.kiMonths(R('2025-11-30_00.00.00.000','2026-02-01_00.00.00.000')),['2025-11','2025-12','2026-01','2026-02']);

(async()=>{
  if(!fs.existsSync(root)){console.log('ok (header tests only; no folder at',root+')');return;}
  const count=dir=>fs.readdirSync(dir,{withFileTypes:true}).reduce((n,e)=>e.isDirectory()?n+(/^\d{4}-\d{2}-\d{2}_/.test(e.name)?1:count(path.join(dir,e.name))):n,0);
  // 1 day back from a launch time: only that window's day folders are opened
  opened.length=0;
  const day=await K.kiFind(vfs(root),R('2026-10-06_23.00.00.000','2026-10-07_23.00.00.000'));
  const oneDay=[...opened];
  const sampleDirsOpened=opened.filter(o=>/\d{4}-\d{2}-\d{2}_/.test(o));
  assert.strictEqual(sampleDirsOpened.length,0,'kiFind never opens a sample folder');
  assert.ok(opened.every(o=>!/2026-09/.test(o)),'September folders not opened for an October range: '+opened.filter(o=>/2026-09/.test(o)));
  const dayS=await K.kiLoad(day.jobs);
  assert.strictEqual(dayS.length,14+43);
  // window inside a day: exact sample times
  const hour=await K.kiFind(vfs(root),R('2026-10-07_09.30.00.000','2026-10-07_09.40.00.000'),{logs:['Main']});
  assert.ok(hour.jobs.length>0&&hour.jobs.every(j=>j.log==='Main'&&j.node.name>='2026-10-07_09.30'&&j.node.name<'2026-10-07_09.40'),'time window and log filter');
  // whole period: every sample folder on disk
  const allF=await K.kiFind(vfs(root),R('2026-09-01_00.00.00.000','2026-10-31_23.59.59.999'));
  const all=await K.kiLoad(allF.jobs);
  assert.strictEqual(all.length,count(root),'all sample folders found');
  assert.ok(all.every(s=>s.t!=null&&(s.hdr||s.cls.warn.length)),'every sample has a time, and a header or a warning');
  assert.ok(all.every(s=>s.log==='Main'||s.log==='Continuous'),'log type known');
  const by={};for(const s of all){const k=s.log+' '+s.cls.label;by[k]=(by[k]||0)+1;}
  // narrower roots: key images (log from files, empty folder inherits), a month folder with samples directly in it, a day folder
  const ki=await K.kiLoad((await K.kiFind(vfs(path.join(root,'Main Logs','key images')),R('2026-09-01_00.00.00.000','2026-10-31_00.00.00.000'))).jobs);
  assert.ok(ki.length===87&&ki.every(s=>s.log==='Main'),'log inferred from files');
  const mo=await K.kiFind(vfs(path.join(root,'Continuous Logs','key images','2026-09')),R('2026-09-21_00.00.00.000','2026-09-21_23.59.59.000'));
  assert.strictEqual(mo.jobs.length,206,'month folder with samples directly in it');
  const dd=await K.kiFind(vfs(path.join(root,'Main Logs','key images','2026-10','07')),R('2026-10-07_00.00.00.000','2026-10-07_23.59.59.000'));
  assert.strictEqual(dd.jobs.length,43,'day folder');
  const miss=await K.kiFind(vfs(path.join(root,'Main Logs')),R('2026-10-07_00.00.00.000','2026-10-07_23.59.59.000'));
  assert.ok(miss.jobs.length===43&&miss.notes.length===0);
  console.log('ok',{lastDay:dayS.length,samples:all.length,byType:by,noHeader:all.filter(s=>!s.hdr).map(s=>s.id),foldersListedForOneDay:oneDay});
})().catch(e=>{console.error(e);process.exit(1);});
