// ============ STATE ============
let state = {
  tasks: [],
  subjects: [],
  sessions: [], // {date, minutes, taskId}
  weeklyGoal: 10,
  currentWeekStart: getMonday(new Date()),
  timerMode: 'focus',
  timerDuration: 25 * 60,
  timerRemaining: 25 * 60,
  timerRunning: false,
  timerInterval: null,
  editingTaskId: null
};

const MODES = {
  focus: { label: 'Session de concentration', duration: 25 * 60 },
  short: { label: 'Pause courte', duration: 5 * 60 },
  long: { label: 'Pause longue', duration: 15 * 60 }
};

// ============ PERSISTENCE ============
function save() {
  localStorage.setItem('studyflow', JSON.stringify({
    tasks: state.tasks,
    subjects: state.subjects,
    sessions: state.sessions,
    weeklyGoal: state.weeklyGoal
  }));
}
function load() {
  const data = localStorage.getItem('studyflow');
  if (data) {
    const parsed = JSON.parse(data);
    state.tasks = parsed.tasks || [];
    state.subjects = parsed.subjects || [];
    state.sessions = parsed.sessions || [];
    state.weeklyGoal = parsed.weeklyGoal || 10;
    migrateSampleContent();
  }
  if (state.subjects.length === 0) {
    state.subjects = [
      { id: 's1', name: 'Mathématiques', color: '#8b5cf6' },
      { id: 's2', name: 'Physique', color: '#06b6d4' },
      { id: 's3', name: 'Littérature', color: '#f59e0b' },
      { id: 's4', name: 'Informatique', color: '#10b981' }
    ];
    // Seed demo tasks
    const today = new Date();
    const fmt = d => d.toISOString().split('T')[0];
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
    const in3 = new Date(today); in3.setDate(today.getDate()+3);
    state.tasks = [
      { id: 't1', title: 'Réviser les dérivées', desc: 'Exercices du chapitre 5', subjectId: 's1', priority: 'high', due: fmt(today), time: 60, done: false, created: Date.now() },
      { id: 't2', title: 'Lire l’acte II de Hamlet', desc: 'Noter les thèmes importants', subjectId: 's3', priority: 'medium', due: fmt(tomorrow), time: 45, done: false, created: Date.now() },
      { id: 't3', title: 'Préparer le compte rendu de physique', desc: 'Expérience sur le mouvement', subjectId: 's2', priority: 'high', due: fmt(in3), time: 90, done: false, created: Date.now() },
      { id: 't4', title: 'Revoir les structures de données', desc: 'Arbres et graphes', subjectId: 's4', priority: 'low', due: fmt(in3), time: 30, done: true, created: Date.now() }
    ];
    save();
  }
}

function migrateSampleContent() {
  const subjects = {
    s1: ['Mathematics', 'Mathématiques'],
    s2: ['Physics', 'Physique'],
    s3: ['Literature', 'Littérature'],
    s4: ['Computer Science', 'Informatique']
  };
  const sampleTasks = {
    t1: ['Complete calculus problem set', 'Réviser les dérivées', 'Chapter 5 derivatives', 'Exercices du chapitre 5'],
    t2: ['Read Hamlet Act 2', 'Lire l’acte II de Hamlet', 'Take notes on themes', 'Noter les thèmes importants'],
    t3: ['Physics lab report', 'Préparer le compte rendu de physique', 'Kinematics experiment', 'Expérience sur le mouvement'],
    t4: ['Review data structures', 'Revoir les structures de données', 'Trees and graphs', 'Arbres et graphes']
  };
  let changed = false;

  state.subjects.forEach(subject => {
    const sample = subjects[subject.id];
    if (sample && subject.name === sample[0]) {
      subject.name = sample[1];
      changed = true;
    }
  });
  state.tasks.forEach(task => {
    const sample = sampleTasks[task.id];
    if (!sample) return;
    if (task.title === sample[0]) {
      task.title = sample[1];
      changed = true;
    }
    if (task.desc === sample[2]) {
      task.desc = sample[3];
      changed = true;
    }
  });

  if (changed) save();
}

