/* Forge — offline workout + body-comp log. All data lives in localStorage on this device. */
'use strict';
const KEY = 'forge.v1'; // storage key: never change (keeps existing data)
const APP_VERSION = 'v4 (2026-11-21)';
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const $ = (s, el = document) => el.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseIso = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate()+n); return iso(d); };
const today = () => iso(new Date());
const fmtDate = s => { const d = parseIso(s); return `${WD[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}`; };
const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const e1rm = (w, r) => (w && r) ? w * (1 + Math.min(r, 12) / 30) : 0; // Epley, reps capped at 12
const fmtTime = s => `${Math.floor(s/60)}:${pad(Math.max(0, s%60))}`;

/* ---------- Exercise library with back-friendly alternates ---------- */
const LIB = [
  ['Chest', ['Barbell bench press','DB bench press','Machine chest press','Incline DB press','Incline barbell press','Incline machine press','Dips','Push-ups','Cable fly','Pec deck']],
  ['Shoulders', ['Standing overhead press','Seated overhead press','Seated DB press','Machine shoulder press','Landmine press','Cable lateral raise','DB lateral raise','Machine lateral raise','Rear-delt fly','Face pull','Reverse pec deck']],
  ['Triceps', ['Cable pushdown','Overhead triceps extension','EZ-bar skull crusher','Close-grip pressdown','Close-grip bench press']],
  ['Back', ['Lat pulldown','Neutral-grip pulldown','Pull-up','Weighted pull-up','Assisted pull-up','Chest-supported row','Chest-supported T-bar row','Seated cable row','One-arm DB row','Machine row','Straight-arm pulldown']],
  ['Biceps', ['EZ-bar curl','DB curl','Incline DB curl','Preacher curl','Hammer curl','Cable curl']],
  ['Quads', ['Safety-bar squat','Back squat','Hack squat','Leg press','Belt squat','Goblet squat','Bulgarian split squat','Reverse lunge','Walking lunge','Leg extension']],
  ['Hinge / glutes', ['Romanian deadlift','Trap-bar RDL','Trap-bar deadlift','Hip thrust','Glute bridge','45° back extension','Reverse hyper','Cable pull-through']],
  ['Hamstrings', ['Seated leg curl','Lying leg curl','Nordic curl (assisted)']],
  ['Calves', ['Standing calf raise','Seated calf raise','Leg-press calf raise']],
  ['Core / carry', ['Pallof press','Dead bug','Side plank','Farmer carry','Suitcase carry','Cable crunch']],
];
// Hand-picked swaps (lower spinal load first where it matters)
const ALTS = {
  'Barbell bench press':['DB bench press','Machine chest press','Incline DB press'],
  'DB bench press':['Barbell bench press','Machine chest press'],
  'Standing overhead press':['Seated overhead press','Seated DB press','Machine shoulder press','Landmine press'],
  'Seated overhead press':['Seated DB press','Machine shoulder press','Landmine press'],
  'Incline DB press':['Incline machine press','Incline barbell press','DB bench press'],
  'Incline machine press':['Incline DB press','Incline barbell press'],
  'Dips':['DB bench press','Machine chest press','Close-grip bench press'],
  'Cable lateral raise':['DB lateral raise','Machine lateral raise'],
  'DB lateral raise':['Cable lateral raise','Machine lateral raise'],
  'Cable pushdown':['Close-grip pressdown','Overhead triceps extension','EZ-bar skull crusher'],
  'Overhead triceps extension':['Cable pushdown','EZ-bar skull crusher'],
  'Lat pulldown':['Neutral-grip pulldown','Assisted pull-up','Pull-up'],
  'Weighted pull-up':['Pull-up','Lat pulldown','Assisted pull-up'],
  'Chest-supported row':['Chest-supported T-bar row','Machine row','Seated cable row','One-arm DB row'],
  'One-arm DB row':['Seated cable row','Machine row','Chest-supported row'],
  'Seated cable row':['Machine row','Chest-supported row','One-arm DB row'],
  'Face pull':['Rear-delt fly','Reverse pec deck'],
  'Rear-delt fly':['Face pull','Reverse pec deck'],
  'EZ-bar curl':['DB curl','Cable curl','Preacher curl'],
  'Incline DB curl':['Preacher curl','DB curl','Cable curl'],
  'Hammer curl':['Cable curl','DB curl'],
  'Safety-bar squat':['Hack squat','Leg press','Belt squat','Goblet squat'],
  'Back squat':['Safety-bar squat','Hack squat','Leg press','Belt squat'],
  'Romanian deadlift':['Trap-bar RDL','Hip thrust','Cable pull-through','45° back extension'],
  'Trap-bar deadlift':['Hip thrust','Belt squat','Trap-bar RDL','Glute bridge'],
  'Leg press':['Hack squat','Reverse lunge','Walking lunge','Goblet squat'],
  'Bulgarian split squat':['Reverse lunge','Leg press','Goblet squat'],
  'Seated leg curl':['Lying leg curl'],
  'Lying leg curl':['Seated leg curl'],
  '45° back extension':['Reverse hyper','Glute bridge','Cable pull-through'],
  'Standing calf raise':['Leg-press calf raise','Seated calf raise'],
  'Seated calf raise':['Standing calf raise','Leg-press calf raise'],
  'Pallof press':['Dead bug','Side plank'],
  'Farmer carry':['Suitcase carry','Dead bug'],
  'Push-ups':['DB bench press','Machine chest press'],
  'Cable fly':['Pec deck','Incline DB press'],
  'Neutral-grip pulldown':['Lat pulldown','Assisted pull-up'],
};
const groupOf = name => (LIB.find(([, l]) => l.includes(name)) || ['Custom'])[0];
const altsFor = name => {
  const a = ALTS[name] || [];
  const g = LIB.find(([, l]) => l.includes(name));
  const same = g ? g[1].filter(x => x !== name && !a.includes(x)) : [];
  return [...a, ...same];
};

/* ---------- State ---------- */
function blank() {
  return { version: 1, created: new Date().toISOString(),
    settings: { theme: 'dark', blockStart: today(), blockWeeks: 4, deloadWeek: 4, defaultRest: 120, unit: 'lb' },
    targets: { kcal: 0, protein: 0, fat: 0, carbs: 0, steps: 0, notes: '' },
    program: { days: [] }, overrides: {}, sessions: [], body: [], daily: {}, customLib: [], food: { entries: [], foods: [] } };
}
let S = load();
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { console.error(e); }
  return blank();
}
function migrate(d) { const b = blank(); const m = Object.assign(b, d, { settings: Object.assign(b.settings, d.settings || {}), targets: Object.assign(b.targets, d.targets || {}) });
  m.food = Object.assign({ entries: [], foods: [] }, d.food || {}); return m; }
function save() {
  S.updated = new Date().toISOString();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Save failed: storage full?'); }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

function normEx(x) {
  return { id: x.id || uid(), name: x.name || 'Exercise', sets: +x.sets || 3, repMin: +x.repMin || 8, repMax: +x.repMax || +x.repMin || 12,
    rir: x.rir ?? '2', rest: +x.rest || S.settings.defaultRest, inc: x.inc === 0 ? 0 : (+x.inc || 5), notes: x.notes || '' };
}
function applyStarter(plan) {
  S.program = { name: plan.name || 'Program', days: plan.program.days.map(d => ({ id: uid(), name: d.name, weekday: d.weekday ?? null, notes: d.notes || '', exercises: d.exercises.map(normEx) })) };
  if (plan.settings) Object.assign(S.settings, plan.settings);
  if (plan.targets) Object.assign(S.targets, plan.targets);
  if (plan.body) mergeBody(plan.body);
  save();
}
function mergeBody(list) {
  for (const b of list) {
    const ex = S.body.find(x => x.date === b.date && x.source === b.source);
    if (!ex) S.body.push(Object.assign({ id: uid() }, b));
  }
  S.body.sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------- Schedule helpers ---------- */
const dayById = id => S.program.days.find(d => d.id === id);
function planFor(date) {
  const o = S.overrides[date];
  if (o && o.type === 'rest') return { type: 'rest', override: true };
  let day = null;
  if (o && o.dayId) day = dayById(o.dayId);
  if (!day) day = S.program.days.find(d => d.weekday === parseIso(date).getDay());
  if (!day) return { type: 'rest', override: !!o };
  const exercises = (o && o.exercises) ? o.exercises : day.exercises;
  return { type: 'train', day, exercises, override: !!o, oneOff: !!(o && o.exercises) };
}
function blockInfo(date) {
  const st = S.settings.blockStart; if (!st) return null;
  const diff = Math.floor((parseIso(date) - parseIso(st)) / 864e5);
  if (diff < 0) return { week: 0, before: true };
  const len = S.settings.blockWeeks || 4;
  const week = Math.floor(diff / 7) % len + 1, block = Math.floor(diff / 7 / len) + 1;
  return { week, block, deload: week === (S.settings.deloadWeek || len) };
}
function sessionFor(date) { return S.sessions.find(s => s.date === date); }
function ensureSession(date, plan) {
  let s = sessionFor(date);
  if (!s) { s = { id: uid(), date, dayId: plan.day.id, dayName: plan.day.name, entries: [], notes: '' }; S.sessions.push(s); S.sessions.sort((a,b)=>a.date.localeCompare(b.date)); }
  return s;
}
function entryFor(s, ex) {
  let e = s.entries.find(e => e.exId === ex.id) || s.entries.find(e => e.name === ex.name && !e.exId);
  if (!e) { e = { exId: ex.id, name: ex.name, sets: [] }; s.entries.push(e); }
  return e;
}
function lastPerformance(name, beforeDate) {
  for (let i = S.sessions.length - 1; i >= 0; i--) {
    const s = S.sessions[i]; if (s.date >= beforeDate) continue;
    const e = s.entries.find(e => e.name === name && e.sets.some(x => x.done));
    if (e) return { date: s.date, sets: e.sets.filter(x => x.done) };
  }
  return null;
}
function suggestion(ex, date) {
  const last = lastPerformance(ex.name, date);
  const bi = blockInfo(date);
  if (!last) return { text: 'No history yet — pick a weight that lands in range at the RIR target.', w: null, r: ex.repMin };
  const ws = last.sets.map(x => x.w || 0), top = Math.max(...ws);
  const topSets = last.sets.filter(x => (x.w || 0) === top);
  const allTop = last.sets.length > 0 && last.sets.every(x => (x.r || 0) >= ex.repMax);
  let w = top, r, why;
  if (allTop && ex.inc) { w = top + ex.inc; r = ex.repMin; why = `hit ${ex.repMax} on every set → add ${ex.inc}`; }
  else { const minR = Math.min(...topSets.map(x => x.r || 0)); r = Math.min(ex.repMax, minR + 1); why = 'add a rep before adding load'; }
  if (bi && bi.deload) { w = Math.round(top * 0.9 / 2.5) * 2.5; r = ex.repMin; why = 'deload: ~90% load, half the sets, RIR 4'; }
  const lastTxt = last.sets.map(x => `${x.w ?? '–'}×${x.r ?? '–'}`).join(', ');
  return { text: `Last ${fmtDate(last.date)}: ${lastTxt}. Next: ${w || 'BW'} × ${r} (${why}).`, w, r, last };
}
const setsForToday = (ex, date) => { const bi = blockInfo(date); return bi && bi.deload ? Math.max(1, Math.ceil(ex.sets / 2)) : ex.sets; };

/* ---------- UI plumbing ---------- */
let tab = 'today', curDate = today();
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 2200); }
function openSheet(html, onMount) { $('#sheet').innerHTML = html; $('#modal').classList.remove('hidden'); onMount && onMount($('#sheet')); }
function closeSheet() { stopScanner(); $('#modal').classList.add('hidden'); $('#sheet').innerHTML = ''; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeSheet(); });
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; if (tab === 'today') curDate = today(); render(); window.scrollTo(0, 0); }));
function applyTheme() { document.documentElement.dataset.theme = S.settings.theme || 'dark'; }

function render() {
  applyTheme();
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const v = $('#view');
  if (!S.program.days.length && !['more','body','history','food'].includes(tab)) { v.innerHTML = welcome(); bindWelcome(); $('#subtitle').textContent = 'Set up'; return; }
  ({ today: renderToday, program: renderProgram, body: renderBody, history: renderHistory, more: renderMore, food: renderFood })[tab](v);
}

/* ---------- Welcome ---------- */
function welcome() {
  return `<div class="card"><h2>Welcome to Forge</h2>
  <p class="muted">Your log lives on this phone only (no account, no tracking). Start from the Block 1 plan, then change anything.</p>
  <div class="row"><button class="primary grow" id="wStarter">Load starter plan</button></div>
  <div class="row" style="margin-top:8px"><button class="grow" id="wPaste">Paste setup code or backup</button></div>
  <div class="row" style="margin-top:8px"><button class="ghost grow" id="wBlank">Start blank</button></div></div>`;
}
function bindWelcome() {
  $('#wStarter').onclick = loadStarter;
  $('#wPaste').onclick = pasteImport;
  $('#wBlank').onclick = () => { S.program.days.push({ id: uid(), name: 'Day 1', weekday: 1, notes: '', exercises: [] }); save(); tab = 'program'; render(); };
}
async function loadStarter() {
  try { const r = await fetch('starter-plan.json', { cache: 'no-cache' }); applyStarter(await r.json()); toast('Starter plan loaded'); tab = 'today'; render(); }
  catch (e) { toast('Could not load starter plan (offline on first run?)'); }
}

