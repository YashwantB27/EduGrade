/* ============================================================
   EduGrade — Application Logic
   Engineering SGPA/CGPA Tracker | v1.0
   ============================================================ */

'use strict';

// ── Grade Point Map (10-Point Scale, standard engineering) ──
const GRADE_POINTS = {
  'S': 10,
  'A':  9,
  'B':  8,
  'C':  7,
  'D':  6,
  'E':  5,
  'F':  0,
};

// 'Completed' is a pass-through grade — no grade points, no credits counted
const GRADE_OPTIONS = [...Object.keys(GRADE_POINTS), 'Completed'];

// Helper: returns null for grades that must not affect SGPA/CGPA
function gpForSubject(s) {
  if (s.grade === 'Completed' || s.grade === 'F') return null;
  const gp = GRADE_POINTS[s.grade];
  return gp !== undefined ? gp : null;
}
const CREDIT_OPTIONS = [0.5, 1, 1.5, 2, 3];

// ── State ──
let semesters = [];   // [{ id, label, subjects: [{name, credits, grade}] }]

// ── Persistence ──
function saveState() {
  localStorage.setItem('edugrade-semesters', JSON.stringify(semesters));
}

function loadState() {
  try {
    const raw = localStorage.getItem('edugrade-semesters');
    if (raw) semesters = JSON.parse(raw);
  } catch { semesters = []; }
}

// ── Computation ──
function computeSGPA(subjects) {
  let totalCredits = 0, weightedSum = 0;
  for (const s of subjects) {
    const gp = gpForSubject(s);
    if (gp === null || !s.credits) continue;
    totalCredits += Number(s.credits);
    weightedSum  += Number(s.credits) * gp;
  }
  if (totalCredits === 0) return null;
  return Math.round((weightedSum / totalCredits) * 100) / 100;
}

function computeCGPA() {
  let totalCredits = 0, weightedSum = 0;
  for (const sem of semesters) {
    for (const s of sem.subjects) {
      const gp = gpForSubject(s);
      if (gp === null || !s.credits) continue;
      totalCredits += Number(s.credits);
      weightedSum  += Number(s.credits) * gp;
    }
  }
  if (totalCredits === 0) return null;
  return Math.round((weightedSum / totalCredits) * 100) / 100;
}

function totalCreditsAll() {
  return semesters.reduce((acc, sem) =>
    acc + sem.subjects.reduce((a, s) => {
      // Completed and Failed subjects don't count toward earned credits
      if (s.grade === 'F' || s.grade === 'Completed' || !s.credits) return a;
      return a + Number(s.credits);
    }, 0), 0);
}

function totalSubjectsAll() {
  return semesters.reduce((acc, sem) => acc + sem.subjects.length, 0);
}

function cgpaBadgeClass(cgpa) {
  if (cgpa >= 9) return 'green';
  if (cgpa >= 7) return 'blue';
  if (cgpa >= 5) return 'yellow';
  return 'red';
}

function cgpaLabel(cgpa) {
  if (cgpa >= 9) return '🏆 Distinction';
  if (cgpa >= 7) return '⭐ First Class';
  if (cgpa >= 5) return '✅ Pass';
  return '⚠ At Risk';
}

// ── Hero Card Update ──
function updateHero() {
  const cgpa = computeCGPA();
  const cgpaEl   = document.getElementById('hero-cgpa');
  const badgeEl  = document.getElementById('cgpa-badge');
  const semEl    = document.getElementById('stat-semesters');
  const credEl   = document.getElementById('stat-credits');
  const subEl    = document.getElementById('stat-subjects');

  semEl.textContent  = semesters.length;
  credEl.textContent = totalCreditsAll();
  subEl.textContent  = totalSubjectsAll();

  if (cgpa === null) {
    cgpaEl.textContent  = '—';
    badgeEl.textContent = '';
    badgeEl.className   = 'cgpa-badge';
    updateSparkline([]);
    return;
  }

  cgpaEl.textContent  = cgpa.toFixed(2);
  badgeEl.textContent = cgpaLabel(cgpa);
  badgeEl.className   = `cgpa-badge ${cgpaBadgeClass(cgpa)}`;

  const sgpas = semesters.map(s => computeSGPA(s.subjects)).filter(v => v !== null);
  updateSparkline(sgpas);
}