// ============ UTILS ============
function uid() { return Math.random().toString(36).slice(2,10); }
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0,0,0,0);
  return date;
}
function fmtDate(d) { return d.toISOString().split('T')[0]; }
function prettyDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function daysBetween(a, b) {
  const d1 = new Date(a + 'T00:00:00');
  const d2 = new Date(b + 'T00:00:00');
  return Math.round((d2 - d1) / 86400000);
}
function getSubject(id) { return state.subjects.find(s => s.id === id); }

// ============ NAV ============
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.remove('tab-active');
      b.classList.add('text-slate-300');
    });
    btn.classList.add('tab-active');
    btn.classList.remove('text-slate-300');
    const tab = btn.dataset.tab;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-' + tab).classList.remove('hidden');
    const titles = {
      dashboard: ['Tableau de bord', 'Prêt à avancer ? Organisons ta journée.'],
      tasks: ['Tâches', 'Organise tes tâches et tes révisions.'],
      calendar: ['Calendrier', 'Planifie ta semaine en un coup d’œil.'],
      timer: ['Minuteur Pomodoro', 'Reste concentré grâce aux sessions minutées.'],
      stats: ['Statistiques', 'Suis ta progression dans tes révisions.']
    };
    document.getElementById('pageTitle').textContent = titles[tab][0];
    document.getElementById('pageSubtitle').textContent = titles[tab][1];
    if (tab === 'calendar') renderCalendar();
    if (tab === 'stats') renderStats();
    if (tab === 'timer') renderTimerTasks();
  });
});

