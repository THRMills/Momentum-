'use strict';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TODAY  = new Date().toISOString().split('T')[0];
const DAYS7  = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const LEVELS = [
  { name: 'Rookie',  min: 0,    next: 200  },
  { name: 'Scholar', min: 200,  next: 500  },
  { name: 'Veteran', min: 500,  next: 1000 },
  { name: 'Elite',   min: 1000, next: 2000 },
  { name: 'Legend',  min: 2000, next: 9999 },
];

function getPast7() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}
function get365() {
  return Array.from({ length: 365 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (364 - i));
    return d.toISOString().split('T')[0];
  });
}

const PAST7 = getPast7();

// ─── STATE ────────────────────────────────────────────────────────────────────

let S = JSON.parse(localStorage.getItem('mo_v5') || 'null') || {
  habits: [
    { id: 1, name: 'Morning revision',    streak: 4, history: {} },
    { id: 2, name: 'Exercise',             streak: 7, history: {} },
    { id: 3, name: 'Read 20 mins',         streak: 2, history: {} },
    { id: 4, name: 'No socials before 10', streak: 1, history: {} },
  ],
  todos: [
    { id: 1, title: 'Revise integration by parts',  tag: 'school',   priority: 'high', due: '', done: false, completedOn: '' },
    { id: 2, title: 'Geography fieldwork write-up', tag: 'school',   priority: 'med',  due: '', done: false, completedOn: '' },
    { id: 3, title: 'CS NEA — section 2',           tag: 'school',   priority: 'high', due: '', done: false, completedOn: '' },
    { id: 4, title: 'Reply to house group chat',    tag: 'personal', priority: 'low',  due: '', done: true,  completedOn: TODAY },
  ],
  streak: 12,
  xp: 145,
  tokens: 2,
  taskHistory: {},
};

// Guarantee fields exist on old saves
if (!S.taskHistory) S.taskHistory = {};
S.todos.forEach(t => { if (t.completedOn === undefined) t.completedOn = ''; });

// Seed demo history for charts
const _days365 = get365();
S.habits.forEach(h => {
  _days365.forEach((d, i) => {
    if (h.history[d] === undefined) {
      h.history[d] = Math.random() < (i > 350 ? 0.82 : i > 300 ? 0.65 : 0.5);
    }
  });
});

let fbRef = null;

function save() {
  localStorage.setItem('mo_v5', JSON.stringify(S));
  if (fbRef) fbRef.set(S).catch(() => {});
}

// ─── DARK MODE ────────────────────────────────────────────────────────────────

function toggleDark() {
  const dark = document.body.classList.toggle('dark');
  localStorage.setItem('mo_dark', dark ? '1' : '0');
  applyDarkUI(dark);
  renderDonut();
  if (document.getElementById('panel-analytics').classList.contains('active')) renderCharts();
}

function applyDarkUI(dark) {
  const track = document.getElementById('toggleTrack');
  const lbl   = document.getElementById('toggleLbl');
  if (track) track.classList.toggle('on', dark);
  if (lbl)   lbl.textContent = dark ? 'Light' : 'Dark';
}

if (localStorage.getItem('mo_dark') === '1') {
  document.body.classList.add('dark');
  applyDarkUI(true);
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

function goTab(name, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'analytics') { renderCharts(); render365(); renderWeekScore(); }
  if (name === 'focus')     renderFocus();
  if (name === 'todos')     renderTaskStats();
}

// ─── HEADER ───────────────────────────────────────────────────────────────────

function renderHeader() {
  const opts = { weekday: 'long', day: 'numeric', month: 'long' };
  document.getElementById('sideDate').textContent =
    new Date().toLocaleDateString('en-GB', opts);
}

// ─── XP & LEVELS ─────────────────────────────────────────────────────────────

function getLevel() {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (S.xp >= LEVELS[i].min) return { idx: i, ...LEVELS[i] };
  }
  return { idx: 0, ...LEVELS[0] };
}

function awardXP(amt, label) {
  const oldLv = getLevel();
  S.xp += amt;
  if (S.streak > 0 && S.streak % 7 === 0) {
    S.tokens++;
    showToast('Streak token earned');
  }
  save();
  renderXP();
  showToast(`+${amt} XP${label ? ' · ' + label : ''}`);
  const newLv = getLevel();
  if (newLv.idx > oldLv.idx) setTimeout(() => showLevelUp(newLv.name), 700);
}

