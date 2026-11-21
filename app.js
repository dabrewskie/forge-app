/* Forge — offline workout + body-comp log. All data lives in localStorage on this device. */
'use strict';
const KEY = 'forge.v1'; // storage key: never change (keeps existing data)
const APP_VERSION = 'v2 (2026-11-21)';
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
    program: { days: [] }, overrides: {}, sessions: [], body: [], daily: {}, customLib: [] };
}
let S = load();
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { console.error(e); }
  return blank();
}
function migrate(d) { const b = blank(); return Object.assign(b, d, { settings: Object.assign(b.settings, d.settings || {}), targets: Object.assign(b.targets, d.targets || {}) }); }
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
function closeSheet() { $('#modal').classList.add('hidden'); $('#sheet').innerHTML = ''; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeSheet(); });
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; if (tab === 'today') curDate = today(); render(); window.scrollTo(0, 0); }));
function applyTheme() { document.documentElement.dataset.theme = S.settings.theme || 'dark'; }

function render() {
  applyTheme();
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const v = $('#view');
  if (!S.program.days.length && tab !== 'more' && tab !== 'body' && tab !== 'history') { v.innerHTML = welcome(); bindWelcome(); $('#subtitle').textContent = 'Set up'; return; }
  ({ today: renderToday, program: renderProgram, body: renderBody, history: renderHistory, more: renderMore })[tab](v);
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
    <div class="row" style="margin-top:8px"><button class="grow" id="impF">Import file</button><button class="grow" id="impP">Paste import</button></div>
    <input type="file" id="impFile" accept="application/json,.json" class="hidden"></div>
  <div class="card"><h3>Plan</h3><div class="row"><button class="grow" id="reStarter">Reload starter plan</button><button class="grow danger" id="wipe">Erase all data</button></div>
    <p class="muted small">Reloading the starter replaces the program and targets only; history and body log stay.</p></div>
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
  $('#impF').onclick = () => $('#impFile').click();
  $('#impFile').onchange = async e => { const f = e.target.files[0]; if (f) importText(await f.text()); };
  $('#impP').onclick = pasteImport;
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
  lines.push(`Sessions: ${ss.filter(s => s.entries.some(e => e.sets.some(t => t.done))).length}`);
  ss.forEach(s => { const parts = s.entries.map(e => { const d = e.sets.filter(t => t.done); if (!d.length) return null; const top = d.reduce((m, t) => (t.w || 0) > (m.w || 0) ? t : m, d[0]); return `${e.name} ${d.map(t => `${t.w ?? 'BW'}×${t.r ?? '–'}${t.rir != null ? '@' + t.rir : ''}`).join(', ')}`; }).filter(Boolean);
    if (parts.length) lines.push(`- ${fmtDate(s.date)} ${s.dayName}: ${parts.join('; ')}${s.notes ? ' | ' + s.notes : ''}`); });
  return lines.join('\n');
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
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
})();