// ============ TASKS ============
function openTaskModal(taskId = null) {
  state.editingTaskId = taskId;
  const modal = document.getElementById('taskModal');
  const form = document.getElementById('taskForm');
  form.reset();
  document.getElementById('modalTitle').textContent = taskId ? 'Modifier la tâche' : 'Nouvelle tâche';
  populateSubjectSelect();
  if (taskId) {
    const t = state.tasks.find(x => x.id === taskId);
    document.getElementById('taskTitle').value = t.title;
    document.getElementById('taskDesc').value = t.desc || '';
    document.getElementById('taskSubject').value = t.subjectId;
    document.getElementById('taskPriority').value = t.priority;
    document.getElementById('taskDue').value = t.due || '';
    document.getElementById('taskTime').value = t.time || 30;
  } else {
    document.getElementById('taskDue').value = fmtDate(new Date());
  }
  modal.classList.remove('hidden');
}
function closeTaskModal() {
  document.getElementById('taskModal').classList.add('hidden');
  state.editingTaskId = null;
}
function populateSubjectSelect() {
  const sel = document.getElementById('taskSubject');
  sel.innerHTML = state.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

document.getElementById('taskForm').addEventListener('submit', e => {
  e.preventDefault();
  const data = {
    title: document.getElementById('taskTitle').value.trim(),
    desc: document.getElementById('taskDesc').value.trim(),
    subjectId: document.getElementById('taskSubject').value,
    priority: document.getElementById('taskPriority').value,
    due: document.getElementById('taskDue').value,
    time: parseInt(document.getElementById('taskTime').value) || 30
  };
  if (state.editingTaskId) {
    const t = state.tasks.find(x => x.id === state.editingTaskId);
    Object.assign(t, data);
  } else {
    state.tasks.push({ id: uid(), ...data, done: false, created: Date.now() });
  }
  save();
  closeTaskModal();
  renderAll();
});

function toggleTask(id) {
  const t = state.tasks.find(x => x.id === id);
  t.done = !t.done;
  if (t.done) t.completedAt = Date.now();
  else delete t.completedAt;
  save();
  renderAll();
}
function deleteTask(id) {
  if (!confirm('Supprimer cette tâche ?')) return;
  state.tasks = state.tasks.filter(t => t.id !== id);
  save();
  renderAll();
}

function renderTaskCard(t) {
  const sub = getSubject(t.subjectId);
  const priorityColors = { high: 'priority-high', medium: 'priority-medium', low: 'priority-low' };
  const priorityLabels = { high: 'Élevée', medium: 'Moyenne', low: 'Faible' };
  const overdue = t.due && !t.done && new Date(t.due + 'T23:59:59') < new Date();
  return `
    <div class="task-card glass rounded-xl p-4 border border-transparent ${t.done ? 'done opacity-70' : ''}">
      <div class="flex items-start gap-3">
        <button onclick="toggleTask('${t.id}')" aria-label="${t.done ? 'Marquer comme à faire' : 'Marquer comme terminée'} : ${escapeHtml(t.title)}" class="mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 ${t.done ? 'bg-violet-500 border-violet-500' : 'border-slate-500 hover:border-violet-400'} flex items-center justify-center transition">
          ${t.done ? '<svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </button>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <h4 class="task-title font-semibold text-sm">${escapeHtml(t.title)}</h4>
            <span class="chip ${priorityColors[t.priority]} text-white">${priorityLabels[t.priority]}</span>
            ${sub ? `<span class="chip" style="background:${sub.color}30;color:${sub.color}">${escapeHtml(sub.name)}</span>` : ''}
          </div>
          ${t.desc ? `<p class="text-xs text-slate-400 mb-2">${escapeHtml(t.desc)}</p>` : ''}
          <div class="flex items-center gap-3 text-xs text-slate-400">
            ${t.due ? `<span class="${overdue ? 'text-red-400 font-semibold' : ''}">📅 ${prettyDate(t.due)}${overdue ? ' (en retard)' : ''}</span>` : ''}
            <span>⏱ ${t.time} min</span>
          </div>
        </div>
        <div class="flex gap-1">
          <button onclick="openTaskModal('${t.id}')" aria-label="Modifier la tâche : ${escapeHtml(t.title)}" class="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onclick="deleteTask('${t.id}')" aria-label="Supprimer la tâche : ${escapeHtml(t.title)}" class="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderTasks() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const fSub = document.getElementById('filterSubject').value;
  const fPri = document.getElementById('filterPriority').value;
  const fStat = document.getElementById('filterStatus').value;

  let filtered = state.tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search) && !(t.desc||'').toLowerCase().includes(search)) return false;
    if (fSub && t.subjectId !== fSub) return false;
    if (fPri && t.priority !== fPri) return false;
    if (fStat === 'done' && !t.done) return false;
    if (fStat === 'pending' && t.done) return false;
    return true;
  });

  filtered.sort((a,b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pa = {high:0,medium:1,low:2}[a.priority];
    const pb = {high:0,medium:1,low:2}[b.priority];
    if (pa !== pb) return pa - pb;
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due) return -1;
    if (b.due) return 1;
    return b.created - a.created;
  });

  const list = document.getElementById('taskList');
  const empty = document.getElementById('emptyTasks');
  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    list.innerHTML = filtered.map(renderTaskCard).join('');
  }

  // Populate filter subjects
  const fSel = document.getElementById('filterSubject');
  const current = fSel.value;
  fSel.innerHTML = '<option value="">Toutes les matières</option>' + state.subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  fSel.value = current;
}

['searchInput','filterSubject','filterPriority','filterStatus'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderTasks);
  document.getElementById(id).addEventListener('change', renderTasks);
});

// ============ SUBJECTS ============
function openSubjectModal() {
  document.getElementById('subjectModal').classList.remove('hidden');
  renderSubjectList();
}
function closeSubjectModal() {
  document.getElementById('subjectModal').classList.add('hidden');
}
function renderSubjectList() {
  const list = document.getElementById('subjectList');
  list.innerHTML = state.subjects.map(s => `
    <div class="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50">
      <div class="w-4 h-4 rounded" style="background:${s.color}"></div>
      <span class="flex-1 text-sm">${escapeHtml(s.name)}</span>
      <button onclick="deleteSubject('${s.id}')" aria-label="Supprimer la matière : ${escapeHtml(s.name)}" class="text-slate-400 hover:text-red-400 p-1">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
  `).join('');
}
function addSubject() {
  const name = document.getElementById('newSubject').value.trim();
  const color = document.getElementById('newSubjectColor').value;
  if (!name) return;
  state.subjects.push({ id: uid(), name, color });
  document.getElementById('newSubject').value = '';
  save();
  renderSubjectList();
  renderAll();
}
function deleteSubject(id) {
  if (state.tasks.some(t => t.subjectId === id)) {
    if (!confirm('Cette matière contient des tâches. La supprimer ? Ces tâches ne seront plus associées à une matière.')) return;
  }
  state.subjects = state.subjects.filter(s => s.id !== id);
  save();
  renderSubjectList();
  renderAll();
}

// ============ DASHBOARD ============
function renderDashboard() {
  const today = fmtDate(new Date());
  const todayTasks = state.tasks.filter(t => t.due === today);
  const upcoming = state.tasks.filter(t => !t.done && t.due && t.due > today).sort((a,b) => a.due.localeCompare(b.due)).slice(0, 5);

  document.getElementById('todayTasks').innerHTML = todayTasks.length
    ? todayTasks.map(renderTaskCard).join('')
    : '<p class="text-sm text-slate-400 text-center py-8">Aucune tâche prévue aujourd’hui. 🎉</p>';
  document.getElementById('todayCount').textContent = `${todayTasks.length} tâche${todayTasks.length!==1?'s':''}`;

  document.getElementById('upcomingTasks').innerHTML = upcoming.length
    ? upcoming.map(t => {
        const sub = getSubject(t.subjectId);
        const days = daysBetween(today, t.due);
        return `
          <div class="p-3 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition cursor-pointer" onclick="openTaskModal('${t.id}')">
            <div class="flex items-center gap-2 mb-1">
              <div class="w-2 h-2 rounded-full" style="background:${sub?sub.color:'#64748b'}"></div>
              <h4 class="text-sm font-medium truncate">${escapeHtml(t.title)}</h4>
            </div>
            <div class="flex items-center justify-between text-xs text-slate-400">
              <span>${prettyDate(t.due)}</span>
              <span class="${days<=1?'text-amber-400 font-semibold':''}">${days===1?'Demain':`Dans ${days} jours`}</span>
            </div>
          </div>
        `;
      }).join('')
    : '<p class="text-sm text-slate-400 text-center py-8">Aucune échéance à venir.</p>';

  // Stats
  const total = state.tasks.length;
  const done = state.tasks.filter(t => t.done).length;
  const pending = total - done;
  const totalMinutes = state.sessions.reduce((s,x) => s + x.minutes, 0);
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statDone').textContent = done;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statHours').innerHTML = `${Math.round(totalMinutes/60*10)/10}<span class="text-lg text-slate-400 ml-1">h</span>`;

  // Weekly goal
  const weekStart = getMonday(new Date());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate()+6);
  const weekDone = state.tasks.filter(t => {
    if (!t.done || !t.completedAt) return false;
    const d = new Date(t.completedAt);
    return d >= weekStart && d <= weekEnd;
  }).length;
  const pct = Math.min(100, Math.round((weekDone / state.weeklyGoal) * 100));
  document.getElementById('goalPercent').textContent = pct + '%';
  document.getElementById('goalBar').style.width = pct + '%';
  document.getElementById('goalDone').textContent = weekDone;
  document.getElementById('goalTotal').textContent = state.weeklyGoal;

  renderWeeklyChart();
}

let weeklyChartInstance;
function renderWeeklyChart() {
  const ctx = document.getElementById('weeklyChart');
  if (!ctx) return;
  const labels = [];
  const doneData = [];
  const newData = [];
  const today = new Date();
  const monday = getMonday(today);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = fmtDate(d);
    labels.push(d.toLocaleDateString('fr-FR', { weekday: 'short' }));
    doneData.push(state.tasks.filter(t => t.completedAt && fmtDate(new Date(t.completedAt)) === ds).length);
    newData.push(state.tasks.filter(t => fmtDate(new Date(t.created)) === ds).length);
  }
  if (weeklyChartInstance) weeklyChartInstance.destroy();
  weeklyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Créées', data: newData, backgroundColor: 'rgba(139,92,246,0.5)', borderRadius: 6 },
        { label: 'Terminées', data: doneData, backgroundColor: 'rgba(16,185,129,0.6)', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#cbd5e1' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
        y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,0.1)' }, beginAtZero: true }
      }
    }
  });
}

// ============ CALENDAR ============
function renderCalendar() {
  const start = new Date(state.currentWeekStart);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  document.getElementById('weekLabel').textContent =
    `${start.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} — ${end.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}`;

  const grid = document.getElementById('calendarGrid');
  const today = fmtDate(new Date());
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const ds = fmtDate(d);
    const dayTasks = state.tasks.filter(t => t.due === ds);
    const isToday = ds === today;
    html += `
      <div class="calendar-cell glass rounded-lg p-2 ${isToday ? 'ring-2 ring-violet-500/50' : ''}">
        <div class="flex items-center justify-between mb-1">
          <span class="calendar-day-name">${d.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
          <span class="text-xs font-semibold ${isToday ? 'text-violet-300' : 'text-slate-400'}">${d.getDate()}</span>
          ${dayTasks.length ? `<span class="text-[10px] text-slate-500">${dayTasks.length}</span>` : ''}
        </div>
        <div class="space-y-1">
          ${dayTasks.slice(0,3).map(t => {
            const sub = getSubject(t.subjectId);
            return `<div onclick="openTaskModal('${t.id}')" class="text-[11px] px-1.5 py-1 rounded truncate cursor-pointer hover:bg-slate-700/50 ${t.done?'opacity-50 line-through':''}" style="background:${sub?sub.color+'30':'#334155'};color:${sub?sub.color:'#cbd5e1'}" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>`;
          }).join('')}
          ${dayTasks.length > 3 ? `<div class="text-[10px] text-slate-500 px-1">+${dayTasks.length-3} autre${dayTasks.length-3 > 1 ? 's' : ''}</div>` : ''}
        </div>
      </div>
    `;
  }
  grid.innerHTML = html;
}
function changeWeek(delta) {
  state.currentWeekStart.setDate(state.currentWeekStart.getDate() + delta * 7);
  renderCalendar();
}
function goToday() {
  state.currentWeekStart = getMonday(new Date());
  renderCalendar();
}

// ============ TIMER ============
function setTimerMode(mode) {
  state.timerMode = mode;
  state.timerDuration = MODES[mode].duration;
  state.timerRemaining = MODES[mode].duration;
  state.timerRunning = false;
  clearInterval(state.timerInterval);
  document.querySelectorAll('.timer-mode').forEach(b => {
    b.classList.remove('tab-active');
    b.classList.add('text-slate-300');
  });
  document.querySelector(`.timer-mode[data-mode="${mode}"]`).classList.add('tab-active');
  document.querySelector(`.timer-mode[data-mode="${mode}"]`).classList.remove('text-slate-300');
  document.getElementById('timerLabel').textContent = MODES[mode].label;
  updateTimerDisplay();
  updateStartBtn();
}
function updateTimerDisplay() {
  const m = Math.floor(state.timerRemaining / 60);
  const s = state.timerRemaining % 60;
  document.getElementById('timerDisplay').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const circle = document.getElementById('timerCircle');
  const circumference = 2 * Math.PI * 90;
  const offset = circumference * (1 - state.timerRemaining / state.timerDuration);
  circle.setAttribute('stroke-dashoffset', offset);
}
function updateStartBtn() {
  const btn = document.getElementById('startBtn');
  if (state.timerRunning) {
    btn.innerHTML = '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
  } else {
    btn.innerHTML = '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Démarrer';
  }
}
function toggleTimer() {
  if (state.timerRunning) {
    state.timerRunning = false;
    clearInterval(state.timerInterval);
  } else {
    state.timerRunning = true;
    state.timerInterval = setInterval(() => {
      state.timerRemaining--;
      if (state.timerRemaining <= 0) {
        clearInterval(state.timerInterval);
        state.timerRunning = false;
        state.timerRemaining = 0;
        onTimerComplete();
      }
      updateTimerDisplay();
    }, 1000);
  }
  updateStartBtn();
}
function resetTimer() {
  state.timerRunning = false;
  clearInterval(state.timerInterval);
  state.timerRemaining = state.timerDuration;
  updateTimerDisplay();
  updateStartBtn();
}
function onTimerComplete() {
  updateStartBtn();
  if (state.timerMode === 'focus') {
    const mins = state.timerDuration / 60;
    const taskId = document.getElementById('timerTask').value || null;
    state.sessions.push({ date: fmtDate(new Date()), minutes: mins, taskId, timestamp: Date.now() });
    save();
    renderTimerStats();
    alert(`🎉 Session de concentration terminée ! ${mins} minutes enregistrées.`);
  } else {
    alert('Pause terminée ! Prêt à te reconcentrer ?');
  }
}
function renderTimerTasks() {
  const sel = document.getElementById('timerTask');
  const current = sel.value;
  sel.innerHTML = '<option value="">Aucune tâche associée</option>' +
    state.tasks.filter(t => !t.done).map(t => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('');
  sel.value = current;
  renderTimerStats();
}
function renderTimerStats() {
  const today = fmtDate(new Date());
  const todaySessions = state.sessions.filter(s => s.date === today && s.minutes);
  const todayCount = todaySessions.length;
  const todayMins = todaySessions.reduce((s,x) => s + x.minutes, 0);
  document.getElementById('sessionCount').textContent = todayCount;
  document.getElementById('totalFocus').textContent = todayMins + 'm';
}

// ============ STATS ============
let subjectChart, completionChart, focusChart;
function renderStats() {
  // By subject
  const subCounts = {};
  state.tasks.forEach(t => {
    const sub = getSubject(t.subjectId);
    const key = sub ? sub.name : 'Sans matière';
    const color = sub ? sub.color : '#64748b';
    if (!subCounts[key]) subCounts[key] = { count: 0, color };
    subCounts[key].count++;
  });
  const ctx1 = document.getElementById('subjectChart');
  if (subjectChart) subjectChart.destroy();
  subjectChart = new Chart(ctx1, {
    type: 'doughnut',
    data: {
      labels: Object.keys(subCounts),
      datasets: [{ data: Object.values(subCounts).map(v => v.count), backgroundColor: Object.values(subCounts).map(v => v.color), borderWidth: 0 }]
    },
    options: {
      plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1', padding: 12 } } },
      cutout: '65%'
    }
  });

  // Completion
  const done = state.tasks.filter(t => t.done).length;
  const pending = state.tasks.length - done;
  const ctx2 = document.getElementById('completionChart');
  if (completionChart) completionChart.destroy();
  completionChart = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: ['Terminées', 'À faire'],
      datasets: [{ data: [done, pending], backgroundColor: ['#10b981', '#64748b'], borderWidth: 0 }]
    },
    options: {
      plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1', padding: 12 } } },
      cutout: '65%'
    }
  });

  // Focus last 7 days
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = fmtDate(d);
    labels.push(d.toLocaleDateString('fr-FR', { weekday: 'short' }));
    data.push(state.sessions.filter(s => s.date === ds).reduce((s,x) => s + x.minutes, 0));
  }
  const ctx3 = document.getElementById('focusChart');
  if (focusChart) focusChart.destroy();
  focusChart = new Chart(ctx3, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Minutes de concentration',
        data,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139,92,246,0.15)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#8b5cf6',
        pointRadius: 5
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' }, beginAtZero: true }
      }
    }
  });
}

// ============ INIT ============
function renderAll() {
  renderDashboard();
  renderTasks();
  renderTimerTasks();
}

document.getElementById('todayDate').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

load();
renderAll();
updateTimerDisplay();

// Close modals on backdrop click
document.getElementById('taskModal').addEventListener('click', e => { if (e.target.id === 'taskModal') closeTaskModal(); });
document.getElementById('subjectModal').addEventListener('click', e => { if (e.target.id === 'subjectModal') closeSubjectModal(); });