function renderXP() {
  const lv  = getLevel();
  const pct = Math.min(100, Math.round((S.xp - lv.min) / (lv.next - lv.min) * 100));
  document.getElementById('xpName').textContent    = lv.name;
  document.getElementById('xpPts').textContent     = S.xp + ' XP';
  document.getElementById('xpFill').style.width    = pct + '%';
  document.getElementById('tokenNum').textContent  = S.tokens;
  document.getElementById('sideStreak').textContent = S.streak;
  document.getElementById('useTokenBtn').disabled  = S.tokens < 1;
}

function showLevelUp(name) {
  document.getElementById('luTitle').textContent = 'Level Up!';
  document.getElementById('luSub').textContent   = "You've reached " + name;
  document.getElementById('levelup').classList.add('open');
  launchConfetti();
}

function useToken() {
  if (S.tokens < 1) { showToast('No tokens left'); return; }
  S.tokens--;
  save();
  renderXP();
  showToast('Streak protected');
}

// ─── TOAST ────────────────────────────────────────────────────────────────────

let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ─── CONFETTI ─────────────────────────────────────────────────────────────────

function launchConfetti() {
  const cv  = document.getElementById('confettiCanvas');
  const ctx = cv.getContext('2d');
  cv.width  = innerWidth;
  cv.height = innerHeight;
  const cols = ['#2d7a52','#1e1e1e','#eaf4ee','#9a6b1a','#f7f5f0','#3a9465','#e6e4de'];
  const pts  = Array.from({ length: 130 }, () => ({
    x: Math.random() * cv.width,
    y: Math.random() * cv.height - cv.height,
    w: 5 + Math.random() * 7,
    h: 3 + Math.random() * 5,
    c: cols[Math.floor(Math.random() * cols.length)],
    vx: (Math.random() - .5) * 3,
    vy: 2 + Math.random() * 4,
    rot: Math.random() * 360,
    rv: (Math.random() - .5) * 8,
    op: 1,
  }));
  let start = null;
  function draw(ts) {
    if (!start) start = ts;
    const el = ts - start;
    ctx.clearRect(0, 0, cv.width, cv.height);
    let alive = false;
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.rv;
      if (el > 2500) p.op = Math.max(0, p.op - .02);
      if (p.y < cv.height + 20 && p.op > 0) alive = true;
      ctx.save();
      ctx.globalAlpha = p.op;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (alive && el < 5000) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, cv.width, cv.height);
  }
  requestAnimationFrame(draw);
}

// ─── HABITS ───────────────────────────────────────────────────────────────────

function renderHabits() {
  const list = document.getElementById('habitList');
  list.innerHTML = '';
  S.habits.forEach(h => {
    const done = !!h.history[TODAY];
    const el   = document.createElement('div');
    el.className = 'habit-item' + (done ? ' done-item' : '');
    el.innerHTML = `
      <div class="hcheck ${done ? 'done' : ''}" onclick="toggleHabit(${h.id})"></div>
      <div class="hinfo">
        <div class="hname">${h.name}</div>
        <div class="hstreak">Streak: <b>${h.streak}d</b></div>
      </div>
      <button class="del-btn" onclick="deleteHabit(${h.id})">&#x2715;</button>`;
    list.appendChild(el);
  });
  renderWeekHeatmap();
  renderDonut();
  renderXP();
}

function toggleHabit(id) {
  const h   = S.habits.find(x => x.id === id);
  const was = h.history[TODAY];
  h.history[TODAY] = !was;
  h.streak = was ? Math.max(0, h.streak - 1) : h.streak + 1;
  if (!was) awardXP(10, h.name);
  save();
  renderHabits();
  if (!was && S.habits.every(h => h.history[TODAY]) && S.habits.length > 0) {
    setTimeout(launchConfetti, 200);
    showToast('All habits complete.');
  }
}

function addHabit() {
  const v = document.getElementById('habitInput').value.trim();
  if (!v) return;
  S.habits.push({ id: Date.now(), name: v, streak: 0, history: {} });
  document.getElementById('habitInput').value = '';
  save();
  renderHabits();
}

function deleteHabit(id) {
  S.habits = S.habits.filter(h => h.id !== id);
  save();
  renderHabits();
}