/* ---------- Today ---------- */
function renderToday(v) {
  const date = curDate, plan = planFor(date), bi = blockInfo(date);
  $('#subtitle').textContent = `${fmtDate(date)}${bi && !bi.before ? ` · Block ${bi.block} · Wk ${bi.week}${bi.deload ? ' (deload)' : ''}` : ''}`;
  let h = `<div class="row" style="margin-bottom:10px">
    <button class="icon" id="prevD" aria-label="previous day">‹</button>
    <button class="grow" id="todayD">${date === today() ? 'Today' : fmtDate(date)}</button>
    <button class="icon" id="nextD" aria-label="next day">›</button></div>`;
  if (bi && bi.deload) h += `<div class="card banner"><b>Deload week.</b> <span class="muted">Half the sets, ~90% load or RIR 4. No heavy carries. Walks stay.</span></div>`;
  const s = sessionFor(date);
  if (plan.type === 'rest') {
    h += `<div class="card"><h2>Rest day</h2><p class="muted">Steps, easy walk, mobility.${plan.override ? ' (Changed for this date.)' : ''}</p>
      <div class="row"><button class="grow" id="swapSess">Train anyway…</button>${plan.override ? '<button class="ghost" id="clearOv">Undo change</button>' : ''}</div></div>`;
  } else {
    const d = plan.day;
    h += `<div class="card"><div class="spread"><div><h2 style="margin:0">${esc(d.name)}</h2>
      <div class="muted">${esc(d.notes || '')}${plan.override ? ' · changed for this date' : ''}${plan.oneOff ? ' · one-off edits' : ''}</div></div></div>
      <div class="row" style="margin-top:10px"><button class="grow" id="swapSess">Swap session</button><button class="grow" id="skipSess">Skip / rest</button>
      ${plan.override ? '<button class="ghost" id="clearOv">Undo</button>' : ''}</div></div>`;
    plan.exercises.forEach((ex, i) => { h += exerciseCard(ex, i, date, s); });
    h += `<div class="row"><button class="grow" id="addToday">+ Add exercise (today only)</button></div>`;
    h += `<div class="card" style="margin-top:12px"><label>Session notes</label><textarea id="sNotes" style="min-height:70px;font-family:inherit;font-size:16px" placeholder="How it felt, pain, sleep…">${esc(s ? s.notes : '')}</textarea></div>`;
    h += `<div class="card" id="finishCard">${finishCardInner(date)}</div>`;
  }
  h += dailyCard(date);
  v.innerHTML = h;
  $('#prevD').onclick = () => { curDate = addDays(curDate, -1); render(); };
  $('#nextD').onclick = () => { curDate = addDays(curDate, 1); render(); };
  $('#todayD').onclick = () => { curDate = today(); render(); };
  $('#swapSess') && ($('#swapSess').onclick = () => swapSession(date));
  $('#skipSess') && ($('#skipSess').onclick = () => { S.overrides[date] = { type: 'rest' }; save(); render(); toast('Marked as rest for this date'); });
  $('#clearOv') && ($('#clearOv').onclick = () => { delete S.overrides[date]; save(); render(); });
  $('#addToday') && ($('#addToday').onclick = () => pickExercise(name => { const ov = oneOff(date); ov.exercises.push(normEx({ name, sets: 3, repMin: 8, repMax: 12, rir: '2' })); save(); render(); }));
  $('#sNotes') && ($('#sNotes').onchange = e => { const p = planFor(date); const ss = ensureSession(date, p); ss.notes = e.target.value; save(); });
  bindExerciseCards(v, date);
  bindDaily(date);
  bindFinish(date);
}
const doneCount = s => s ? s.entries.reduce((a, e) => a + e.sets.filter(t => t.done).length, 0) : 0;
function finishCardInner(date) {
  const s = sessionFor(date), n = doneCount(s);
  if (s && s.completedAt) return `<h3>Session complete ✓</h3><div class="muted small">${n} sets saved on this phone · finished ${new Date(s.completedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
    <div class="row" style="margin-top:10px"><button class="primary grow" id="sendLog">Send log to Forge</button></div>
    <div class="row" style="margin-top:8px"><button class="ghost grow" id="reopenS">Reopen session</button></div>`;
  return `<div class="muted small">${n} set${n === 1 ? '' : 's'} marked done. Tap Done on each set as you go, then finish.</div>
    <div class="row" style="margin-top:10px"><button class="primary grow" id="finishS">Finish session</button></div>`;
}
function refreshFinish(date) { const c = $('#finishCard'); if (c) { c.innerHTML = finishCardInner(date); bindFinish(date); } }
function bindFinish(date) {
  const f = $('#finishS'), r = $('#reopenS'), sl = $('#sendLog');
  if (f) f.onclick = () => {
    const plan = planFor(date); if (plan.type !== 'train') return;
    // Save any typed-but-unchecked sets if the user wants them counted
    const pending = [...document.querySelectorAll('.set:not(.logged)')].filter(row => $('.r', row).value.trim() !== '' && $('.w', row).value.trim() !== '');
    const s = ensureSession(date, plan);
    if (pending.length && confirm(`Also log the ${pending.length} set${pending.length === 1 ? '' : 's'} not marked Done, as shown on screen?`)) {
      pending.forEach(row => { const ex = plan.exercises[+row.dataset.ex], k = +row.dataset.k, e = entryFor(s, ex);
        while (e.sets.length <= k) e.sets.push({ w: null, r: null, rir: null, done: false });
        Object.assign(e.sets[k], { w: num($('.w', row).value), r: num($('.r', row).value), rir: num($('.q', row).value), done: true, t: new Date().toISOString() }); });
    }
    if (!doneCount(s)) { toast('No sets marked Done yet'); save(); return; }
    const notes = $('#sNotes'); if (notes) s.notes = notes.value;
    s.completedAt = new Date().toISOString(); save();
    clearInterval(tInt); $('#timer').classList.add('hidden'); document.body.classList.remove('timing');
    render(); toast('Session saved'); setTimeout(() => { const c = $('#finishCard'); c && c.scrollIntoView({ block: 'center' }); }, 50);
  };
  if (r) r.onclick = () => { const s = sessionFor(date); if (s) { delete s.completedAt; save(); } render(); };
  if (sl) sl.onclick = sendLog;
}
async function shareOrCopy(text, title) {
  if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  copyText(text, 'Copied — paste it to Forge');
}
function sendLog() { shareOrCopy(summary(), 'Forge log'); }
function oneOff(date) {
  const p = planFor(date);
  const o = S.overrides[date] || { dayId: p.day.id };
  if (!o.exercises) o.exercises = p.exercises.map(x => Object.assign({}, x));
  S.overrides[date] = o; return o;
}
function exerciseCard(ex, i, date, s) {
  const sug = suggestion(ex, date);
  const e = s ? (s.entries.find(e => e.exId === ex.id) || s.entries.find(e => e.name === ex.name)) : null;
  const n = Math.max(setsForToday(ex, date), e ? e.sets.length : 0);
  let rows = '';
  for (let k = 0; k < n; k++) {
    const st = e && e.sets[k];
    const pw = st ? st.w : (sug.w ?? '');
    const pr = st ? st.r : (sug.r ?? '');
    rows += `<div class="set ${st && st.done ? 'logged' : ''}" data-ex="${i}" data-k="${k}">
      <div class="n">${k + 1}</div>
      <input inputmode="decimal" class="w" value="${pw ?? ''}" placeholder="lb" aria-label="weight">
      <input inputmode="numeric" class="r" value="${pr ?? ''}" placeholder="reps" aria-label="reps">
      <input inputmode="decimal" class="q" value="${st && st.rir != null ? st.rir : ''}" placeholder="RIR" aria-label="RIR">
      <button class="chk" aria-label="mark set done">${st && st.done ? '✓' : 'Done'}</button></div>`;
  }
  return `<div class="card" data-card="${i}"><div class="ex-head"><div class="grow">
      <h3>${esc(ex.name)}</h3>
      <div class="ex-meta">${setsForToday(ex, date)}×${ex.repMin}${ex.repMax !== ex.repMin ? '–' + ex.repMax : ''} · RIR ${esc(ex.rir)} · rest ${fmtTime(ex.rest)}${ex.notes ? ' · ' + esc(ex.notes) : ''}</div>
      <div class="suggest">${esc(sug.text)}</div></div>
      <button class="icon" data-act="menu" data-ex="${i}" aria-label="exercise options">⋯</button></div>
    <div class="sethdr"><div>#</div><div>lb</div><div>reps</div><div>RIR</div><div></div></div>
    ${rows}
    <div class="row" style="margin-top:8px"><button class="ghost small" data-act="addset" data-ex="${i}">+ set</button>
      <button class="ghost small" data-act="timer" data-ex="${i}">⏱ ${fmtTime(ex.rest)}</button></div></div>`;
}
function bindExerciseCards(v, date) {
  const plan = planFor(date); if (plan.type !== 'train') return;
  v.querySelectorAll('.set').forEach(row => {
    const ex = plan.exercises[+row.dataset.ex], k = +row.dataset.k;
    const persist = (markDone) => {
      const s = ensureSession(date, plan), e = entryFor(s, ex);
      while (e.sets.length <= k) e.sets.push({ w: null, r: null, rir: null, done: false });
      const st = e.sets[k];
      st.w = num($('.w', row).value); st.r = num($('.r', row).value); st.rir = num($('.q', row).value);
      if (markDone !== undefined) { st.done = markDone; st.t = new Date().toISOString(); }
      save(); return st;
    };
    $('.chk', row).onclick = () => {
      const was = row.classList.contains('logged');
      const st = persist(!was);
      row.classList.toggle('logged', st.done); $('.chk', row).textContent = st.done ? '✓' : 'Done';
      refreshFinish(date);
      if (st.done) { startTimer(ex.rest); if (navigator.vibrate) navigator.vibrate(30); }
    };
    row.querySelectorAll('input').forEach(inp => inp.onchange = () => persist());
  });
  v.querySelectorAll('[data-act]').forEach(b => {
    const ex = plan.exercises[+b.dataset.ex];
    if (b.dataset.act === 'timer') b.onclick = () => startTimer(ex.rest);
    if (b.dataset.act === 'addset') b.onclick = () => {
      const s = ensureSession(date, plan), e = entryFor(s, ex);
      const n = Math.max(setsForToday(ex, date), e.sets.length);
      while (e.sets.length < n + 1) e.sets.push({ w: null, r: null, rir: null, done: false });
      const prev = e.sets[n - 1]; if (prev) { e.sets[n].w = prev.w; e.sets[n].r = prev.r; }
      save(); render();
    };
    if (b.dataset.act === 'menu') b.onclick = () => exerciseMenu(date, +b.dataset.ex);
  });
}
function exerciseMenu(date, i) {
  const plan = planFor(date), ex = plan.exercises[i];
  const alts = altsFor(ex.name).slice(0, 8);
  openSheet(`<h2>${esc(ex.name)}</h2>
    <label>Quick swap</label><div class="lib-alt">${alts.map(a => `<button data-alt="${esc(a)}">${esc(a)}</button>`).join('')}<button data-alt="__pick">Other…</button></div>
    <label>Apply swap / edits to</label>
    <div class="seg" id="scope"><button data-s="today" class="on">Today only</button><button data-s="tpl">Template (every week)</button></div>
    <div class="grid3" style="margin-top:8px">
      <div><label>Sets</label><input id="mSets" inputmode="numeric" value="${ex.sets}"></div>
      <div><label>Reps min</label><input id="mMin" inputmode="numeric" value="${ex.repMin}"></div>
      <div><label>Reps max</label><input id="mMax" inputmode="numeric" value="${ex.repMax}"></div>
      <div><label>RIR</label><input id="mRir" value="${esc(ex.rir)}"></div>
      <div><label>Rest (sec)</label><input id="mRest" inputmode="numeric" value="${ex.rest}"></div>
      <div><label>+ lb step</label><input id="mInc" inputmode="decimal" value="${ex.inc}"></div></div>
    <label>Notes</label><input id="mNotes" value="${esc(ex.notes)}">
    <div class="row" style="margin-top:12px"><button class="primary grow" id="mSave">Save</button></div>
    <div class="row" style="margin-top:8px"><button class="grow" id="mUp">Move up</button><button class="grow" id="mDown">Move down</button><button class="grow danger" id="mDel">Remove</button></div>
    <div class="row" style="margin-top:8px"><button class="ghost grow" id="mClose">Close</button></div>`, sh => {
    let scope = 'today';
    sh.querySelectorAll('#scope button').forEach(b => b.onclick = () => { scope = b.dataset.s; sh.querySelectorAll('#scope button').forEach(x => x.classList.toggle('on', x === b)); });
    const target = () => {
      if (scope === 'tpl') { const d = plan.day; return { list: d.exercises, idx: d.exercises.findIndex(x => x.id === ex.id) }; }
      const o = oneOff(date); return { list: o.exercises, idx: o.exercises.findIndex(x => x.id === ex.id) };
    };
    const withT = fn => { const t = target(); if (t.idx < 0) { toast('Not in template (one-off item) — use Today only'); return; } fn(t); save(); closeSheet(); render(); };
    const doSwap = name => withT(t => { t.list[t.idx] = Object.assign({}, t.list[t.idx], { name, id: scope === 'tpl' ? t.list[t.idx].id : uid() }); toast(`Swapped to ${name}${scope === 'tpl' ? ' (template)' : ' (today)'}`); });
    sh.querySelectorAll('[data-alt]').forEach(b => b.onclick = () => b.dataset.alt === '__pick' ? pickExercise(doSwap) : doSwap(b.dataset.alt));
    $('#mSave', sh).onclick = () => withT(t => { Object.assign(t.list[t.idx], {
      sets: +$('#mSets', sh).value || ex.sets, repMin: +$('#mMin', sh).value || ex.repMin, repMax: +$('#mMax', sh).value || ex.repMax,
      rir: $('#mRir', sh).value, rest: +$('#mRest', sh).value || ex.rest, inc: num($('#mInc', sh).value) ?? ex.inc, notes: $('#mNotes', sh).value }); toast('Saved'); });
    const move = dir => withT(t => { const j = t.idx + dir; if (j < 0 || j >= t.list.length) return; [t.list[t.idx], t.list[j]] = [t.list[j], t.list[t.idx]]; });
    $('#mUp', sh).onclick = () => move(-1); $('#mDown', sh).onclick = () => move(1);
    $('#mDel', sh).onclick = () => withT(t => { t.list.splice(t.idx, 1); toast('Removed'); });
    $('#mClose', sh).onclick = closeSheet;
  });
}
function swapSession(date) {
  const days = S.program.days;
  openSheet(`<h2>Session for ${fmtDate(date)}</h2><p class="muted">Changes this date only. The template stays the same.</p>
    ${days.map(d => `<div class="list-item"><div class="grow"><b>${esc(d.name)}</b><div class="muted small">${d.weekday != null ? WD[d.weekday] : 'Unscheduled'} · ${d.exercises.length} exercises</div></div><button data-d="${d.id}">Do this</button></div>`).join('')}
    <div class="row" style="margin-top:10px"><button class="grow" id="ssRest">Make it a rest day</button><button class="ghost grow" id="ssClose">Close</button></div>`, sh => {
    sh.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { S.overrides[date] = { dayId: b.dataset.d }; save(); closeSheet(); render(); });
    $('#ssRest', sh).onclick = () => { S.overrides[date] = { type: 'rest' }; save(); closeSheet(); render(); };
    $('#ssClose', sh).onclick = closeSheet;
  });
}
function pickExercise(cb) {
  const all = [...LIB.map(([g, l]) => [g, l]), ['Custom', S.customLib]];
  openSheet(`<h2>Pick exercise</h2><input id="pkQ" placeholder="Search or type a new name">
    <div id="pkList" style="margin-top:8px"></div>
    <div class="row" style="margin-top:8px"><button class="ghost grow" id="pkClose">Close</button></div>`, sh => {
    const draw = () => {
      const q = $('#pkQ', sh).value.trim().toLowerCase();
      let h = '';
      if (q && !all.some(([, l]) => l.some(n => n.toLowerCase() === q))) h += `<div class="list-item"><div class="grow">Add “${esc($('#pkQ', sh).value.trim())}”</div><button data-new="1">Add</button></div>`;
      for (const [g, l] of all) {
        const f = l.filter(n => !q || n.toLowerCase().includes(q)); if (!f.length) continue;
        h += `<div class="muted small" style="margin-top:10px">${esc(g)}</div>` + f.map(n => `<div class="list-item"><div class="grow">${esc(n)}</div><button data-n="${esc(n)}">Pick</button></div>`).join('');
      }
      $('#pkList', sh).innerHTML = h;
      sh.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { closeSheet(); cb(b.dataset.n); });
      const nb = sh.querySelector('[data-new]'); if (nb) nb.onclick = () => { const n = $('#pkQ', sh).value.trim(); if (!S.customLib.includes(n)) S.customLib.push(n); save(); closeSheet(); cb(n); };
    };
    $('#pkQ', sh).oninput = draw; $('#pkClose', sh).onclick = closeSheet; draw();
  });
}
function dailyCard(date) {
  const d = S.daily[date] || {}, t = S.targets;
  return `<div class="card"><h3>Daily numbers</h3>
    <div class="muted small">Targets: ${t.kcal || '–'} kcal · ${t.protein || '–'} g protein · ${t.steps || '–'} steps</div>
    ${(() => { const ft = foodTotals(date); return ft.n ? `<div class="small" style="margin-top:4px">Food tab so far: <b>${r0(ft.kcal)} kcal · ${r0(ft.p)} g protein</b></div>` : ''; })()}
    <div class="grid3"><div><label>Steps</label><input id="dSteps" inputmode="numeric" value="${d.steps ?? ''}"></div>
    <div><label>Protein g</label><input id="dProt" inputmode="numeric" value="${d.protein ?? ''}"></div>
    <div><label>kcal</label><input id="dKcal" inputmode="numeric" value="${d.kcal ?? ''}"></div></div>
    <div class="grid2"><div><label>Weight (lb)</label><input id="dW" inputmode="decimal" value="${bodyOn(date)?.weight ?? ''}"></div>
    <div><label>Zone 2 min</label><input id="dZ2" inputmode="numeric" value="${d.z2 ?? ''}"></div></div></div>`;
}
const bodyOn = date => S.body.find(b => b.date === date && b.weight != null);
function bindDaily(date) {
  const upd = (k, el) => { el.onchange = () => { S.daily[date] = S.daily[date] || {}; S.daily[date][k] = num(el.value); save(); toast('Saved'); }; };
  upd('steps', $('#dSteps')); upd('protein', $('#dProt')); upd('kcal', $('#dKcal')); upd('z2', $('#dZ2'));
  $('#dW').onchange = e => { const w = num(e.target.value); let b = S.body.find(b => b.date === date && b.source !== 'hume'); if (!b) { b = { id: uid(), date, source: 'scale' }; S.body.push(b); } b.weight = w; S.body.sort((a,b)=>a.date.localeCompare(b.date)); save(); toast('Weight saved'); };
}