function updateSparkline(sgpas) {
  const polyline = document.getElementById('hero-sparkline');
  const dot      = document.getElementById('hero-dot');
  if (!sgpas.length) {
    polyline.setAttribute('points', '10,70 10,70');
    dot.setAttribute('cx', 10); dot.setAttribute('cy', 70);
    return;
  }
  const W = 120, H = 80, pad = 10;
  const min = Math.min(...sgpas, 5);
  const max = Math.max(...sgpas, 10);
  const range = max - min || 1;
  const pts = sgpas.map((v, i) => {
    const x = pad + (i / Math.max(sgpas.length - 1, 1)) * (W - 2 * pad);
    const y = H - pad - ((v - min) / range) * (H - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  polyline.setAttribute('points', pts.join(' '));
  const last = pts[pts.length - 1].split(',');
  dot.setAttribute('cx', last[0]);
  dot.setAttribute('cy', last[1]);
}

// ── Semester Label → Human Readable ──
function semesterFullName(label) {
  const map = {
    '1-1': '1st Year · 1st Semester',
    '1-2': '1st Year · 2nd Semester',
    '2-1': '2nd Year · 1st Semester',
    '2-2': '2nd Year · 2nd Semester',
    '3-1': '3rd Year · 1st Semester',
    '3-2': '3rd Year · 2nd Semester',
    '4-1': '4th Year · 1st Semester',
    '4-2': '4th Year · 2nd Semester',
  };
  return map[label] || label;
}

// ── Render Semesters Grid ──
function renderSemesters() {
  const grid  = document.getElementById('semesters-grid');
  const empty = document.getElementById('empty-state');

  // Clear existing cards (but keep empty state node)
  Array.from(grid.querySelectorAll('.semester-card')).forEach(el => el.remove());

  if (!semesters.length) {
    empty.style.display = '';
    updateHero();
    return;
  }

  empty.style.display = 'none';

  semesters.forEach(sem => {
    const card = buildSemesterCard(sem);
    grid.appendChild(card);
  });

  updateHero();
}

function buildSemesterCard(sem) {
  const sgpa = computeSGPA(sem.subjects);
  const totalCred = sem.subjects.reduce((a, s) => (!s.credits ? a : a + Number(s.credits)), 0);

  const card = document.createElement('div');
  card.className = 'semester-card';
  card.dataset.id = sem.id;

  card.innerHTML = `
    <div class="semester-card-header" role="button" tabindex="0" aria-expanded="false" aria-controls="body-${sem.id}">
      <div class="semester-info">
        <span class="semester-label-badge">${sem.label}</span>
        <div class="semester-meta">
          <p class="semester-name">${semesterFullName(sem.label)}</p>
          <p class="semester-sub">${sem.subjects.length} subjects · ${totalCred} credits</p>
        </div>
      </div>
      <div class="semester-right">
        <div>
          <p class="semester-sgpa">${sgpa !== null ? sgpa.toFixed(2) : '—'}</p>
          <p class="semester-sgpa-label">SGPA</p>
        </div>
        <svg class="chevron" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
      </div>
    </div>
    <div class="semester-body" id="body-${sem.id}">
      <div class="semester-body-inner">
        ${buildSubjectTableHTML(sem)}
        <div class="semester-actions">
          <button class="btn-secondary add-subject-btn" data-id="${sem.id}" aria-label="Add subject to ${sem.label}">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z"/></svg>
            Add Subject
          </button>
          <button class="btn-ghost delete-sem-btn" data-id="${sem.id}" aria-label="Delete semester ${sem.label}" style="color:#EF4444; border-color:#FCA5A5;">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style="width:15px;height:15px;margin-right:5px;"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
            Delete Semester
          </button>
        </div>
      </div>
    </div>
  `;

  // Toggle expand
  const header = card.querySelector('.semester-card-header');
  const body   = card.querySelector('.semester-body');
  header.addEventListener('click', () => toggleCard(card, header, body));
  header.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCard(card, header, body); }
  });

  // Delete semester
  card.querySelector('.delete-sem-btn').addEventListener('click', e => {
    e.stopPropagation();
    deleteSemester(sem.id);
  });

  // Add subject
  card.querySelector('.add-subject-btn').addEventListener('click', e => {
    e.stopPropagation();
    addSubjectToSemester(sem.id, card);
  });

  // Live edit on subject table
  bindSubjectTableEvents(card, sem.id);

  return card;
}

function toggleCard(card, header, body) {
  const expanded = card.classList.toggle('expanded');
  header.setAttribute('aria-expanded', expanded);
}