// ─── HEATMAP ──────────────────────────────────────────────────────────────────

function renderWeekHeatmap() {
  const el = document.getElementById('weekHeatmap');
  el.innerHTML = '';
  S.habits.forEach(h => {
    const row = document.createElement('div');
    row.className = 'hmap-row';
    row.innerHTML = `<div class="hmap-lbl">${h.name}</div>`;
    PAST7.forEach(d => {
      const c = document.createElement('div');
      c.className = 'hmap-cell' + (h.history[d] ? ' hit' : '');
      c.textContent = DAYS7[new Date(d).getDay()];
      row.appendChild(c);
    });
    el.appendChild(row);
  });
}

// ─── DONUT ────────────────────────────────────────────────────────────────────

let donutChart = null;

function renderDonut() {
  const done  = S.habits.filter(h => h.history[TODAY]).length;
  const total = S.habits.length;
  const pct   = total ? Math.round(done / total * 100) : 0;
  document.getElementById('donutPct').textContent = pct + '%';
  document.getElementById('donutSub').textContent = `${done} of ${total} habits done today`;

  const dark  = document.body.classList.contains('dark');
  const empty = dark ? '#2e2c28' : '#e8ebe2';
  const cv    = document.getElementById('donutCanvas');
  cv.width = 90; cv.height = 90;
  const ctx = cv.getContext('2d');
  if (donutChart) { donutChart.destroy(); donutChart = null; }

  const g = ctx.createLinearGradient(0, 0, 90, 90);
  g.addColorStop(0, '#2d7a52');
  g.addColorStop(1, '#3a9465');

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: { datasets: [{ data: [done, Math.max(0, total - done)], backgroundColor: [g, empty], borderWidth: 0, cutout: '76%' }] },
    options: {
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: { animateRotate: true, duration: 650, easing: 'easeOutQuart' },
    },
  });
}

// ─── TODOS ────────────────────────────────────────────────────────────────────

let currentFilter = 'all';
let sortInst      = null;

function openAddTask()  { document.getElementById('addTaskModal').classList.add('open'); document.getElementById('todoTitle').focus(); }
function closeAddTask() { document.getElementById('addTaskModal').classList.remove('open'); }

function renderTodos() {
  const list  = document.getElementById('todoList');
  let   items = [...S.todos];

  if (currentFilter === 'active')   items = items.filter(t => !t.done);
  else if (currentFilter === 'done') items = items.filter(t => t.done);
  else if (currentFilter === 'high') items = items.filter(t => t.priority === 'high');
  else if (['school','personal','work','other'].includes(currentFilter))
    items = items.filter(t => t.tag === currentFilter);

  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:.78rem;padding:16px;text-align:center">Nothing here.</div>';
    return;
  }

  items.forEach(t => {
    const wrap = document.createElement('div');
    wrap.className = 'todo-wrap';
    wrap.dataset.id = t.id;

    const el = document.createElement('div');
    el.className = 'todo-item' + (t.done ? ' done-todo' : '');
    const overdue = t.due && !t.done && new Date(t.due) < new Date();
    el.innerHTML = `
      <div class="pbar p-${t.priority}"></div>
      <div class="tcheck ${t.done ? 'done' : ''}" onclick="toggleTodo(${t.id})"></div>
      <div class="t-body">
        <div class="t-title">${t.title}</div>
        <div class="t-meta">
          <span class="tag tag-${t.tag}">${t.tag}</span>
          ${t.due ? `<span class="due-lbl ${overdue ? 'late' : ''}">${t.due}</span>` : ''}
        </div>
      </div>
      <button class="del-btn" style="${t.done ? 'color:var(--danger)' : ''}" onclick="deleteTodo(${t.id})">&#x2715;</button>`;

    wrap.appendChild(el);
    list.appendChild(wrap);
  });

  if (sortInst) sortInst.destroy();
  sortInst = new Sortable(list, {
    animation: 150,
    handle: '.todo-item',
    draggable: '.todo-wrap',
    onEnd(e) { reorder(items, e.oldIndex, e.newIndex); },
  });
}

function reorder(filtered, from, to) {
  const moved = filtered.splice(from, 1)[0];
  filtered.splice(to, 0, moved);
  const ids = filtered.map(t => t.id);
  S.todos = [...filtered, ...S.todos.filter(t => !ids.includes(t.id))];
  save();
}

