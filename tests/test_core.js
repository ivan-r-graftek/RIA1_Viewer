// node tests/test_core.js  -- checks the three input paths give consistent results on the fixture.
const assert=require('assert');const fs=require('fs');const path=require('path');
const {parseCSV,analyze,fromFiles,csvKind,fromFolder,tms}=require('../src/js/core.js');
const o={waitThr:10,burstGap:60,cadenceMin:20,ceiling:50};
const raw=parseCSV(fs.readFileSync(path.join(__dirname,'fixtures','KeyImageFiles_sample.csv'),'utf8'));
assert.strictEqual(csvKind(raw.header),'raw');
const A=analyze(fromFiles(raw.rows,'raw'),o);
// folder mode: only Modified times, as the browser sees them
const ent=raw.rows.filter(r=>r.Kind==='File').map(r=>({folder:r.Folder,name:r.Name,lm:tms(r.Modified)}));
const B=analyze(fromFolder(ent),o);
assert.strictEqual(A.K.samples,B.K.samples,'sample count');
assert.strictEqual(A.K.inc,B.K.inc,'incomplete count');
assert.strictEqual(A.K.waits,B.K.waits,'wait count');
assert.ok(Math.abs(A.K.waitS-B.K.waitS)<30,'wait seconds close');
assert.ok(A.S.every(s=>s.fl&&s.fl.rdByRIA===true),'ready.txt written by RIA in CSV mode');
assert.ok(B.S.every(s=>s.approx&&s.moveS==null),'folder mode flags approximation');
console.log('ok',{samples:A.K.samples,inc:A.K.inc,waits:A.K.waits,waitS_csv:A.K.waitS.toFixed(1),waitS_folder:B.K.waitS.toFixed(1)});