function buildSubjectTableHTML(sem) {
  const rows = sem.subjects.map((s, i) => buildSubjectRowHTML(s, i, sem.id)).join('');
  const sgpa = computeSGPA(sem.subjects);
  const totalCred = sem.subjects.reduce((a, s) => {
    const gp = gpForSubject(s);
    return (gp === null || !s.credits) ? a : a + Number(s.credits);
  }, 0);
  const weightedSum = sem.subjects.reduce((a, s) => {
    const gp = gpForSubject(s);
    return (gp === null || !s.credits) ? a : a + Number(s.credits) * gp;
  }, 0);

  return `
    <table class="subject-table" aria-label="Subjects for ${sem.label}">
      <thead>
        <tr>
          <th class="num-cell">#</th>
          <th>Subject Name</th>
          <th>Credits</th>
          <th>Grade</th>
          <th style="text-align:center;">Grade Points</th>
          <th aria-label="Delete"></th>
        </tr>
      </thead>
      <tbody class="sem-tbody" data-id="${sem.id}">${rows}</tbody>
      <tfoot>
        <tr>
          <td></td>
          <td><strong>Total</strong></td>
          <td><strong>${totalCred}</strong></td>
          <td></td>
          <td class="grade-points-cell"><strong>${weightedSum}</strong></td>
          <td class="sgpa-result-cell"><strong>${sgpa !== null ? sgpa.toFixed(2) : '—'}</strong></td>
        </tr>
      </tfoot>
    </table>
  `;
}

function buildSubjectRowHTML(subject, idx, semId) {
  const gradeOpts = GRADE_OPTIONS.map(g =>
    `<option value="${g}" ${subject.grade === g ? 'selected' : ''}>${g}</option>`
  ).join('');
  const creditOpts = CREDIT_OPTIONS.map(c =>
    `<option value="${c}" ${Number(subject.credits) === c ? 'selected' : ''}>${c}</option>`
  ).join('');
  const gp = gpForSubject(subject);
  const gpDisplay = subject.grade === 'Completed'
    ? '✔ N/A'
    : (gp !== null && subject.credits ? Number(subject.credits) * gp : '—');

  return `
    <tr data-row="${idx}">
      <td class="num-cell">${idx + 1}</td>
      <td>
        <input class="tbl-input subject-name-input" type="text" value="${escapeHtml(subject.name || '')}"
          placeholder="Subject name" aria-label="Subject ${idx + 1} name" data-semid="${semId}" data-rowindex="${idx}" />
      </td>
      <td>
        <select class="tbl-select subject-credits-select" aria-label="Credits for subject ${idx + 1}" data-semid="${semId}" data-rowindex="${idx}">
          ${creditOpts}
        </select>
      </td>
      <td>
        <select class="tbl-select subject-grade-select" aria-label="Grade for subject ${idx + 1}" data-semid="${semId}" data-rowindex="${idx}">
          ${gradeOpts}
        </select>
      </td>
      <td class="grade-points-cell">${gpDisplay}</td>
      <td>
        <button class="btn-danger-icon delete-subject-btn" aria-label="Delete subject ${idx + 1}" data-semid="${semId}" data-rowindex="${idx}">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        </button>
      </td>
    </tr>
  `;
}

function bindSubjectTableEvents(card, semId) {
  const tbody = card.querySelector('.sem-tbody');
  if (!tbody) return;

  // Name input
  tbody.addEventListener('input', e => {
    if (e.target.classList.contains('subject-name-input')) {
      const idx = Number(e.target.dataset.rowindex);
      const sem = semesters.find(s => s.id === semId);
      if (sem && sem.subjects[idx] !== undefined) {
        sem.subjects[idx].name = e.target.value;
        saveState();
        refreshCardFooter(card, semId);
        updateHero();
      }
    }
  });

  // Credits / Grade select
  tbody.addEventListener('change', e => {
    const idx = Number(e.target.dataset.rowindex);
    const sem = semesters.find(s => s.id === semId);
    if (!sem || sem.subjects[idx] === undefined) return;

    if (e.target.classList.contains('subject-credits-select')) {
      sem.subjects[idx].credits = Number(e.target.value);
    } else if (e.target.classList.contains('subject-grade-select')) {
      sem.subjects[idx].grade = e.target.value;
    }
    saveState();
    refreshCardRow(card, semId, idx);
    refreshCardFooter(card, semId);
    updateHero();
  });

  // Delete subject
  tbody.addEventListener('click', e => {
    const btn = e.target.closest('.delete-subject-btn');
    if (!btn) return;
    const idx = Number(btn.dataset.rowindex);
    const sem = semesters.find(s => s.id === semId);
    if (!sem) return;
    sem.subjects.splice(idx, 1);
    saveState();
    rebuildCardTable(card, semId);
    updateHero();
    showToast('Subject removed');
  });
}