function filterTodos(f, el) {
  currentFilter = f;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderTodos();
}

function toggleTodo(id) {
  const t = S.todos.find(x => x.id === id);
  t.done = !t.done;
  if (t.done) {
    t.completedOn = TODAY;
    S.taskHistory[TODAY] = (S.taskHistory[TODAY] || 0) + 1;
    const xpMap = { high: 30, med: 20, low: 10 };
    awardXP(xpMap[t.priority] || 10, t.title);
  } else {
    t.completedOn = '';
    if (S.taskHistory[TODAY]) S.taskHistory[TODAY] = Math.max(0, S.taskHistory[TODAY] - 1);
  }
  save();
  renderTodos();
  renderTaskStats();
}

function deleteTodo(id) {
  S.todos = S.todos.filter(t => t.id !== id);
  save();
  renderTodos();
  renderTaskStats();
}

function addTodo() {
  const title = document.getElementById('todoTitle').value.trim();
  if (!title) return;
  S.todos.unshift({
    id: Date.now(),
    title,
    tag:      document.getElementById('todoTag').value,
    priority: document.getElementById('todoPriority').value,
    due:      document.getElementById('todoDue').value,
    done: false,
    completedOn: '',
  });
  document.getElementById('todoTitle').value = '';
  document.getElementById('todoDue').value   = '';
  save();
  renderTodos();
  renderTaskStats();
  closeAddTask();
  showToast('Task added');
}

// ─── TASK STATS ───────────────────────────────────────────────────────────────

let sparkChart = null;

function renderTaskStats() {
  const todayDone = S.taskHistory[TODAY] || 0;
  const totalDone = S.todos.filter(t => t.done).length;
  const total     = S.todos.length;
  const rate      = total ? Math.round(totalDone / total * 100) : 0;

  document.getElementById('tsc-today-val').textContent = todayDone;
  document.getElementById('tsc-total-val').textContent = totalDone;
  document.getElementById('tsc-rate-val').textContent  = rate + '%';

  const sparkData = PAST7.map(d => S.taskHistory[d] || 0);
  const sparkCtx  = document.getElementById('taskSparkline');
  if (!sparkCtx) return;
  if (sparkChart) { sparkChart.destroy(); sparkChart = null; }

  const dark  = document.body.classList.contains('dark');
  const sCtx  = sparkCtx.getContext('2d');
  const sGrad = sCtx.createLinearGradient(0, 0, 0, 70);
  sGrad.addColorStop(0, 'rgba(45,122,82,.25)');
  sGrad.addColorStop(1, 'rgba(45,122,82,0)');

  sparkChart = new Chart(sparkCtx, {
    type: 'line',
    data: {
      labels: PAST7.map(d => DAYS7[new Date(d).getDay()]),
      datasets: [{
        data: sparkData,
        borderColor: '#2d7a52',
        backgroundColor: sGrad,
        tension: .4,
        pointRadius: 4,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#2d7a52',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        fill: true,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} task${ctx.parsed.y !== 1 ? 's' : ''}` } },
      },
      scales: {
        y: {
          min: 0,
          ticks: { stepSize: 1, color: dark ? '#5a5852' : '#888580', font: { family: 'DM Mono', size: 9 } },
          grid:  { color: dark ? 'rgba(255,255,255,.05)' : '#ededea' },
        },
        x: {
          ticks: { color: dark ? '#5a5852' : '#888580', font: { family: 'DM Mono', size: 10 } },
          grid:  { display: false },
        },
      },
    },
  });
}

// ─── FOCUS ────────────────────────────────────────────────────────────────────

function renderFocus() {
  const done  = S.habits.filter(h => h.history[TODAY]).length;
  const total = S.habits.length;
  const pct   = total ? Math.round(done / total * 100) : 0;
  const hr    = new Date().getHours();

  document.getElementById('focusGreet').textContent = (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + '. Stay locked in.';
  document.getElementById('focusSub').textContent   = `${done}/${total} habits · ${S.todos.filter(t => !t.done).length} tasks remaining`;
  document.getElementById('focusPct').textContent   = pct + '%';

  const ft = document.getElementById('focusTasks');
  ft.innerHTML = '';
  const top = [...S.todos]
    .filter(t => !t.done)
    .sort((a, b) => ({ high: 0, med: 1, low: 2 }[a.priority] - { high: 0, med: 1, low: 2 }[b.priority]))
    .slice(0, 3);

  if (!top.length) {
    ft.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:12px">All tasks done.</div>';
  }
  top.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'focus-task' + (t.priority === 'high' ? ' hi' : '');
    el.innerHTML = `
      <div class="focus-num">${i + 1}</div>
      <div style="flex:1">
        <div style="font-size:.8rem">${t.title}</div>
        <div style="margin-top:3px"><span class="tag tag-${t.tag}">${t.tag}</span></div>
      </div>
      <div class="tcheck" onclick="toggleTodo(${t.id});renderFocus()"></div>`;
    ft.appendChild(el);
  });

  const fh = document.getElementById('focusHabits');
  fh.innerHTML = '';
  S.habits.forEach(h => {
    const done = !!h.history[TODAY];
    const el   = document.createElement('div');
    el.className = 'focus-habit' + (done ? ' done-item' : '');
    el.innerHTML = `
      <div class="hcheck ${done ? 'done' : ''}" onclick="toggleHabit(${h.id});renderFocus()"></div>
      <div class="hinfo">
        <div class="hname">${h.name}</div>
        <div class="hstreak">Streak: <b>${h.streak}d</b></div>
      </div>`;
    fh.appendChild(el);
  });
}