/* ---------- Program editor ---------- */
function renderProgram(v) {
  $('#subtitle').textContent = S.program.name || 'Program';
  const days = [...S.program.days].sort((a, b) => ((a.weekday ?? 9) + 6) % 7 - ((b.weekday ?? 9) + 6) % 7);
  let h = `<div class="card"><div class="muted small">Edits here change the template (every week). For a one-off, use ⋯ on the Today screen.</div>
    <label>Program name</label><input id="pName" value="${esc(S.program.name || '')}"></div>`;
  for (const d of days) {
    h += `<div class="card" data-day="${d.id}"><div class="spread"><input class="dName grow" value="${esc(d.name)}" aria-label="day name" style="font-weight:700">
      <select class="dWd" style="width:120px">${['Unscheduled', ...[1,2,3,4,5,6,0].map(n => WD[n])].map((l, i) => { const val = i === 0 ? '' : [1,2,3,4,5,6,0][i-1]; return `<option value="${val}" ${String(d.weekday ?? '') === String(val) ? 'selected' : ''}>${l}</option>`; }).join('')}</select></div>
      <input class="dNotes" value="${esc(d.notes || '')}" placeholder="Focus / notes" style="margin-top:6px">
      ${d.exercises.map((x, i) => `<div class="list-item"><div class="grow"><b>${esc(x.name)}</b><div class="muted small">${x.sets}×${x.repMin}–${x.repMax} · RIR ${esc(x.rir)} · ${fmtTime(x.rest)}</div></div>
        <button class="icon" data-a="up" data-i="${i}" aria-label="move up">↑</button><button class="icon" data-a="down" data-i="${i}" aria-label="move down">↓</button><button class="icon" data-a="edit" data-i="${i}" aria-label="edit">✎</button></div>`).join('')}
      <div class="row" style="margin-top:8px"><button class="grow" data-a="add">+ Exercise</button><button data-a="dup">Duplicate</button><button class="danger" data-a="del">Delete day</button></div></div>`;
  }
  h += `<div class="row"><button class="primary grow" id="addDay">+ Add day</button></div>
    <p class="muted small">Two days on the same weekday: the first one listed is used. Move a day by changing its weekday.</p>`;
  v.innerHTML = h;
  $('#pName').onchange = e => { S.program.name = e.target.value; save(); };
  $('#addDay').onclick = () => { S.program.days.push({ id: uid(), name: 'New day', weekday: null, notes: '', exercises: [] }); save(); render(); };
  v.querySelectorAll('[data-day]').forEach(card => {
    const d = dayById(card.dataset.day);
    $('.dName', card).onchange = e => { d.name = e.target.value; save(); };
    $('.dNotes', card).onchange = e => { d.notes = e.target.value; save(); };
    $('.dWd', card).onchange = e => { d.weekday = e.target.value === '' ? null : +e.target.value; save(); render(); toast('Day moved'); };
    card.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const i = +b.dataset.i, a = b.dataset.a;
      if (a === 'up' && i > 0) [d.exercises[i-1], d.exercises[i]] = [d.exercises[i], d.exercises[i-1]];
      if (a === 'down' && i < d.exercises.length - 1) [d.exercises[i+1], d.exercises[i]] = [d.exercises[i], d.exercises[i+1]];
      if (a === 'edit') return editTemplateExercise(d, i);
      if (a === 'add') return pickExercise(name => { d.exercises.push(normEx({ name, sets: 3, repMin: 8, repMax: 12, rir: '2' })); save(); render(); });
      if (a === 'dup') S.program.days.push({ ...JSON.parse(JSON.stringify(d)), id: uid(), name: d.name + ' (copy)', weekday: null, exercises: d.exercises.map(x => ({ ...x, id: uid() })) });
      if (a === 'del') { if (!confirm(`Delete ${d.name}? Logged history stays.`)) return; S.program.days = S.program.days.filter(x => x !== d); }
      save(); render();
    });
  });
}
function editTemplateExercise(d, i) {
  const ex = d.exercises[i];
  const alts = altsFor(ex.name).slice(0, 8);
  openSheet(`<h2>Edit · ${esc(d.name)}</h2>
    <label>Exercise</label><div class="row"><input id="eName" class="grow" value="${esc(ex.name)}"><button id="ePick">Library</button></div>
    <div class="lib-alt">${alts.map(a => `<button data-alt="${esc(a)}">${esc(a)}</button>`).join('')}</div>
    <div class="grid3" style="margin-top:8px">
      <div><label>Sets</label><input id="eSets" inputmode="numeric" value="${ex.sets}"></div>
      <div><label>Reps min</label><input id="eMin" inputmode="numeric" value="${ex.repMin}"></div>
      <div><label>Reps max</label><input id="eMax" inputmode="numeric" value="${ex.repMax}"></div>
      <div><label>RIR</label><input id="eRir" value="${esc(ex.rir)}"></div>
      <div><label>Rest (sec)</label><input id="eRest" inputmode="numeric" value="${ex.rest}"></div>
      <div><label>+ lb step</label><input id="eInc" inputmode="decimal" value="${ex.inc}"></div></div>
    <label>Notes</label><input id="eNotes" value="${esc(ex.notes)}">
    <div class="row" style="margin-top:12px"><button class="primary grow" id="eSave">Save</button><button class="danger" id="eDel">Remove</button></div>
    <div class="row" style="margin-top:8px"><button class="ghost grow" id="eClose">Cancel</button></div>`, sh => {
    sh.querySelectorAll('[data-alt]').forEach(b => b.onclick = () => { $('#eName', sh).value = b.dataset.alt; });
    $('#ePick', sh).onclick = () => { const keep = collect(); pickExercise(n => { keep.name = n; Object.assign(ex, keep); save(); editTemplateExercise(d, i); }); };
    function collect() { return { name: $('#eName', sh).value.trim() || ex.name, sets: +$('#eSets', sh).value || ex.sets, repMin: +$('#eMin', sh).value || ex.repMin, repMax: +$('#eMax', sh).value || ex.repMax, rir: $('#eRir', sh).value, rest: +$('#eRest', sh).value || ex.rest, inc: num($('#eInc', sh).value) ?? ex.inc, notes: $('#eNotes', sh).value }; }
    $('#eSave', sh).onclick = () => { Object.assign(ex, collect()); save(); closeSheet(); render(); toast('Saved'); };
    $('#eDel', sh).onclick = () => { d.exercises.splice(i, 1); save(); closeSheet(); render(); };
    $('#eClose', sh).onclick = closeSheet;
  });
}