function refreshCardRow(card, semId, rowIndex) {
  const sem = semesters.find(s => s.id === semId);
  if (!sem) return;
  const subject = sem.subjects[rowIndex];
  const gp = gpForSubject(subject);
  const gpDisplay = subject.grade === 'Completed'
    ? '✔ N/A'
    : (gp !== null && subject.credits ? Number(subject.credits) * gp : '—');
  const row = card.querySelector(`.sem-tbody tr[data-row="${rowIndex}"]`);
  if (row) {
    const gpCell = row.querySelectorAll('td')[4];
    if (gpCell) gpCell.textContent = gpDisplay;
  }
}

function refreshCardFooter(card, semId) {
  const sem = semesters.find(s => s.id === semId);
  if (!sem) return;
  const sgpa = computeSGPA(sem.subjects);
  const totalCred = sem.subjects.reduce((a, s) => {
    const gp = gpForSubject(s);
    return (gp === null || !s.credits) ? a : a + Number(s.credits);
  }, 0);
  const weightedSum = sem.subjects.reduce((a, s) => {
    const gp = gpForSubject(s);
    return (gp === null || !s.credits) ? a : a + Number(s.credits) * gp;
  }, 0);
  const tfoot = card.querySelector('tfoot');
  if (tfoot) {
    const tds = tfoot.querySelectorAll('td');
    if (tds[2]) tds[2].innerHTML = `<strong>${totalCred}</strong>`;
    if (tds[4]) tds[4].innerHTML = `<strong>${weightedSum}</strong>`;
    if (tds[5]) tds[5].innerHTML = `<strong>${sgpa !== null ? sgpa.toFixed(2) : '—'}</strong>`;
  }
  // Update header SGPA
  const sgpaEl = card.querySelector('.semester-sgpa');
  if (sgpaEl) sgpaEl.textContent = sgpa !== null ? sgpa.toFixed(2) : '—';
  // Update subtitle
  const subEl = card.querySelector('.semester-sub');
  if (subEl) subEl.textContent = `${sem.subjects.length} subjects · ${totalCred} credits`;
}

function rebuildCardTable(card, semId) {
  const sem = semesters.find(s => s.id === semId);
  if (!sem) return;
  const tableWrap = card.querySelector('.semester-body-inner');
  const table = tableWrap.querySelector('.subject-table');
  if (table) {
    const newTable = document.createElement('div');
    newTable.innerHTML = buildSubjectTableHTML(sem);
    table.replaceWith(newTable.firstElementChild);
    bindSubjectTableEvents(card, semId);
  }
  refreshCardFooter(card, semId);
}

function addSubjectToSemester(semId, card) {
  const sem = semesters.find(s => s.id === semId);
  if (!sem) return;
  sem.subjects.push({ name: '', credits: 3, grade: 'S' });
  saveState();
  rebuildCardTable(card, semId);
  updateHero();
  // Expand if not expanded
  if (!card.classList.contains('expanded')) {
    const header = card.querySelector('.semester-card-header');
    const body = card.querySelector('.semester-body');
    toggleCard(card, header, body);
  }
}

function deleteSemester(semId) {
  const idx = semesters.findIndex(s => s.id === semId);
  if (idx === -1) return;
  semesters.splice(idx, 1);
  saveState();
  renderSemesters();
  showToast('Semester deleted');
}

// ── Modal Logic ──
const modalOverlay = document.getElementById('modal-overlay');
const modalSubjectTable = document.getElementById('modal-tbody');
const modalSubmitBtn = document.getElementById('modal-submit');
const modalSGPAPreview = document.getElementById('modal-sgpa-preview');

let modalSubjects = [];

function openModal() {
  modalOverlay.removeAttribute('hidden');
  document.getElementById('semester-select').value = '';
  modalSubjects = Array.from({ length: 10 }, () => ({ name: '', credits: 3, grade: 'S' }));
  renderModalRows();
  validateModal();
  document.getElementById('semester-select').focus();
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.setAttribute('hidden', '');
  document.body.style.overflow = '';
}

function renderModalRows() {
  modalSubjectTable.innerHTML = modalSubjects.map((s, i) => buildModalRowHTML(s, i)).join('');
  updateModalSGPA();
}