// ─── COMMAND PALETTE ─────────────────────────────────────────────────────────

function openPalette() {
  document.getElementById('cmdOverlay').classList.add('open');
  document.getElementById('cmdInput').value = '';
  document.getElementById('cmdInput').focus();
  cmdSearch();
}
function closePalette() { document.getElementById('cmdOverlay').classList.remove('open'); }

function cmdSearch() {
  const q   = document.getElementById('cmdInput').value.toLowerCase();
  const res = document.getElementById('cmdResults');
  res.innerHTML = '';
  const all = [
    ...S.habits.map(h => ({ type: 'habit', label: h.name, id: h.id })),
    ...S.todos.filter(t => !t.done).map(t => ({ type: 'task', label: t.title, id: t.id })),
  ].filter(x => !q || x.label.toLowerCase().includes(q)).slice(0, 8);

  if (!all.length && q) {
    const el = document.createElement('div');
    el.className = 'cmd-item';
    el.innerHTML = `<span>+</span><span>Add task: "<b>${q}</b>"</span>`;
    el.onclick = () => quickAdd(q);
    res.appendChild(el);
    return;
  }
  all.forEach(item => {
    const el = document.createElement('div');
    el.className = 'cmd-item';
    el.innerHTML = `<span>${item.type === 'habit' ? '◎' : '◻'}</span><span style="flex:1">${item.label}</span><span class="cmd-badge">${item.type}</span>`;
    el.onclick = () => {
      if (item.type === 'habit') toggleHabit(item.id);
      else toggleTodo(item.id);
      closePalette();
    };
    res.appendChild(el);
  });
}

function cmdKey(e) {
  if (e.key === 'Escape') closePalette();
  if (e.key === 'Enter')  { const f = document.querySelector('.cmd-item'); if (f) f.click(); }
}

function quickAdd(title) {
  S.todos.unshift({ id: Date.now(), title, tag: 'other', priority: 'med', due: '', done: false, completedOn: '' });
  save();
  renderTodos();
  closePalette();
  showToast('Task added');
}

document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    openPalette();
  }
  if (e.key === 'Escape') closePalette();
});

// ─── WEEK SCORE ───────────────────────────────────────────────────────────────

function renderWeekScore() {
  const habitRate = PAST7.reduce((a, d) => {
    const c = S.habits.filter(h => h.history[d]).length;
    return a + (S.habits.length ? c / S.habits.length : 0);
  }, 0) / 7;
  const taskRate = S.todos.length ? S.todos.filter(t => t.done).length / S.todos.length : 0;
  const score    = Math.round(habitRate * 60 + taskRate * 40);
  const grade    = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D';
  const titles   = { 'A+': 'Exceptional Week', A: 'Strong Week', B: 'Solid Progress', C: 'Room to Grow', D: 'Start Fresh' };
  const subs     = {
    'A+': 'Near-perfect execution. This is what elite looks like.',
    A: 'Consistent habits and solid output. Keep it locked.',
    B: 'Good foundations. Push harder on the habits.',
    C: 'Inconsistent — identify where the routine is breaking.',
    D: 'Reset and recommit. One good day compounds.',
  };
  document.getElementById('wsGrade').textContent = grade;
  document.getElementById('wsTitle').textContent = titles[grade];
  document.getElementById('wsSub').textContent   = subs[grade];
  document.getElementById('wsScore').textContent = `Score: ${score}/100`;
}

