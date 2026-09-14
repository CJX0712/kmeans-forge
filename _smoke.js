// 无头自检：提取 index.html 中 <script id="engine"> 并在 Node vm 中运行 8 项硬不变量
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) { console.error('FAIL: cannot find engine script'); process.exit(1); }
const ctx = { Math, console, Float64Array, Array, Set, Infinity, NaN, isFinite, isNaN };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(m[1], ctx);
const F = ctx.Forge;

let pass = 0, total = 8;
function rel(a, b) { return Math.abs(a - b) / (Math.abs(b) || 1); }
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name + ' — ' + detail); }
  else { console.log('  ❌ ' + name + ' — ' + detail); }
}

// 1. SSE 单调不增
try {
  const { X } = F.makeBlobs(240, 4, 2, 6, 11);
  const init = F.kmeansppInit(X, 4, F.mulberry32(99));
  const res = F.lloyd(X, 4, init, 80);
  let mono = true, bad = -1;
  for (let i = 1; i < res.sseHist.length; i++) if (res.sseHist[i] > res.sseHist[i - 1] * (1 + 1e-9)) { mono = false; bad = i; break; }
  check('① SSE 单调不增', mono, mono ? '全部迭代 SSE 非增' : '第' + (bad + 1) + '次上升');
} catch (e) { check('① SSE 单调不增', false, e.message); }

// 2. 1D 精确下界匹配
try {
  const { X } = F.makeBlobs(180, 3, 1, 2.0, 5);
  const flat = X.map(p => p[0]);
  const init = F.kmeansppInit(X, 3, F.mulberry32(5));
  const res = F.lloyd(X, 3, init, 200);
  const dpOpt = F.oneDimOptimal(flat, 3);
  const ok = rel(res.inertia, dpOpt) < 1e-6;
  check('② 1D 精确下界(DP)', ok, ok ? ('KMeans=' + res.inertia.toFixed(4) + ' = DP=' + dpOpt.toFixed(4)) : ('差 ' + rel(res.inertia, dpOpt).toExponential(2)));
} catch (e) { check('② 1D 精确下界', false, e.message); }

// 3. 标签恢复 >=0.95
try {
  let worst = 1;
  for (let s = 0; s < 6; s++) {
    const { X, labels } = F.makeBlobs(300, 4, 2, 7, s + 1);
    const init = F.kmeansppInit(X, 4, F.mulberry32(s + 200));
    const res = F.lloyd(X, 4, init, 100);
    worst = Math.min(worst, F.bestPermAcc(labels, res.assign, 4));
  }
  check('③ 标签恢复率≥95%', worst >= 0.95, '最差精度 ' + (worst * 100).toFixed(1) + '%');
} catch (e) { check('③ 标签恢复率', false, e.message); }

// 4. kmeans++ 互异质心
try {
  const { X } = F.makeBlobs(200, 5, 2, 5, 3);
  const cents = F.kmeansppInit(X, 5, F.mulberry32(3));
  const set = new Set(cents.map(c => c.map(v => v.toFixed(6)).join(',')));
  check('④ k-means++ 互异质心', set.size === 5 && cents.length === 5, set.size + '/5 互异');
} catch (e) { check('④ k-means++ 互异', false, e.message); }

// 5. 收敛不动点
try {
  const { X } = F.makeBlobs(200, 3, 2, 6, 8);
  const init = F.kmeansppInit(X, 3, F.mulberry32(8));
  const res = F.lloyd(X, 3, init, 120);
  let changed = 0;
  for (let i = 0; i < X.length; i++) {
    let best = 0, bd = Infinity;
    for (let c = 0; c < 3; c++) { const dd = F.sqDist(X[i], res.centroids[c]); if (dd < bd) { bd = dd; best = c; } }
    if (best !== res.assign[i]) changed++;
  }
  check('⑤ 收敛不动点', changed === 0, '终态重分配变化 ' + changed);
} catch (e) { check('⑤ 收敛不动点', false, e.message); }

// 6. 质心 == 均值参照
try {
  const { X } = F.makeBlobs(150, 4, 2, 5, 4);
  const idx = []; for (let i = 0; i < X.length; i++) idx.push(i);
  const mm = F.meanOf(X, idx);
  let ref = [0, 0];
  for (const i of idx) for (let j = 0; j < 2; j++) ref[j] += X[i][j];
  for (let j = 0; j < 2; j++) ref[j] /= idx.length;
  check('⑥ 质心=均值参照', Math.abs(mm[0] - ref[0]) < 1e-12 && Math.abs(mm[1] - ref[1]) < 1e-12, '解析均值一致');
} catch (e) { check('⑥ 质心=均值', false, e.message); }

// 7. 缩放等变
try {
  const { X } = F.makeBlobs(220, 4, 2, 6, 21);
  const c = 3.7;
  const cX = X.map(p => p.map(v => v * c));
  const r1 = F.lloyd(X, 4, F.kmeansppInit(X, 4, F.mulberry32(21)), 100);
  const r2 = F.lloyd(cX, 4, F.kmeansppInit(cX, 4, F.mulberry32(21)), 100);
  const acc = F.bestPermAcc(r1.assign, r2.assign, 4);
  check('⑦ 缩放等变', acc >= 0.999, '匹配 ' + (acc * 100).toFixed(1) + '%');
} catch (e) { check('⑦ 缩放等变', false, e.message); }

// 8. SSE 有限非负 + 分配合法
try {
  const { X } = F.makeBlobs(200, 3, 2, 5, 9, 0.3);
  const res = F.lloyd(X, 3, F.kmeansppInit(X, 3, F.mulberry32(9)), 100);
  let valid = true;
  for (const a of res.assign) if (a < 0 || a >= 3 || a !== (a | 0)) valid = false;
  check('⑧ SSE有限+分配合法', isFinite(res.inertia) && res.inertia >= 0 && valid, 'SSE=' + res.inertia.toFixed(2));
} catch (e) { check('⑧ SSE有限', false, e.message); }

console.log('\n=== ' + pass + '/' + total + ' 通过 ===');
process.exit(pass === total ? 0 : 1);