function buildModalRowHTML(s, i) {
  const gradeOpts = GRADE_OPTIONS.map(g =>
    `<option value="${g}" ${s.grade === g ? 'selected' : ''}>${g}</option>`
  ).join('');
  const creditOpts = CREDIT_OPTIONS.map(c =>
    `<option value="${c}" ${Number(s.credits) === c ? 'selected' : ''}>${c}</option>`
  ).join('');
  const gp = gpForSubject(s);
  const gpDisplay = s.grade === 'Completed'
    ? '✔ N/A'
    : (gp !== null && s.credits ? Number(s.credits) * gp : '—');

  return `
    <tr data-modal-row="${i}">
      <td class="num-cell">${i + 1}</td>
      <td>
        <input class="tbl-input modal-subject-name" type="text" value="${escapeHtml(s.name || '')}"
          placeholder="Subject name" aria-label="Subject ${i+1} name" data-modal-rowindex="${i}" />
      </td>
      <td>
        <select class="tbl-select modal-subject-credits" aria-label="Credits for subject ${i+1}" data-modal-rowindex="${i}">
          ${creditOpts}
        </select>
      </td>
      <td>
        <select class="tbl-select modal-subject-grade" aria-label="Grade for subject ${i+1}" data-modal-rowindex="${i}">
          ${gradeOpts}
        </select>
      </td>
      <td class="grade-points-cell modal-gp-cell">${gpDisplay}</td>
      <td>
        <button class="btn-danger-icon modal-delete-row" aria-label="Delete row ${i+1}" data-modal-rowindex="${i}">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        </button>
      </td>
    </tr>
  `;
}

function updateModalSGPA() {
  const sgpa = computeSGPA(modalSubjects);
  modalSGPAPreview.textContent = sgpa !== null ? sgpa.toFixed(2) : '—';
}

function validateModal() {
  const semesterVal = document.getElementById('semester-select').value;
  const hasValid = modalSubjects.some(s => s.name.trim() && s.grade);
  const alreadyExists = semesters.some(s => s.label === semesterVal);

  const valid = semesterVal && hasValid && !alreadyExists;
  modalSubmitBtn.disabled = !valid;
  modalSubmitBtn.setAttribute('aria-disabled', !valid);
}

// Modal events
document.getElementById('semester-select').addEventListener('change', () => {
  const val = document.getElementById('semester-select').value;
  const alreadyExists = semesters.some(s => s.label === val);
  if (alreadyExists && val) {
    showToast('⚠️ Semester already added!');
    document.getElementById('semester-select').value = '';
  }
  validateModal();
});

document.getElementById('modal-tbody').addEventListener('input', e => {
  if (e.target.classList.contains('modal-subject-name')) {
    const idx = Number(e.target.dataset.modalRowindex);
    modalSubjects[idx].name = e.target.value;
    validateModal();
  }
});

document.getElementById('modal-tbody').addEventListener('change', e => {
  const idx = Number(e.target.dataset.modalRowindex);
  if (e.target.classList.contains('modal-subject-credits')) {
    modalSubjects[idx].credits = Number(e.target.value);
  } else if (e.target.classList.contains('modal-subject-grade')) {
    modalSubjects[idx].grade = e.target.value;
  }
  // Update GP cell
  const row = document.querySelector(`tr[data-modal-row="${idx}"]`);
  if (row) {
    const sub = modalSubjects[idx];
    const gp  = gpForSubject(sub);
    const gpCell = row.querySelector('.modal-gp-cell');
    if (gpCell) gpCell.textContent = sub.grade === 'Completed'
      ? '✔ N/A'
      : (gp !== null && sub.credits ? Number(sub.credits) * gp : '—');
  }
  updateModalSGPA();
  validateModal();
});

document.getElementById('modal-tbody').addEventListener('click', e => {
  const btn = e.target.closest('.modal-delete-row');
  if (!btn) return;
  const idx = Number(btn.dataset.modalRowindex);
  modalSubjects.splice(idx, 1);
  renderModalRows();
  validateModal();
});

document.getElementById('modal-add-row').addEventListener('click', () => {
  modalSubjects.push({ name: '', credits: 3, grade: 'S' });
  renderModalRows();
  validateModal();
});

document.getElementById('modal-submit').addEventListener('click', () => {
  const label = document.getElementById('semester-select').value;
  if (!label) return;

  const cleanSubjects = modalSubjects.filter(s => s.name.trim());
  semesters.push({
    id: Date.now().toString(),
    label,
    subjects: cleanSubjects.map(s => ({ ...s })),
  });
  saveState();
  closeModal();
  renderSemesters();
  showToast(`✅ Semester ${label} added!`);
});

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('add-semester-btn').addEventListener('click', openModal);

modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ── Toast ──
function showToast(msg, duration = 2800) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ── Theme Toggle ──
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('edugrade-theme', theme);
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ── Utility ──
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ──
function init() {
  const savedTheme = localStorage.getItem('edugrade-theme') || 'light';
  applyTheme(savedTheme);
  loadState();
  renderSemesters();
}

init();