/* ---------- Body ---------- */
let liftSel = '';
function renderBody(v) {
  $('#subtitle').textContent = 'Body log';
  const ws = S.body.filter(b => b.weight != null);
  const last = ws[ws.length - 1];
  const avg = avg7(today());
  const scans = S.body.filter(b => b.bf != null);
  const lastScan = scans[scans.length - 1];
  let h = `<div class="card"><div class="kv">
    <div>Latest weight</div><div>${last ? `${last.weight} lb (${fmtDate(last.date)})` : '–'}</div>
    <div>7-day average</div><div>${avg ? avg.toFixed(1) + ' lb' : '–'}</div>
    <div>Latest scan</div><div>${lastScan ? `${lastScan.bf}% BF · lean ${lastScan.lean ?? '–'} · fat ${lastScan.fat ?? '–'} (${fmtDate(lastScan.date)})` : '–'}</div>
    ${S.targets.goalWeight ? `<div>Goal</div><div>${S.targets.goalWeight} lb${avg ? ` · ${(avg - S.targets.goalWeight).toFixed(1)} to go` : ''}</div>` : ''}
  </div></div>
  <div class="card"><h3>Add entry</h3>
    <div class="grid2"><div><label>Date</label><input type="date" id="bDate" value="${today()}"></div><div><label>Weight lb</label><input id="bW" inputmode="decimal"></div>
    <div><label>Waist in (navel)</label><input id="bWaist" inputmode="decimal"></div><div><label>Body fat %</label><input id="bBf" inputmode="decimal"></div>
    <div><label>Lean lb (scan)</label><input id="bLean" inputmode="decimal"></div><div><label>Fat lb (scan)</label><input id="bFat" inputmode="decimal"></div></div>
    <label>Note</label><input id="bNote" placeholder="e.g. Hume, after bathroom, before food">
    <div class="row" style="margin-top:10px"><button class="primary grow" id="bAdd">Save entry</button></div></div>
  <div class="card"><h3>Bodyweight · 7-day average</h3><canvas class="chart" id="cW"></canvas></div>
  <div class="card"><h3>Body fat %</h3><canvas class="chart" id="cBf"></canvas></div>
  <div class="card"><h3>Lean mass (scan)</h3><canvas class="chart" id="cLean"></canvas></div>
  <div class="card"><h3>Estimated 1RM</h3><select id="liftSel">${liftNames().map(n => `<option ${n === liftSel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><canvas class="chart" id="c1rm"></canvas></div>
  <div class="card"><h3>Entries</h3>${[...S.body].reverse().slice(0, 60).map(b => `<div class="list-item"><div class="grow"><b>${fmtDate(b.date)}</b> <span class="muted small">${b.date.slice(0,4)}</span>
     <div class="muted small">${[b.weight != null && b.weight + ' lb', b.waist != null && b.waist + ' in', b.bf != null && b.bf + '% BF', b.lean != null && 'lean ' + b.lean, b.fat != null && 'fat ' + b.fat, b.note].filter(Boolean).map(esc).join(' · ')}</div></div>
     <button class="icon danger" data-del="${b.id}" aria-label="delete">✕</button></div>`).join('') || '<div class="muted">No entries yet.</div>'}</div>`;
  v.innerHTML = h;
  $('#bAdd').onclick = () => {
    const b = { id: uid(), date: $('#bDate').value || today(), weight: num($('#bW').value), waist: num($('#bWaist').value), bf: num($('#bBf').value), lean: num($('#bLean').value), fat: num($('#bFat').value), note: $('#bNote').value.trim(), source: num($('#bBf').value) != null ? 'hume' : 'scale' };
    if ([b.weight, b.waist, b.bf, b.lean, b.fat].every(x => x == null)) return toast('Enter at least one number');
    S.body.push(b); S.body.sort((a, b) => a.date.localeCompare(b.date)); save(); render(); toast('Saved');
  };
  v.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (!confirm('Delete this entry?')) return; S.body = S.body.filter(x => x.id !== b.dataset.del); save(); render(); });
  $('#liftSel').onchange = e => { liftSel = e.target.value; draw1rm(); };
  const days = [...new Set(ws.map(b => b.date))];
  const wPts = days.map(d => ({ x: d, y: dayWeight(d) }));
  const aPts = days.map(d => ({ x: d, y: avg7(d) }));
  chart($('#cW'), [{ pts: wPts, color: '#6b7686', dots: true, thin: true }, { pts: aPts, color: '#ff7a1a' }], S.targets.goalWeight);
  chart($('#cBf'), [{ pts: scans.map(b => ({ x: b.date, y: b.bf })), color: '#ff7a1a', dots: true }], 12);
  chart($('#cLean'), [{ pts: S.body.filter(b => b.lean != null).map(b => ({ x: b.date, y: b.lean })), color: '#36c275', dots: true }]);
  draw1rm();
}
function dayWeight(d) { const l = S.body.filter(b => b.date === d && b.weight != null); return l.length ? l.reduce((s, b) => s + b.weight, 0) / l.length : null; }
function avg7(d) { const v = []; for (let i = 0; i < 7; i++) { const w = dayWeight(addDays(d, -i)); if (w != null) v.push(w); } return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }
function liftNames() { const s = new Set(); S.sessions.forEach(x => x.entries.forEach(e => e.sets.some(t => t.done && t.w) && s.add(e.name))); const l = [...s].sort(); if (!l.includes(liftSel)) liftSel = l[0] || ''; return l; }
function draw1rm() {
  const c = $('#c1rm'); if (!c) return;
  const pts = S.sessions.map(s => { const e = s.entries.find(e => e.name === liftSel); if (!e) return null; const best = Math.max(0, ...e.sets.filter(t => t.done).map(t => e1rm(t.w, t.r))); return best ? { x: s.date, y: Math.round(best) } : null; }).filter(Boolean);
  chart(c, [{ pts, color: '#5aa9ff', dots: true }]);
}
function chart(canvas, series, ref) {
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth || 320, H = canvas.clientHeight || 190;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
  const css = getComputedStyle(document.documentElement);
  const muted = css.getPropertyValue('--muted').trim() || '#999', line = css.getPropertyValue('--line').trim() || '#333';
  const all = series.flatMap(s => s.pts.filter(p => p.y != null));
  g.font = '12px -apple-system, sans-serif'; g.fillStyle = muted;
  if (all.length < 1) { g.fillText('Not enough data yet', 10, H / 2); return; }
  const xs = all.map(p => parseIso(p.x).getTime());
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 864e5 * 3; x1 += 864e5 * 3; }
  const ysAll = all.map(p => p.y).concat(ref != null ? [ref] : []);
  let y0 = Math.min(...ysAll), y1 = Math.max(...ysAll); const padY = (y1 - y0) * 0.12 || 1; y0 -= padY; y1 += padY;
  const L = 40, R = 10, T = 10, B = 22;
  const X = t => L + (t - x0) / (x1 - x0) * (W - L - R), Y = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  g.strokeStyle = line; g.lineWidth = 1;
  for (let i = 0; i <= 3; i++) { const yv = y0 + (y1 - y0) * i / 3, yy = Y(yv); g.beginPath(); g.moveTo(L, yy); g.lineTo(W - R, yy); g.stroke(); g.fillText(yv.toFixed(yv < 50 ? 1 : 0), 2, yy + 4); }
  const fd = t => { const d = new Date(t); return `${d.getMonth()+1}/${d.getDate()}`; };
  g.fillText(fd(x0), L, H - 6); const lbl = fd(x1); g.fillText(lbl, W - R - g.measureText(lbl).width, H - 6);
  if (ref != null && ref >= y0 && ref <= y1) { g.setLineDash([4, 4]); g.strokeStyle = '#36c275'; g.beginPath(); g.moveTo(L, Y(ref)); g.lineTo(W - R, Y(ref)); g.stroke(); g.setLineDash([]); g.fillStyle = '#36c275'; g.fillText('goal ' + ref, W - R - 60, Y(ref) - 4); }
  for (const s of series) {
    const p = s.pts.filter(p => p.y != null); if (!p.length) continue;
    g.strokeStyle = s.color; g.fillStyle = s.color; g.lineWidth = s.thin ? 1 : 2.5;
    g.beginPath(); p.forEach((q, i) => { const xx = X(parseIso(q.x).getTime()), yy = Y(q.y); i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }); g.stroke();
    if (s.dots) p.forEach(q => { g.beginPath(); g.arc(X(parseIso(q.x).getTime()), Y(q.y), 3, 0, 7); g.fill(); });
  }
}

/* ---------- History ---------- */
function renderHistory(v) {
  $('#subtitle').textContent = `${S.sessions.filter(s => s.entries.some(e => e.sets.some(t => t.done))).length} sessions`;
  const list = [...S.sessions].filter(s => s.completedAt || s.entries.some(e => e.sets.some(t => t.done))).reverse();
  v.innerHTML = `<div class="row" style="margin-bottom:12px"><button class="primary grow" id="hSend">Send last 7 days to Forge</button></div>` + list.map(s => {
    const done = s.entries.map(e => ({ name: e.name, sets: e.sets.filter(t => t.done) })).filter(e => e.sets.length);
    const vol = done.reduce((a, e) => a + e.sets.reduce((b, t) => b + (t.w || 0) * (t.r || 0), 0), 0);
    return `<div class="card"><div class="spread"><div><h3>${fmtDate(s.date)} · ${esc(s.dayName)}</h3><div class="muted small">${s.completedAt ? '✓ complete · ' : ''}${s.date} · ${done.reduce((a, e) => a + e.sets.length, 0)} sets · ${Math.round(vol).toLocaleString()} lb volume</div></div>
      <button data-open="${s.date}">Open</button></div>
      <details><summary class="muted small">Details</summary>${done.map(e => `<div class="small" style="margin:4px 0"><b>${esc(e.name)}</b>: ${e.sets.map(t => `${t.w ?? 'BW'}×${t.r ?? '–'}${t.rir != null ? ' @' + t.rir : ''}`).join(', ')}</div>`).join('')}
      ${s.notes ? `<div class="muted small">Notes: ${esc(s.notes)}</div>` : ''}
      <button class="ghost danger small" data-delS="${s.id}">Delete session</button></details></div>`;
  }).join('') || '<div class="card muted">No sessions logged yet. Log a set on the Today tab.</div>';
  $('#hSend').onclick = sendLog;
  v.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { curDate = b.dataset.open; tab = 'today'; render(); });
  v.querySelectorAll('[data-dels]').forEach(b => b.onclick = () => { if (!confirm('Delete this session?')) return; S.sessions = S.sessions.filter(s => s.id !== b.dataset.dels); save(); render(); });
}

/* ---------- More: targets, settings, backup ---------- */
function renderMore(v) {
  $('#subtitle').textContent = 'Targets · settings · backup';
  const t = S.targets, st = S.settings;
  v.innerHTML = `<div class="card"><h3>Nutrition &amp; daily targets</h3>
    <div class="grid2"><div><label>Calories</label><input id="tK" inputmode="numeric" value="${t.kcal || ''}"></div><div><label>Protein g</label><input id="tP" inputmode="numeric" value="${t.protein || ''}"></div>
    <div><label>Fat g</label><input id="tF" inputmode="numeric" value="${t.fat || ''}"></div><div><label>Carbs g</label><input id="tC" inputmode="numeric" value="${t.carbs || ''}"></div>
    <div><label>Steps</label><input id="tS" inputmode="numeric" value="${t.steps || ''}"></div><div><label>Goal weight lb</label><input id="tG" inputmode="decimal" value="${t.goalWeight || ''}"></div></div>
    <div class="muted small" id="macroChk"></div>
    <label>Plan notes</label><textarea id="tN" style="font-family:inherit;font-size:15px">${esc(t.notes || '')}</textarea>
    <div class="row" style="margin-top:8px"><button class="primary grow" id="tSave">Save targets</button></div></div>
  <div class="card"><h3>Block &amp; timer</h3>
    <div class="grid2"><div><label>Block start (Mon)</label><input type="date" id="sBS" value="${st.blockStart || ''}"></div><div><label>Weeks per block</label><input id="sBW" inputmode="numeric" value="${st.blockWeeks}"></div>
    <div><label>Deload week #</label><input id="sDW" inputmode="numeric" value="${st.deloadWeek}"></div><div><label>Default rest (sec)</label><input id="sRest" inputmode="numeric" value="${st.defaultRest}"></div></div>
    <label>Theme</label><select id="sTheme">${['dark','light','auto'].map(x => `<option ${st.theme === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <div class="row" style="margin-top:8px"><button class="grow" id="sSave">Save settings</button></div></div>
  <div class="card"><h3>Send to Forge</h3><p class="muted small">Your log lives only on this phone. These open the share sheet (Messages, Mail, etc.) or copy to the clipboard.</p>
    <div class="row"><button class="primary grow" id="sendSum">Send last 7 days</button></div>
    <div class="row" style="margin-top:8px"><button class="grow" id="sendAll">Send full backup</button><button class="grow" id="copySum">Copy summary</button></div></div>
  <div class="card"><h3>Backup</h3><p class="muted small">Data lives only on this device. Export a backup weekly. Last saved ${S.updated ? new Date(S.updated).toLocaleString() : '–'}.</p>
    <div class="row"><button class="grow" id="expJ">Export JSON</button><button class="grow" id="copyJ">Copy JSON</button></div>
    <div class="row" style="margin-top:8px"><button class="grow" id="expC">Export CSV (sets)</button><button class="grow" id="expB">CSV (body)</button></div>
    <div class="row" style="margin-top:8px"><button class="grow" id="expF">CSV (food)</button></div>
    <div class="row" style="margin-top:8px"><button class="grow" id="impF">Import file</button><button class="grow" id="impP">Paste import</button></div>
    <input type="file" id="impFile" accept="application/json,.json" class="hidden"></div>
  <div class="card"><h3>Plan</h3><div class="row"><button class="grow" id="reStarter">Reload starter plan</button><button class="grow danger" id="wipe">Erase all data</button></div>
    <p class="muted small">Reloading the starter replaces the program and targets only; history and body log stay.</p></div>
  <details class="card" id="diag"><summary class="muted small">Diagnostics (for troubleshooting)</summary><pre id="diagTxt" style="white-space:pre-wrap;font-size:12px;margin:8px 0">${esc(diagText())}</pre>
    <button class="grow" id="diagCopy" style="width:100%">Copy diagnostics</button></details>
  <p class="muted small" style="text-align:center">Forge ${APP_VERSION} · offline · no account · no tracking</p>`;
  const mc = () => { const k = (+$('#tP').value || 0) * 4 + (+$('#tF').value || 0) * 9 + (+$('#tC').value || 0) * 4; $('#macroChk').textContent = `Macros add up to ${k} kcal.`; };
  ['#tP','#tF','#tC'].forEach(s => $(s).oninput = mc); mc();
  $('#tSave').onclick = () => { Object.assign(S.targets, { kcal: num($('#tK').value), protein: num($('#tP').value), fat: num($('#tF').value), carbs: num($('#tC').value), steps: num($('#tS').value), goalWeight: num($('#tG').value), notes: $('#tN').value }); save(); toast('Targets saved'); };
  $('#sSave').onclick = () => { Object.assign(S.settings, { blockStart: $('#sBS').value, blockWeeks: +$('#sBW').value || 4, deloadWeek: +$('#sDW').value || 4, defaultRest: +$('#sRest').value || 120, theme: $('#sTheme').value }); save(); render(); toast('Settings saved'); };
  $('#copySum').onclick = () => copyText(summary(), 'Summary copied');
  $('#sendSum').onclick = sendLog;
  $('#sendAll').onclick = () => download(`forge-backup-${today()}.json`, JSON.stringify(S, null, 1), 'application/json');
  $('#expJ').onclick = () => download(`forge-backup-${today()}.json`, JSON.stringify(S, null, 1), 'application/json');
  $('#copyJ').onclick = () => copyText(JSON.stringify(S), 'Backup JSON copied');
  $('#expC').onclick = () => download(`forge-sets-${today()}.csv`, setsCsv(), 'text/csv');
  $('#expB').onclick = () => download(`forge-body-${today()}.csv`, bodyCsv(), 'text/csv');
  $('#expF').onclick = () => download(`forge-food-${today()}.csv`, foodCsv(), 'text/csv');
  $('#impF').onclick = () => $('#impFile').click();
  $('#impFile').onchange = async e => { const f = e.target.files[0]; if (f) importText(await f.text()); };
  $('#impP').onclick = pasteImport;
  $('#diagCopy').onclick = () => copyText(diagText(), 'Diagnostics copied');
  $('#reStarter').onclick = () => { if (confirm('Replace the program and targets with the starter plan? History stays.')) loadStarter(); };
  $('#wipe').onclick = () => { if (confirm('Erase ALL Forge data on this device? Export a backup first.') && confirm('Really erase everything?')) { localStorage.removeItem(KEY); S = blank(); render(); } };
}
function pasteImport() {
  openSheet(`<h2>Paste import</h2><p class="muted small">Paste a Forge backup (JSON) or a setup code from Forge.</p><textarea id="pTxt" placeholder="{ … } or setup code"></textarea>
    <div class="row" style="margin-top:10px"><button class="primary grow" id="pGo">Import</button><button class="ghost" id="pX">Cancel</button></div>`, sh => {
    $('#pGo', sh).onclick = () => { if (importText($('#pTxt', sh).value)) closeSheet(); };
    $('#pX', sh).onclick = closeSheet;
  });
}
function decodeCode(txt) {
  txt = txt.trim(); if (txt.startsWith('{')) return JSON.parse(txt);
  const b = txt.replace(/^.*#import=/, '').replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(escape(atob(b))));
}
function importText(txt) {
  let d; try { d = decodeCode(txt); } catch (e) { toast('That is not valid Forge data'); return false; }
  if (d.kind === 'forge-starter' || d.kind === 'forge-seed') {
    if (d.program) applyStarter(d); else { if (d.targets) Object.assign(S.targets, d.targets); if (d.settings) Object.assign(S.settings, d.settings); if (d.body) mergeBody(d.body); save(); }
    toast('Setup imported'); tab = 'today'; render(); return true;
  }
  if (d.version && d.program && d.sessions) {
    if (!confirm('Replace everything on this device with this backup?')) return false;
    S = migrate(d); save(); toast('Backup restored'); render(); return true;
  }
  toast('Unrecognized file'); return false;
}
function download(name, text, type) {
  const blob = new Blob([text], { type });
  if (navigator.canShare && navigator.share) {
    try { const f = new File([blob], name, { type }); if (navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: name }).catch(() => {}); return; } } catch (e) {}
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function copyText(t, msg) {
  try { await navigator.clipboard.writeText(t); toast(msg); }
  catch (e) { openSheet(`<h2>Copy</h2><textarea id="cpT">${esc(t)}</textarea><div class="row" style="margin-top:8px"><button class="ghost grow" id="cpX">Close</button></div>`, sh => { $('#cpT', sh).select(); $('#cpX', sh).onclick = closeSheet; }); }
}
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function setsCsv() {
  const rows = [['date','session','exercise','set','weight_lb','reps','rir','e1rm']];
  S.sessions.forEach(s => s.entries.forEach(e => e.sets.forEach((t, i) => t.done && rows.push([s.date, s.dayName, e.name, i + 1, t.w, t.r, t.rir, Math.round(e1rm(t.w, t.r)) || '']))));
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}
function bodyCsv() {
  const rows = [['date','weight_lb','waist_in','bf_pct','lean_lb','fat_lb','note','steps','protein_g','kcal','zone2_min']];
  const dates = [...new Set([...S.body.map(b => b.date), ...Object.keys(S.daily)])].sort();
  dates.forEach(d => { const bs = S.body.filter(b => b.date === d); const dl = S.daily[d] || {};
    (bs.length ? bs : [{}]).forEach(b => rows.push([d, b.weight, b.waist, b.bf, b.lean, b.fat, b.note, dl.steps, dl.protein, dl.kcal, dl.z2])); });
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}
function summary() {
  const end = today(), start = addDays(end, -6);
  const ss = S.sessions.filter(s => s.date >= start && s.date <= end);
  const lines = [`Forge summary ${fmtDate(start)}–${fmtDate(end)}`];
  const a = avg7(end), a0 = avg7(addDays(end, -7));
  lines.push(`Weight 7-day avg: ${a ? a.toFixed(1) : '–'} lb${a && a0 ? ` (prev week ${a0.toFixed(1)}, ${(a - a0 >= 0 ? '+' : '') + (a - a0).toFixed(1)})` : ''}`);
  const sc = S.body.filter(b => b.bf != null && b.date >= start); sc.forEach(b => lines.push(`Scan ${b.date}: ${b.bf}% BF, lean ${b.lean ?? '–'}, fat ${b.fat ?? '–'}${b.weight ? ', ' + b.weight + ' lb' : ''}`));
  const wa = S.body.filter(b => b.waist != null && b.date >= start); if (wa.length) lines.push(`Waist: ${wa.map(b => b.waist + ' in (' + b.date.slice(5) + ')').join(', ')}`);
  const dl = Object.entries(S.daily).filter(([d]) => d >= start && d <= end).map(([, v]) => v);
  const av = k => { const v = dl.map(x => x[k]).filter(x => x != null); return v.length ? Math.round(v.reduce((p, q) => p + q, 0) / v.length) : null; };
  lines.push(`Avg steps ${av('steps') ?? '–'} · protein ${av('protein') ?? '–'} g · kcal ${av('kcal') ?? '–'} · Zone 2 total ${dl.reduce((p, x) => p + (x.z2 || 0), 0)} min`);
  const T = fTargets(), fd = [];
  for (let d = start; d <= end; d = addDays(d, 1)) { const x = foodTotals(d); if (x.n) fd.push(`${fmtDate(d)} ${r0(x.kcal)} kcal ${r0(x.p)}P ${r0(x.f)}F ${r0(x.c)}C`); }
  lines.push(fd.length ? `Food (targets ${T.kcal || '–'} kcal ${T.p || '–'}P ${T.f || '–'}F ${T.c || '–'}C):` : 'Food: nothing logged in the Food tab');
  fd.forEach(x => lines.push(`- ${x}`));
  const td = foodOn(end); if (td.length) lines.push(`Today's foods: ${td.map(e => `${e.name} ${r0(e.kcal)}`).join('; ')}`);
  lines.push(`Sessions: ${ss.filter(s => s.entries.some(e => e.sets.some(t => t.done))).length}`);
  ss.forEach(s => { const parts = s.entries.map(e => { const d = e.sets.filter(t => t.done); if (!d.length) return null; const top = d.reduce((m, t) => (t.w || 0) > (m.w || 0) ? t : m, d[0]); return `${e.name} ${d.map(t => `${t.w ?? 'BW'}×${t.r ?? '–'}${t.rir != null ? '@' + t.rir : ''}`).join(', ')}`; }).filter(Boolean);
    if (parts.length) lines.push(`- ${fmtDate(s.date)} ${s.dayName}: ${parts.join('; ')}${s.notes ? ' | ' + s.notes : ''}`); });
  return lines.join('\n');
}


/* ---------- Nutrition (Food tab) ---------- */
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
const r1 = n => Math.round((+n || 0) * 10) / 10;
const r0 = n => Math.round(+n || 0);
function defaultMeal() { const h = new Date().getHours() + new Date().getMinutes() / 60; return h < 10.5 ? 'breakfast' : h < 15 ? 'lunch' : h < 20.5 ? 'dinner' : 'snack'; }
let foodDate = today();
const foodOn = d => S.food.entries.filter(e => e.date === d);
function foodTotals(d) { return foodOn(d).reduce((a, e) => ({ kcal: a.kcal + (+e.kcal || 0), p: a.p + (+e.p || 0), f: a.f + (+e.f || 0), c: a.c + (+e.c || 0), n: a.n + 1 }), { kcal: 0, p: 0, f: 0, c: 0, n: 0 }); }
function fTargets() { const t = S.targets; return { kcal: +t.kcal || 0, p: +t.protein || 0, f: +t.fat || 0, c: +t.carbs || 0 }; }
function bar(label, val, target, unit) {
  const pct = target ? Math.min(100, val / target * 100) : 0, over = target && val > target * 1.05;
  const left = target ? target - val : null;
  return `<div style="margin:10px 0 2px"><div class="spread small"><b>${label}</b><span>${r0(val)}${target ? ' / ' + r0(target) : ''} ${unit} · <span class="${over ? 'bad' : 'muted'}">${left == null ? 'no target' : left >= 0 ? r0(left) + ' left' : r0(-left) + ' over'}</span></span></div>
    <div class="barbg"><div class="barfg${over ? ' over' : ''}" style="width:${pct}%"></div></div></div>`;
}
function renderFood(v) {
  const d = foodDate, t = foodTotals(d), T = fTargets();
  $('#subtitle').textContent = `Food · ${fmtDate(d)}`;
  const recents = recentFoods();
  let h = `<div class="row" style="margin-bottom:10px"><button class="icon" id="fPrev" aria-label="previous day">‹</button>
    <button class="grow" id="fToday">${d === today() ? 'Today' : fmtDate(d)}</button><button class="icon" id="fNext" aria-label="next day">›</button></div>
  <div class="card" id="fDash"><div class="spread"><h2 style="margin:0">${r0(t.kcal)} kcal</h2><span class="muted small">${t.n} item${t.n === 1 ? '' : 's'}</span></div>
    ${bar('Calories', t.kcal, T.kcal, 'kcal')}${bar('Protein', t.p, T.p, 'g')}${bar('Fat', t.f, T.f, 'g')}${bar('Carbs', t.c, T.c, 'g')}</div>
  <div class="grid2" style="margin-bottom:12px">
    <button class="primary bigbtn" id="fScan">▦ Scan barcode</button><button class="bigbtn" id="fQuick">＋ Quick add</button>
    <button class="bigbtn" id="fPhoto">📷 Photo meal</button><button class="bigbtn" id="fPaste">⎘ Paste estimate</button></div>
  <input type="file" id="fPhotoIn" accept="image/*" capture="environment" class="hidden">`;
  if (recents.length) h += `<div class="card"><h3>Favorites &amp; recent</h3><div class="muted small">Tap to log again (${MEAL_LABEL[defaultMeal()]}). ✎ = change amount or meal first.</div>
    ${recents.map(f => `<div class="list-item"><div class="grow"><b>${f.fav ? '★ ' : ''}${esc(f.name)}</b><div class="muted small">${esc(foodLine(f))}</div></div>
      <button class="icon" data-fedit="${f.id}" aria-label="adjust and log">✎</button><button class="primary" data-flog="${f.id}">+ Log</button></div>`).join('')}</div>`;
  for (const m of MEALS) {
    const list = foodOn(d).filter(e => e.meal === m);
    const mt = list.reduce((a, e) => a + (+e.kcal || 0), 0);
    h += `<div class="card"><div class="spread"><h3>${MEAL_LABEL[m]}</h3><span class="muted small">${r0(mt)} kcal</span></div>
      ${list.map(e => `<div class="list-item"><div class="grow"><b>${esc(e.name)}</b><div class="muted small">${r0(e.kcal)} kcal · ${r1(e.p)}P ${r1(e.f)}F ${r1(e.c)}C${e.qtyText ? ' · ' + esc(e.qtyText) : ''}</div></div>
        <button class="icon" data-eedit="${e.id}" aria-label="edit entry">✎</button><button class="icon danger" data-edel="${e.id}" aria-label="delete entry">✕</button></div>`).join('') || '<div class="muted small">Nothing logged.</div>'}
      <div class="row" style="margin-top:6px"><button class="ghost small" data-addmeal="${m}">+ Add to ${MEAL_LABEL[m]}</button></div></div>`;
  }
  h += `<div class="card"><h3>Last 7 days</h3><table class="tbl"><tr><th>Day</th><th>kcal</th><th>P</th><th>F</th><th>C</th></tr>
    ${[...Array(7)].map((_, i) => { const dd = addDays(d, -i), x = foodTotals(dd); return `<tr><td>${fmtDate(dd)}</td><td>${x.n ? r0(x.kcal) : '–'}</td><td>${x.n ? r0(x.p) : '–'}</td><td>${x.n ? r0(x.f) : '–'}</td><td>${x.n ? r0(x.c) : '–'}</td></tr>`; }).join('')}</table>
    <div class="muted small" style="margin-top:6px">Targets: ${T.kcal || '–'} kcal · ${T.p || '–'}P ${T.f || '–'}F ${T.c || '–'}C (change in More)</div></div>`;
  v.innerHTML = h;
  $('#fPrev').onclick = () => { foodDate = addDays(foodDate, -1); render(); };
  $('#fNext').onclick = () => { foodDate = addDays(foodDate, 1); render(); };
  $('#fToday').onclick = () => { foodDate = today(); render(); };
  $('#fScan').onclick = openScanner;
  $('#fQuick').onclick = () => foodEditor({ meal: defaultMeal() });
  $('#fPaste').onclick = pasteEstimate;
  $('#fPhoto').onclick = () => $('#fPhotoIn').click();
  $('#fPhotoIn').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) photoSheet(f); };
  v.querySelectorAll('[data-flog]').forEach(b => b.onclick = () => quickRelog(b.dataset.flog));
  v.querySelectorAll('[data-fedit]').forEach(b => b.onclick = () => { const f = S.food.foods.find(x => x.id === b.dataset.fedit); foodEditor({ food: f, meal: defaultMeal() }); });
  v.querySelectorAll('[data-eedit]').forEach(b => b.onclick = () => { const e = S.food.entries.find(x => x.id === b.dataset.eedit); foodEditor({ entry: e }); });
  v.querySelectorAll('[data-edel]').forEach(b => b.onclick = () => { if (!confirm('Delete this food entry?')) return; S.food.entries = S.food.entries.filter(x => x.id !== b.dataset.edel); save(); render(); toast('Deleted'); });
  v.querySelectorAll('[data-addmeal]').forEach(b => b.onclick = () => foodEditor({ meal: b.dataset.addmeal }));
}
function foodLine(f) { return `${r0(f.kcal)} kcal · ${r1(f.p)}P ${r1(f.f)}F ${r1(f.c)}C per ${f.basis === '100g' ? '100 g' : (f.servingText || 'serving')}${f.lastQty && f.lastQty !== 1 ? ` · last ${f.lastQty}${f.basis === '100g' ? ' g' : '×'}` : ''}`; }
function recentFoods() { return [...S.food.foods].sort((a, b) => (b.fav - a.fav) || ((b.lastUsed || '').localeCompare(a.lastUsed || ''))).slice(0, 12); }
function scaled(f, qty) { const k = f.basis === '100g' ? qty / 100 : qty; return { kcal: f.kcal * k, p: f.p * k, f: f.f * k, c: f.c * k }; }
function addEntry(food, qty, meal, date) {
  const s = scaled(food, qty);
  const e = { id: uid(), date: date || foodDate, meal, name: food.name, kcal: r1(s.kcal), p: r1(s.p), f: r1(s.f), c: r1(s.c), foodId: food.id, qty, qtyText: food.basis === '100g' ? `${qty} g` : `${qty} × ${food.servingText || 'serving'}`, barcode: food.barcode || null, source: food.source || 'manual', t: new Date().toISOString() };
  S.food.entries.push(e); food.lastUsed = e.t; food.lastQty = qty; return e;
}
function quickRelog(id) {
  const f = S.food.foods.find(x => x.id === id); if (!f) return;
  const e = addEntry(f, f.lastQty || (f.basis === '100g' ? 100 : 1), defaultMeal()); save(); render();
  toastUndo(`Logged ${f.name} (${r0(e.kcal)} kcal)`, () => { S.food.entries = S.food.entries.filter(x => x.id !== e.id); save(); render(); });
}
function toastUndo(msg, undo) {
  const t = $('#toast'); t.innerHTML = `${esc(msg)} <button id="undoBtn" style="min-height:32px;margin-left:8px">Undo</button>`; t.classList.remove('hidden');
  $('#undoBtn').onclick = () => { undo(); t.classList.add('hidden'); };
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 4500);
}
function upsertFood(f) {
  let ex = f.id ? S.food.foods.find(x => x.id === f.id) : null;
  if (!ex && f.barcode) ex = S.food.foods.find(x => x.barcode === f.barcode);
  if (!ex) ex = S.food.foods.find(x => x.name.toLowerCase() === f.name.toLowerCase() && !x.barcode && !f.barcode);
  if (ex) { Object.assign(ex, f, { id: ex.id, fav: f.fav ?? ex.fav }); return ex; }
  const nf = Object.assign({ fav: false }, f, { id: uid() }); S.food.foods.push(nf); return nf;
}
/* Editor: log a food (new, from library, from barcode) or edit an existing entry */
function foodEditor({ food, entry, meal, barcode, note }) {
  const isEdit = !!entry;
  const base = food || (entry && S.food.foods.find(x => x.id === entry.foodId)) || null;
  const f = Object.assign({ name: '', basis: 'serving', kcal: '', p: '', f: '', c: '', servingText: '', servingG: null, barcode: barcode || null, source: 'manual' }, base || {});
  if (isEdit && !base) Object.assign(f, { name: entry.name, basis: 'serving', kcal: entry.kcal, p: entry.p, f: entry.f, c: entry.c });
  let qty = isEdit ? (entry.qty || 1) : (f.lastQty || (f.basis === '100g' ? 100 : 1));
  if (isEdit && !base) qty = 1;
  const m0 = isEdit ? entry.meal : (meal || defaultMeal());
  openSheet(`<h2>${isEdit ? 'Edit entry' : f.barcode ? 'Log scanned food' : 'Quick add'}</h2>
    ${note ? `<div class="muted small" style="margin-bottom:6px">${esc(note)}</div>` : ''}
    ${f.barcode ? `<div class="pill">Barcode ${esc(f.barcode)}</div>` : ''}
    <label>Food name</label><input id="feName" value="${esc(f.name)}" placeholder="e.g. Greek yogurt">
    <label>Nutrition numbers are per</label><div class="seg" id="feBasis"><button data-b="serving" class="${f.basis !== '100g' ? 'on' : ''}">1 serving</button><button data-b="100g" class="${f.basis === '100g' ? 'on' : ''}">100 g</button></div>
    <div class="grid2" style="margin-top:6px"><div><label>Calories (kcal)</label><input id="feK" inputmode="decimal" value="${f.kcal ?? ''}"></div>
      <div><label>Protein g</label><input id="feP" inputmode="decimal" value="${f.p ?? ''}"></div>
      <div><label>Fat g</label><input id="feF" inputmode="decimal" value="${f.f ?? ''}"></div>
      <div><label>Carbs g</label><input id="feC" inputmode="decimal" value="${f.c ?? ''}"></div></div>
    <div class="grid2"><div><label id="feQL">${f.basis === '100g' ? 'Amount eaten (grams)' : 'Servings eaten'}</label><input id="feQ" inputmode="decimal" value="${qty}"></div>
      <div><label>Meal</label><select id="feM">${MEALS.map(m => `<option value="${m}" ${m === m0 ? 'selected' : ''}>${MEAL_LABEL[m]}</option>`).join('')}</select></div></div>
    <div class="grid2 hidden" id="feSrvRow"><div><label>Serving size (g), optional</label><input id="feSG" inputmode="decimal" value="${f.servingG ?? ''}"></div><div></div></div>
    <div class="card" style="margin-top:10px;background:var(--card2)"><b>You're logging:</b> <span id="feTot"></span></div>
    <label class="row" style="color:var(--text);font-size:15px"><input type="checkbox" id="feFav" style="width:28px;min-height:28px" ${f.fav ? 'checked' : ''}> Save as favorite</label>
    <div class="row" style="margin-top:10px"><button class="primary grow" id="feSave">${isEdit ? 'Save changes' : 'Log food'}</button></div>
    <div class="row" style="margin-top:8px">${isEdit ? '<button class="grow danger" id="feDel">Delete entry</button>' : ''}<button class="ghost grow" id="feX">Cancel</button></div>`, sh => {
    let basis = f.basis === '100g' ? '100g' : 'serving';
    const read = () => ({ name: $('#feName', sh).value.trim(), basis, kcal: num($('#feK', sh).value) || 0, p: num($('#feP', sh).value) || 0, f: num($('#feF', sh).value) || 0, c: num($('#feC', sh).value) || 0 });
    const upd = () => { const x = read(), q = num($('#feQ', sh).value) || 0, s = scaled(x, q); $('#feTot', sh).textContent = `${r0(s.kcal)} kcal · ${r1(s.p)}P ${r1(s.f)}F ${r1(s.c)}C`; };
    sh.querySelectorAll('#feBasis button').forEach(b => b.onclick = () => { basis = b.dataset.b; sh.querySelectorAll('#feBasis button').forEach(x => x.classList.toggle('on', x === b)); $('#feQL', sh).textContent = basis === '100g' ? 'Amount eaten (grams)' : 'Servings eaten'; const q = $('#feQ', sh); if (basis === '100g' && (+q.value || 0) < 5) q.value = f.servingG || 100; if (basis === 'serving' && (+q.value || 0) > 20) q.value = 1; upd(); });
    sh.querySelectorAll('input').forEach(i => i.addEventListener('input', upd)); upd();
    $('#feX', sh).onclick = closeSheet;
    if (isEdit) $('#feDel', sh).onclick = () => { S.food.entries = S.food.entries.filter(x => x.id !== entry.id); save(); closeSheet(); render(); toast('Deleted'); };
    $('#feSave', sh).onclick = () => {
      const x = read(), q = num($('#feQ', sh).value);
      if (!x.name) return toast('Add a food name');
      if (!q || q <= 0) return toast(basis === '100g' ? 'Enter grams eaten' : 'Enter servings eaten');
      if (['#feK','#feP','#feF','#feC'].every(id => $(id, sh).value.trim() === '')) return toast('Enter calories or macros (0 is fine)');
      const saved = upsertFood(Object.assign({}, x, { id: base ? base.id : undefined, barcode: f.barcode || null, source: f.source || 'manual', servingText: f.servingText || '', servingG: f.servingG || null, fav: $('#feFav', sh).checked }));
      if (isEdit) { const s = scaled(saved, q); Object.assign(entry, { name: saved.name, kcal: r1(s.kcal), p: r1(s.p), f: r1(s.f), c: r1(s.c), qty: q, qtyText: basis === '100g' ? `${q} g` : `${q} × ${saved.servingText || 'serving'}`, meal: $('#feM', sh).value, foodId: saved.id }); saved.lastQty = q; }
      else addEntry(saved, q, $('#feM', sh).value);
      save(); closeSheet(); tab = 'food'; render(); toast(isEdit ? 'Entry updated' : `Logged ${saved.name}`);
    };
  });
}
function diagText() {
  const sa = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  return [`Forge ${APP_VERSION}`, `UA: ${navigator.userAgent}`, `Standalone (home-screen): ${sa}`, `Secure context: ${window.isSecureContext}`,
    `getUserMedia: ${!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)}`, `Service worker: ${navigator.serviceWorker && navigator.serviceWorker.controller ? 'active' : 'none'}`,
    `Scanner lib: ${SCANDBG.lib}`, `Camera: ${SCANDBG.camera} ${SCANDBG.res}`, `Zoom: ${SCANDBG.zoom || '–'} · Focus: ${SCANDBG.focus || '–'}`, `Frames checked: ${SCANDBG.frames}`,
    `Last scan: ${SCANDBG.lastScan || '–'}`, `Last lookup: ${SCANDBG.lastLookup || '–'}`, `Last error: ${SCANDBG.lastErr || '–'}`].join('\n');
}
/* Barcode scanning v4: own camera pipeline (playsinline/muted video, high-res, continuous focus, zoom)
   + vendored ZXing (@zxing/library 0.23, Apache-2.0) with TRY_HARDER and retail formats. */
const SCANDBG = { camera: 'idle', res: '', zoom: '', focus: '', frames: 0, lastErr: '', lastScan: '', lastLookup: '', lib: 'not loaded' };
let cam = null;
function loadZXing() {
  if (window.ZXing && window.ZXing.MultiFormatReader) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/zxing-library.min.js';
    s.onload = () => { SCANDBG.lib = window.ZXing ? 'loaded' : 'loaded but missing'; window.ZXing ? res() : rej(new Error('scanner library missing')); };
    s.onerror = () => { SCANDBG.lib = 'FAILED to load'; rej(new Error('scanner library failed to load')); }; document.head.appendChild(s); });
}
let zxReader = null;
function zxDecoder() {
  if (zxReader) return zxReader; const Z = window.ZXing, F = Z.BarcodeFormat, hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.UPC_A, F.UPC_E, F.EAN_8, F.CODE_128]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  zxReader = new Z.MultiFormatReader(); zxReader.setHints(hints); return zxReader;
}
function decodeCanvas(cv, alt) {
  const Z = window.ZXing;
  try { const src = new Z.HTMLCanvasElementLuminanceSource(cv); const bin = alt ? new Z.GlobalHistogramBinarizer(src) : new Z.HybridBinarizer(src);
    return zxDecoder().decodeWithState(new Z.BinaryBitmap(bin)).getText(); }
  catch (e) { if (e && e.name && !/NotFound|Checksum|Format/i.test(e.name)) SCANDBG.lastErr = 'decode: ' + e.name; return null; }
}
const scanCv = document.createElement('canvas');
/* draw region (sx,sy,sw,sh) of a source into the work canvas, scaled so the long side <= maxSide; rot = rotate 90° */
function drawRegion(srcEl, sx, sy, sw, sh, maxSide, rot) {
  const k = Math.min(1, maxSide / Math.max(sw, sh)), w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
  scanCv.width = rot ? h : w; scanCv.height = rot ? w : h;
  const ctx = scanCv.getContext('2d', { willReadFrequently: true });
  ctx.save(); if (rot) { ctx.translate(h, 0); ctx.rotate(Math.PI / 2); }
  ctx.drawImage(srcEl, sx, sy, sw, sh, 0, 0, w, h); ctx.restore(); return scanCv;
}
function camError(e) {
  const n = (e && e.name) || '', m = (e && e.message) || String(e);
  if (/NotAllowed|Security|Permission/i.test(n)) return 'Camera permission is blocked. On iPhone: Settings › Safari › Camera › Allow (or Ask), then fully close and reopen Forge. Meanwhile use “Take photo of barcode”.';
  if (/NotFound|Overconstrained|DevicesNotFound/i.test(n)) return 'No usable camera was found. Use “Take photo of barcode” or type the number.';
  if (/NotReadable|TrackStart|Abort/i.test(n)) return 'The camera is busy (another app or tab is using it). Close it and try again, or use “Take photo of barcode”.';
  if (/library/i.test(m)) return 'The scanner library did not load (' + m + '). Reload Forge once while online.';
  return 'Camera error: ' + (n ? n + ' – ' : '') + m;
}
async function getCamStream() {
  const tries = [
    { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
    { audio: false, video: { facingMode: { ideal: 'environment' } } },
    { audio: false, video: true }];
  let last;
  for (const c of tries) { try { return await navigator.mediaDevices.getUserMedia(c); } catch (e) { last = e; if (/NotAllowed|Security/i.test(e.name)) throw e; } }
  throw last;
}
function stopScanner() {
  if (!cam) return; cam.stopped = true; clearTimeout(cam.timer);
  try { cam.stream && cam.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  try { if (cam.video) { cam.video.pause(); cam.video.srcObject = null; } } catch (e) {}
  cam = null; if (SCANDBG.camera !== 'error') SCANDBG.camera = 'stopped';
}
async function applyZoom(track, z) { try { await track.applyConstraints({ advanced: [{ zoom: z }] }); SCANDBG.zoom = z + '×'; return true; } catch (e) { SCANDBG.zoom = 'zoom failed: ' + e.name; return false; } }
function openScanner() {
  openSheet(`<h2>Scan barcode</h2>
    <div class="muted small">Hold the barcode flat, in good light, about 6–10 in (15–25 cm) from the phone. iPhones can't focus right up close.</div>
    <div id="reader"><div id="scanGuide"></div><div id="scanTapPlay" class="hidden">Tap to start camera</div></div>
    <div class="row" style="margin-top:6px"><button class="grow" id="scZoom" disabled>Zoom</button><button class="grow hidden" id="scTorch">Light</button></div>
    <div class="small" id="scanMsg" role="status" style="margin-top:6px">Starting camera…</div>
    <div class="row" style="margin-top:8px"><button class="primary grow" id="scPhoto">📷 Take photo of barcode</button></div>
    <input type="file" id="scPhotoIn" accept="image/*" capture="environment" class="hidden">
    <label>Or type the barcode number</label><div class="row"><input id="bcIn" class="grow" inputmode="numeric" autocomplete="off" placeholder="e.g. 049000028911"><button class="primary" id="bcGo">Look up</button></div>
    <div class="row" style="margin-top:10px"><button class="ghost grow" id="scX">Close</button></div>`, sh => {
    const msg = (t, bad) => { const m = $('#scanMsg'); if (m) { m.textContent = t; m.classList.toggle('bad', !!bad); } };
    const go = code => { code = String(code).replace(/\D/g, ''); if (code.length < 6) return toast('That barcode looks too short'); stopScanner(); closeSheet(); lookupBarcode(code); };
    $('#scX', sh).onclick = closeSheet;
    $('#bcGo', sh).onclick = () => go($('#bcIn', sh).value);
    $('#bcIn', sh).onkeydown = e => { if (e.key === 'Enter') go(e.target.value); };
    $('#scPhoto', sh).onclick = () => { stopScanner(); msg('Camera paused for photo. Take a close, sharp photo of just the barcode.'); $('#scPhotoIn', sh).click(); };
    $('#scPhotoIn', sh).onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      msg('Reading photo…');
      try { await loadZXing(); const code = await decodeImageFile(f);
        if (code) { SCANDBG.lastScan = code + ' (photo)'; if (navigator.vibrate) navigator.vibrate(60); go(code); }
        else { SCANDBG.lastErr = 'photo: no barcode found'; msg('No barcode found in that photo. Retake it closer and sharper (barcode filling most of the photo, flat, no glare), or type the number below.', true); }
      } catch (err) { SCANDBG.lastErr = 'photo: ' + (err.message || err.name); msg(camError(err), true); }
    };
    // Start the camera right away, inside the tap that opened this sheet (iOS likes getUserMedia/play tied to a gesture).
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      SCANDBG.camera = 'error'; SCANDBG.lastErr = 'no mediaDevices.getUserMedia'; msg('Live camera isn\'t available here. Use “Take photo of barcode” or type the number.', true); return;
    }
    const me = cam = { stopped: false, frames: 0, t0: Date.now() };
    SCANDBG.camera = 'requesting'; SCANDBG.frames = 0;
    const streamP = getCamStream(); const libP = loadZXing(); libP.catch(() => {});
    (async () => {
      let stream;
      try { stream = await streamP; } catch (e) { SCANDBG.camera = 'error'; SCANDBG.lastErr = 'getUserMedia: ' + (e.name || '') + ' ' + (e.message || ''); if (cam === me) msg(camError(e), true); return; }
      if (me.stopped) { stream.getTracks().forEach(t => t.stop()); return; }
      me.stream = stream;
      const v = document.createElement('video');
      v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.setAttribute('muted', ''); v.setAttribute('autoplay', '');
      v.muted = true; v.playsInline = true; v.autoplay = true; v.srcObject = stream; me.video = v;
      const rd = $('#reader'); if (!rd) return stopScanner(); rd.prepend(v);
      const tryPlay = () => v.play().then(() => $('#scanTapPlay') && $('#scanTapPlay').classList.add('hidden')).catch(err => { SCANDBG.lastErr = 'video.play: ' + err.name; $('#scanTapPlay') && $('#scanTapPlay').classList.remove('hidden'); });
      rd.onclick = tryPlay; tryPlay();
      SCANDBG.camera = 'streaming';
      const track = stream.getVideoTracks()[0];
      try {
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.focusMode && caps.focusMode.includes('continuous')) { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).then(() => SCANDBG.focus = 'continuous').catch(e => SCANDBG.focus = 'failed ' + e.name); } else SCANDBG.focus = 'n/a';
        if (caps.zoom && caps.zoom.max > 1) {
          const zs = [1, 1.5, 2, 3].filter(z => z >= (caps.zoom.min || 1) && z <= caps.zoom.max); let zi = zs.indexOf(1.5) >= 0 ? zs.indexOf(1.5) : 0;
          await applyZoom(track, zs[zi]);
          const zb = $('#scZoom'); if (zb) { zb.disabled = false; zb.textContent = `Zoom ${zs[zi]}×`; zb.onclick = async () => { zi = (zi + 1) % zs.length; await applyZoom(track, zs[zi]); zb.textContent = `Zoom ${zs[zi]}×`; }; }
        } else { SCANDBG.zoom = 'n/a'; const zb = $('#scZoom'); if (zb) zb.classList.add('hidden'); }
        if (caps.torch) { const tb = $('#scTorch'); let on = false; if (tb) { tb.classList.remove('hidden'); tb.onclick = async () => { on = !on; try { await track.applyConstraints({ advanced: [{ torch: on }] }); tb.textContent = on ? 'Light off' : 'Light'; } catch (e) {} }; } }
      } catch (e) { SCANDBG.lastErr = 'track tweaks: ' + e.name; }
      try { await libP; } catch (e) { SCANDBG.camera = 'error'; SCANDBG.lastErr = e.message; msg(camError(e), true); return; }
      msg('Scanning… line the barcode up inside the box.');
      let n = 0, lastShown = 0;
      const tick = () => {
        if (me.stopped) return;
        const vw = v.videoWidth, vh = v.videoHeight;
        if (v.readyState >= 2 && vw && vh) {
          SCANDBG.res = `${vw}×${vh}`;
          if (v.paused) tryPlay();
          // cycle: centre band at native res / whole frame / rotated band (barcode held sideways) / downscaled band (helps slight blur); alternate binarizers
          const mode = n % 4, alt = Math.floor(n / 4) % 2 === 1;
          let cv;
          if (mode === 0) { const bw = vw * 0.92, bh = Math.min(vh, vw < vh ? vh * 0.42 : vh * 0.7); cv = drawRegion(v, (vw - bw) / 2, (vh - bh) / 2, bw, bh, 1400, false); }
          else if (mode === 1) cv = drawRegion(v, 0, 0, vw, vh, 1280, false);
          else if (mode === 3) { const bw = vw * 0.92, bh = Math.min(vh, vw < vh ? vh * 0.42 : vh * 0.7); cv = drawRegion(v, (vw - bw) / 2, (vh - bh) / 2, bw, bh, 720, false); }
          else { const bh = vh * 0.92, bw = Math.min(vw, vw < vh ? vw * 0.7 : vw * 0.42); cv = drawRegion(v, (vw - bw) / 2, (vh - bh) / 2, bw, bh, 1400, true); }
          const code = decodeCanvas(cv, alt);
          n++; SCANDBG.frames = n;
          if (code) { SCANDBG.lastScan = code + ' (live)'; if (navigator.vibrate) navigator.vibrate(60); return go(code); }
          const secs = (Date.now() - me.t0) / 1000;
          if (n - lastShown >= 15) { lastShown = n; msg(`Scanning… ${SCANDBG.res}${SCANDBG.zoom && SCANDBG.zoom !== 'n/a' ? ' · zoom ' + SCANDBG.zoom : ''} · ${n} frames checked${secs > 12 ? '. Not reading? Move back a little, try Zoom, or use “Take photo of barcode”.' : ''}`); }
        } else if (Date.now() - me.t0 > 6000 && !me.warned) { me.warned = true; msg('The camera opened but no video frames are arriving. Tap the camera area, or use “Take photo of barcode”.', true); }
        me.timer = setTimeout(tick, 60);
      };
      tick();
    })();
  });
}
async function loadImage(file) {
  if (window.createImageBitmap) { try { return await createImageBitmap(file); } catch (e) {} }
  return await new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { res(im); setTimeout(() => URL.revokeObjectURL(u), 1000); }; im.onerror = () => rej(new Error('could not open that image')); im.src = u; });
}
async function decodeImageFile(file) {
  const img = await loadImage(file), W = img.width || img.naturalWidth, H = img.height || img.naturalHeight;
  const L = Math.max(W, H);
  const sizes = [1600, 1000, 2400, 700].filter((s, i) => i === 0 || s < L * 1.1);
  for (const s of sizes) for (const rot of [false, true]) for (const alt of [false, true]) {
    let c = decodeCanvas(drawRegion(img, 0, 0, W, H, s, rot), alt); if (c) return c;
    // centre band (barcode usually in the middle)
    const bw = W * 0.9, bh = H * 0.5; c = decodeCanvas(drawRegion(img, (W - bw) / 2, (H - bh) / 2, bw, bh, s, rot), alt); if (c) return c;
    await new Promise(r => setTimeout(r, 0));
  }
  return null;
}
function upcEtoA(e) {
  if (!/^[01]\d{7}$/.test(e)) return null; const ns = e[0], d = e.slice(1, 7), ck = e[7], l = d[5]; let m;
  if ('012'.includes(l)) m = d[0] + d[1] + l + '0000' + d[2] + d[3] + d[4];
  else if (l === '3') m = d[0] + d[1] + d[2] + '00000' + d[3] + d[4];
  else if (l === '4') m = d[0] + d[1] + d[2] + d[3] + '00000' + d[4];
  else m = d[0] + d[1] + d[2] + d[3] + d[4] + '0000' + l;
  return ns + m + ck;
}
function codeVariants(code) {
  const v = [code];
  if (code.length === 8) { const a = upcEtoA(code); if (a) v.push(a, '0' + a); }
  if (code.length === 12) v.push('0' + code);
  if (code.length === 13 && code[0] === '0') v.push(code.slice(1));
  if (code.length === 14 && code[0] === '0') v.push(code.slice(1));
  return [...new Set(v)];
}
function offNum(n, key, basis) { const v = n[`${key}_${basis}`]; return v == null || v === '' ? null : +v; }
async function fetchOFF(code) {
  const ctl = window.AbortController ? new AbortController() : null, to = ctl && setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`, ctl ? { signal: ctl.signal } : {});
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Open Food Facts answered ' + r.status + (r.status === 429 ? ' (too many requests, wait a minute)' : ''));
    const j = await r.json(); if (!j || j.status !== 1 || !j.product) return null;
    return j.product;
  } catch (e) { if (e.name === 'AbortError') throw new Error('lookup timed out'); if (e instanceof TypeError) throw new Error('network error (offline or blocked)'); throw e; }
  finally { to && clearTimeout(to); }
}
function foodFromOFF(code, p) {
  const n = p.nutriments || {};
  const kcalS = offNum(n, 'energy-kcal', 'serving') ?? (offNum(n, 'energy', 'serving') != null ? offNum(n, 'energy', 'serving') / 4.184 : null);
  const kcal100 = offNum(n, 'energy-kcal', '100g') ?? (offNum(n, 'energy', '100g') != null ? offNum(n, 'energy', '100g') / 4.184 : null);
  const name = [p.brands && p.brands.split(',')[0].trim(), p.product_name].filter(Boolean).join(' ').trim() || `Barcode ${code}`;
  const sq = +p.serving_quantity || null;
  if (kcalS != null) return { name, basis: 'serving', kcal: r1(kcalS), p: r1(offNum(n, 'proteins', 'serving') || 0), f: r1(offNum(n, 'fat', 'serving') || 0), c: r1(offNum(n, 'carbohydrates', 'serving') || 0), servingText: p.serving_size || 'serving', servingG: sq, barcode: code, source: 'openfoodfacts' };
  if (kcal100 != null) return { name, basis: '100g', kcal: r1(kcal100), p: r1(offNum(n, 'proteins', '100g') || 0), f: r1(offNum(n, 'fat', '100g') || 0), c: r1(offNum(n, 'carbohydrates', '100g') || 0), servingText: p.serving_size || '', servingG: sq, barcode: code, source: 'openfoodfacts', lastQty: sq || 100 };
  return { name, basis: 'serving', kcal: '', p: '', f: '', c: '', servingText: p.serving_size || '', barcode: code, source: 'openfoodfacts' };
}
async function lookupBarcode(code) {
  const vars = codeVariants(code);
  const local = S.food.foods.find(x => x.barcode && vars.includes(x.barcode));
  if (local) return foodEditor({ food: local, meal: defaultMeal(), note: 'Found in your saved foods.' });
  toast('Looking up ' + code + '…');
  let err = null;
  for (const c of vars) {
    try {
      const p = await fetchOFF(c);
      if (!p) continue;
      SCANDBG.lastLookup = `${code} → found as ${c}`;
      const f = foodFromOFF(code, p);
      return foodEditor({ food: f, meal: defaultMeal(), note: f.kcal === '' ? 'Found the product but no nutrition numbers. Enter them from the label.' : `From Open Food Facts (check against the label). Numbers are per ${f.basis === '100g' ? '100 g' : f.servingText || 'serving'}.` });
    } catch (e) { err = e; }
  }
  SCANDBG.lastLookup = `${code} (tried ${vars.join(', ')}): ${err ? 'error ' + err.message : 'not found'}`;
  if (err) { SCANDBG.lastErr = 'lookup: ' + err.message; return foodEditor({ barcode: code, meal: defaultMeal(), note: `Barcode read OK (${code}), but the lookup failed: ${err.message}. Enter the label numbers; it is saved for next time.` }); }
  foodEditor({ barcode: code, meal: defaultMeal(), note: `Barcode read OK (${code}), but it isn't in Open Food Facts. Enter the label numbers once; it is saved for next time.` });
}
/* Photo meal → share sheet to Ash; paste back a FORGE-FOOD line */
const PHOTO_PROMPT = 'Forge: estimate this meal. Reply with one line: FORGE-FOOD: name | kcal | P F C  (e.g. FORGE-FOOD: Chicken bowl | 650 kcal | 55P 20F 60C)';
function photoSheet(file) {
  const url = URL.createObjectURL(file);
  openSheet(`<h2>Photo meal</h2><img src="${url}" alt="meal photo" style="width:100%;max-height:300px;object-fit:cover;border-radius:12px">
    <p class="muted small">1) Tap Send to Ash and pick the Grok Bot chat (or Messages). 2) When Ash replies with a FORGE-FOOD line, copy it and tap Paste estimate.</p>
    <div class="row"><button class="primary grow" id="phSend">Send photo to Ash</button></div>
    <div class="row" style="margin-top:8px"><button class="grow" id="phPaste">Paste estimate</button><button class="ghost grow" id="phX">Close</button></div>`, sh => {
    const cleanup = () => URL.revokeObjectURL(url);
    $('#phX', sh).onclick = () => { cleanup(); closeSheet(); };
    $('#phPaste', sh).onclick = () => { cleanup(); pasteEstimate(); };
    $('#phSend', sh).onclick = async () => {
      const shareFile = new File([file], file.name || `meal-${today()}.jpg`, { type: file.type || 'image/jpeg' });
      try {
        if (navigator.canShare && navigator.canShare({ files: [shareFile] })) { await navigator.share({ files: [shareFile], text: PHOTO_PROMPT, title: 'Meal photo' }); toast('Sent. Paste Ash’s reply when it comes.'); return; }
        if (navigator.share) { await navigator.share({ text: PHOTO_PROMPT }); return; }
        copyText(PHOTO_PROMPT, 'Prompt copied — send the photo from Photos');
      } catch (e) { if (!(e && e.name === 'AbortError')) toast('Share failed — send the photo from the Photos app'); }
    };
  });
}
function parseForgeFood(text) {
  const out = [];
  for (const line of String(text).split(/\n+/)) {
    const m = line.match(/FORGE-FOOD:\s*([^|]+?)\s*\|\s*([\d.]+)\s*(?:kcal|cal)?\s*\|\s*([\d.]+)\s*P\s*[, ]\s*([\d.]+)\s*F\s*[, ]\s*([\d.]+)\s*C(?:\s*\|\s*(breakfast|lunch|dinner|snack))?/i);
    if (m) out.push({ name: m[1].trim(), kcal: +m[2], p: +m[3], f: +m[4], c: +m[5], meal: m[6] ? m[6].toLowerCase() : null });
  }
  return out;
}
function pasteEstimate() {
  openSheet(`<h2>Paste estimate</h2><p class="muted small">Paste the line Ash sent, e.g.<br><code>FORGE-FOOD: Chicken bowl | 650 kcal | 55P 20F 60C</code></p>
    <textarea id="peT" placeholder="FORGE-FOOD: …"></textarea>
    <div class="row" style="margin-top:6px"><button class="grow" id="peClip">Paste from clipboard</button></div>
    <div id="pePrev" class="muted small" style="margin-top:8px"></div>
    <label>Meal</label><select id="peM">${MEALS.map(m => `<option value="${m}" ${m === defaultMeal() ? 'selected' : ''}>${MEAL_LABEL[m]}</option>`).join('')}</select>
    <div class="row" style="margin-top:10px"><button class="primary grow" id="peGo" disabled>Log it</button><button class="ghost" id="peX">Cancel</button></div>`, sh => {
    const upd = () => { const items = parseForgeFood($('#peT', sh).value); $('#peGo', sh).disabled = !items.length;
      $('#pePrev', sh).innerHTML = items.length ? items.map(i => `✓ ${esc(i.name)} · ${r0(i.kcal)} kcal · ${i.p}P ${i.f}F ${i.c}C${i.meal ? ' · ' + MEAL_LABEL[i.meal] : ''}`).join('<br>') : ($('#peT', sh).value.trim() ? 'Could not read that. It must look like: FORGE-FOOD: name | 650 kcal | 55P 20F 60C' : ''); };
    $('#peT', sh).oninput = upd;
    $('#peClip', sh).onclick = async () => { try { $('#peT', sh).value = await navigator.clipboard.readText(); upd(); } catch (e) { toast('Long-press the box and tap Paste'); } };
    $('#peX', sh).onclick = closeSheet;
    $('#peGo', sh).onclick = () => {
      const items = parseForgeFood($('#peT', sh).value); if (!items.length) return;
      items.forEach(i => { const fd = upsertFood({ name: i.name, basis: 'serving', kcal: i.kcal, p: i.p, f: i.f, c: i.c, source: 'ash-estimate', servingText: 'meal' }); addEntry(fd, 1, i.meal || $('#peM', sh).value); });
      save(); closeSheet(); tab = 'food'; render(); toast(`Logged ${items.length} item${items.length === 1 ? '' : 's'}`);
    };
  });
}
function foodCsv() {
  const rows = [['date','meal','food','qty','kcal','protein_g','fat_g','carbs_g','barcode','source']];
  [...S.food.entries].sort((a, b) => (a.date + a.t).localeCompare(b.date + b.t)).forEach(e => rows.push([e.date, e.meal, e.name, e.qtyText, e.kcal, e.p, e.f, e.c, e.barcode, e.source]));
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}