// ─── 365 HEATMAP ─────────────────────────────────────────────────────────────

function render365() {
  const days    = get365();
  const heat    = document.getElementById('heat365');
  const mLabels = document.getElementById('heatMonths');
  heat.innerHTML = ''; mLabels.innerHTML = '';

  const first  = new Date(days[0]);
  const offset = first.getDay();
  const all    = [...Array(offset).fill(null), ...days];
  const cols   = Math.ceil(all.length / 7);
  let lastM    = -1;

  for (let c = 0; c < cols; c++) {
    const d = all[c * 7];
    if (d) {
      const m  = new Date(d).getMonth();
      const sp = document.createElement('span');
      sp.textContent = m !== lastM ? MONTHS[m] : '';
      mLabels.appendChild(sp);
      lastM = m;
    }
  }
  for (let c = 0; c < cols; c++) {
    const col = document.createElement('div');
    col.className = 'heat365-col';
    for (let r = 0; r < 7; r++) {
      const d    = all[c * 7 + r];
      const cell = document.createElement('div');
      if (!d) { cell.className = 'heat365-cell'; cell.style.opacity = '0'; }
      else {
        const rate = S.habits.length ? S.habits.filter(h => h.history[d]).length / S.habits.length : 0;
        cell.className = 'heat365-cell' + (rate === 0 ? '' : rate < .25 ? ' h1' : rate < .5 ? ' h2' : rate < .75 ? ' h3' : ' h4');
        cell.title = `${d}: ${Math.round(rate * 100)}%`;
      }
      col.appendChild(cell);
    }
    heat.appendChild(col);
  }
}

// ─── CHARTS ───────────────────────────────────────────────────────────────────

const charts = {};

function mk(id, type, data, opts) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  const dark   = document.body.classList.contains('dark');
  const grid   = dark ? 'rgba(255,255,255,.05)' : '#ededea';
  const tick   = dark ? '#5a5852' : '#888580';
  const border = dark ? '#1e1e1e' : '#f7f5f0';

  if (opts.scales) {
    Object.values(opts.scales).forEach(ax => {
      if (ax.grid) ax.grid.color = grid;
      if (ax.ticks) { ax.ticks.color = tick; ax.ticks.font = { family: 'DM Mono', size: 10 }; }
    });
  }
  if (opts.plugins?.legend?.labels) opts.plugins.legend.labels.color = tick;

  charts[id] = new Chart(document.getElementById(id), {
    type, data,
    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 650, easing: 'easeOutQuart' }, ...opts },
  });
}