/* ---------- Rest timer (timestamp based; survives backgrounding) ---------- */
let tEnd = 0, tInt = null, actx = null;
function startTimer(sec) {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume && actx.resume(); } catch (e) {}
  tEnd = Date.now() + sec * 1000; $('#timer').classList.remove('hidden', 'done'); document.body.classList.add('timing'); tick(); clearInterval(tInt); tInt = setInterval(tick, 250);
}
function tick() {
  const left = Math.round((tEnd - Date.now()) / 1000);
  if (left <= 0) { $('#tDisplay').textContent = 'Go'; $('#timer').classList.add('done'); clearInterval(tInt); beep(); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); setTimeout(() => { if (Date.now() > tEnd) { $('#timer').classList.add('hidden'); document.body.classList.remove('timing'); } }, 8000); return; }
  $('#tDisplay').textContent = fmtTime(left);
}
function beep() { try { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(actx.destination); g.gain.setValueAtTime(0.25, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.6); o.start(); o.stop(actx.currentTime + 0.6); } catch (e) {} }
$('#tPlus').onclick = () => { tEnd = Math.max(tEnd, Date.now()) + 15000; $('#timer').classList.remove('done'); clearInterval(tInt); tInt = setInterval(tick, 250); tick(); };
$('#tMinus').onclick = () => { tEnd -= 15000; tick(); };
$('#tStop').onclick = () => { clearInterval(tInt); $('#timer').classList.add('hidden'); document.body.classList.remove('timing'); };
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#timer').classList.contains('hidden')) tick(); });

/* ---------- Boot ---------- */
function hashImport() {
  if (!location.hash.startsWith('#import=')) return;
  const code = location.hash; history.replaceState(null, '', location.pathname + location.search);
  if (confirm('Import the setup from this link?')) importText(code);
}
window.addEventListener('hashchange', () => { hashImport(); render(); });
(function boot() {
  hashImport();
  render();
  if (navigator.serviceWorker && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
})();