function renderCharts() {
  const total = S.habits.length;
  const done  = S.habits.filter(h => h.history[TODAY]).length;
  const pct   = total ? Math.round(done / total * 100) : 0;
  const tdone = S.todos.filter(t => t.done).length;
  const dark  = document.body.classList.contains('dark');
  const brd   = dark ? '#1e1e1e' : '#f7f5f0';

  document.getElementById('anComp').innerHTML   = `<em>${pct}%</em>`;
  document.getElementById('anTasks').innerHTML  = `<em>${tdone}</em><span style="font-size:1rem;color:rgba(255,255,255,.25)">/${S.todos.length}</span>`;
  document.getElementById('anStreak').innerHTML = `<em>${S.streak}</em>`;

  // Bar chart
  const bCtx  = document.getElementById('barChart').getContext('2d');
  const bGrad = bCtx.createLinearGradient(0, 0, 0, 150);
  bGrad.addColorStop(0, '#2d7a52'); bGrad.addColorStop(1, '#3a9465');
  mk('barChart', 'bar', {
    labels: PAST7.map(d => DAYS7[new Date(d).getDay()]),
    datasets: [{
      data: PAST7.map(d => {
        const c = S.habits.filter(h => h.history[d]).length;
        return total ? Math.round(c / total * 100) : 0;
      }),
      backgroundColor: bGrad, borderRadius: 6, borderSkipped: false, hoverBackgroundColor: '#236040',
    }],
  }, { scales: { y: { max: 100, grid: {}, ticks: { callback: v => v + '%' } }, x: { grid: { display: false }, ticks: {} } }, plugins: { legend: { display: false } } });

  // Category donut
  const cats = ['school','personal','work','other'];
  mk('catPie', 'doughnut', {
    labels: ['School','Personal','Work','Other'],
    datasets: [{
      data: cats.map(c => S.todos.filter(t => t.tag === c).length),
      backgroundColor: ['#2563eb','#2d7a52','#9a6b1a','#888580'],
      borderWidth: 3, borderColor: brd, hoverOffset: 10, borderRadius: 4, cutout: '60%',
    }],
  }, { plugins: { legend: { position: 'right', labels: { padding: 10, boxWidth: 8, boxHeight: 8 } } } });

  // Line chart
  const lCtx  = document.getElementById('lineChart').getContext('2d');
  const lGrad = lCtx.createLinearGradient(0, 0, 0, 150);
  lGrad.addColorStop(0, 'rgba(45,122,82,.28)'); lGrad.addColorStop(1, 'rgba(45,122,82,0)');
  mk('lineChart', 'line', {
    labels: PAST7.map(d => DAYS7[new Date(d).getDay()]),
    datasets: [{
      data: PAST7.map(d => {
        const c = S.habits.filter(h => h.history[d]).length;
        return total ? Math.round(c / total * 100) : 0;
      }),
      borderColor: '#2d7a52', backgroundColor: lGrad, tension: .44,
      pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: '#2d7a52',
      pointBorderWidth: 2, pointHoverRadius: 6, fill: true,
    }],
  }, { scales: { y: { min: 0, max: 100, grid: {}, ticks: { callback: v => v + '%' } }, x: { grid: { display: false }, ticks: {} } }, plugins: { legend: { display: false } } });

  // Priority donut
  mk('prioPie', 'doughnut', {
    labels: ['High','Medium','Low'],
    datasets: [{
      data: ['high','med','low'].map(p => S.todos.filter(t => t.priority === p).length),
      backgroundColor: ['#b03020','#9a6b1a','#d1d5db'],
      borderWidth: 3, borderColor: brd, hoverOffset: 10, borderRadius: 4, cutout: '60%',
    }],
  }, { plugins: { legend: { position: 'right', labels: { padding: 10, boxWidth: 8, boxHeight: 8 } } } });
}

// ─── FIREBASE ─────────────────────────────────────────────────────────────────

let fbApp = null;
const FB  = {
  key: 'AIzaSyBEquPUX96zuZQ_ZVzMceuDqSq_FdLs7OA',
  url: 'https://momentun2-default-rtdb.firebaseio.com',
  pid: 'momentun2',
};

function openSyncModal()  { document.getElementById('syncModal').classList.add('open'); }
function closeSyncModal() { document.getElementById('syncModal').classList.remove('open'); }

async function connectFirebase(k, u, p) {
  const key = k || FB.key;
  const url = u || FB.url;
  const pid = p || FB.pid;
  setSyncStatus('Connecting...', '');
  try {
    if (!window.firebase) {
      await loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js');
    }
    if (!fbApp) fbApp = firebase.initializeApp({ apiKey: key, databaseURL: url, projectId: pid }, 'momentum');
    const db = firebase.database(fbApp);
    fbRef    = db.ref('momentum/data');
    const snap = await fbRef.once('value');
    if (!snap.val()) await fbRef.set(S);
    fbRef.on('value', snap => {
      const r = snap.val();
      if (r) {
        S = r;
        if (!S.taskHistory) S.taskHistory = {};
        S.todos.forEach(t => { if (t.completedOn === undefined) t.completedOn = ''; });
        save(); renderHabits(); renderTodos(); renderXP();
      }
    });
    setSyncStatus('Synced', 'color:var(--em)');
    setTimeout(closeSyncModal, 1000);
  } catch (e) {
    setSyncStatus('Error: ' + e.message, 'color:var(--danger)');
  }
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
function setSyncStatus(msg, style) {
  const el = document.getElementById('syncStatus');
  if (el) { el.textContent = msg; el.style.cssText = style || ''; }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

renderHeader();
renderHabits();
renderTodos();
renderTaskStats();
renderXP();

// Auto-connect Firebase
setTimeout(() => connectFirebase(), 1000);

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
