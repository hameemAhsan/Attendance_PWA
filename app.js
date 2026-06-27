/* Attendance Ledger PWA
   Local-first attendance tracker: no server, no database hosting.
   Stores data in localStorage. Export JSON backup regularly.
*/

const STORE_KEY = 'attendance-ledger-pwa-v1';
const SESSION_KEY = 'attendance-ledger-session';
const DEFAULT_PASSWORD = 'teacher123';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const nowISO = () => new Date().toISOString();
const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const slug = (value = '') => String(value).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 32);

const blankData = () => ({
  version: 1,
  settings: {
    teacherPassword: DEFAULT_PASSWORD,
    institutionName: 'Your Institution',
    defaultAcademicSession: new Date().getFullYear().toString(),
    defaultAbsentStatus: 'AR'
  },
  courseOfferings: [],
  students: [],
  attendanceSessions: [],
  attendanceRecords: []
});

let data = loadData();
let session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') || { mode: null, route: 'login', courseId: null };
let selectedCourseId = data.courseOfferings[0]?.id || null;
let pendingImportRows = [];
let deferredInstallPrompt = null;

function loadData() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return seedData(blankData());
    const parsed = JSON.parse(raw);
    return migrateData(parsed);
  } catch (err) {
    console.error(err);
    return seedData(blankData());
  }
}

function migrateData(db) {
  const base = blankData();
  return {
    ...base,
    ...db,
    settings: { ...base.settings, ...(db.settings || {}) },
    courseOfferings: Array.isArray(db.courseOfferings) ? db.courseOfferings : [],
    students: Array.isArray(db.students) ? db.students : [],
    attendanceSessions: Array.isArray(db.attendanceSessions) ? db.attendanceSessions : [],
    attendanceRecords: Array.isArray(db.attendanceRecords) ? db.attendanceRecords : []
  };
}

function seedData(db) {
  if (db.courseOfferings.length) return db;
  const course = {
    id: uid('course'),
    department: 'Mathematics',
    academicYear: '1st Year',
    section: 'A',
    courseCode: 'MATH-101',
    courseName: 'Calculus I',
    academicSession: new Date().getFullYear().toString(),
    viewCode: 'MATH101-A-' + new Date().getFullYear(),
    createdAt: nowISO(),
    updatedAt: nowISO()
  };
  db.courseOfferings.push(course);
  const samples = [
    ['101', 'Sample Student One'],
    ['102', 'Sample Student Two'],
    ['103', 'Sample Student Three']
  ];
  for (const [rollNumber, studentName] of samples) {
    db.students.push({
      id: uid('student'), courseOfferingId: course.id, rollNumber, studentName,
      studentId: '', phone: '', email: '', remarks: '', createdAt: nowISO(), updatedAt: nowISO()
    });
  }
  return db;
}

function saveData() {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

function saveSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}

function routeTo(route, extra = {}) {
  session = { ...session, route, ...extra };
  saveSession();
  render();
}

function activeCourse() {
  return data.courseOfferings.find(c => c.id === selectedCourseId) || data.courseOfferings[0] || null;
}

function courseById(id) { return data.courseOfferings.find(c => c.id === id) || null; }
function studentsForCourse(courseId) {
  return data.students
    .filter(s => s.courseOfferingId === courseId)
    .sort((a, b) => naturalCompare(a.rollNumber, b.rollNumber));
}
function sessionsForCourse(courseId) {
  return data.attendanceSessions
    .filter(s => s.courseOfferingId === courseId)
    .sort((a, b) => (a.attendanceDate + ':' + (a.classNo || '')).localeCompare(b.attendanceDate + ':' + (b.classNo || '')));
}
function recordsForSession(sessionId) { return data.attendanceRecords.filter(r => r.attendanceSessionId === sessionId); }
function naturalCompare(a, b) { return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' }); }

function statusLabel(status) {
  return { P: 'Present', AI: 'Informed/Application', AR: 'Random Absent' }[status] || 'Random Absent';
}
function statusBadge(status) {
  const cls = status === 'P' ? 'good' : status === 'AI' ? 'warn' : 'bad';
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}
function courseLabel(course) {
  if (!course) return 'No course selected';
  return `${course.courseCode} · ${course.courseName} · ${course.academicYear} · Section ${course.section}`;
}
function courseMeta(course) {
  if (!course) return '';
  return `${course.department} · ${course.academicSession} · View code: ${course.viewCode}`;
}
function getCourseOptions(selectedId = selectedCourseId) {
  if (!data.courseOfferings.length) return '<option value="">No course offering yet</option>';
  return data.courseOfferings.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${escapeHtml(courseLabel(c))}</option>`).join('');
}

function summarizeCourse(courseId) {
  const students = studentsForCourse(courseId);
  const sessions = sessionsForCourse(courseId);
  const present = {}, ai = {}, ar = {};
  for (const student of students) { present[student.id] = 0; ai[student.id] = 0; ar[student.id] = 0; }
  for (const s of sessions) {
    const recs = recordsForSession(s.id);
    for (const student of students) {
      const rec = recs.find(r => r.studentId === student.id);
      const status = rec?.status || 'AR';
      if (status === 'P') present[student.id] += 1;
      else if (status === 'AI') ai[student.id] += 1;
      else ar[student.id] += 1;
    }
  }
  return { students, sessions, present, ai, ar, totalClasses: sessions.length };
}

function render() {
  const main = $('#main');
  const nav = $('#bottomNav');
  const logoutBtn = $('#logoutBtn');
  const isTeacher = session.mode === 'teacher';
  const isStudent = session.mode === 'student';

  logoutBtn.hidden = !session.mode;
  nav.hidden = !isTeacher;
  $$('#bottomNav button').forEach(btn => btn.classList.toggle('active', btn.dataset.route === session.route));

  if (!session.mode || session.route === 'login') {
    main.innerHTML = renderLogin();
    bindLogin();
    return;
  }

  if (isStudent) {
    main.innerHTML = renderStudentView(session.courseId);
    bindStudentView();
    return;
  }

  const route = session.route || 'dashboard';
  if (route === 'dashboard') main.innerHTML = renderDashboard();
  else if (route === 'setup') main.innerHTML = renderSetup();
  else if (route === 'import') main.innerHTML = renderImport();
  else if (route === 'take') main.innerHTML = renderTakeAttendance();
  else if (route === 'sheet') main.innerHTML = renderSheet();
  else if (route === 'export') main.innerHTML = renderExport();
  else if (route === 'settings') main.innerHTML = renderSettings();
  else main.innerHTML = renderDashboard();

  bindRoute(route);
}

function renderLogin() {
  return `
    <section class="login-layout">
      <div class="card">
        <p class="eyebrow">Attendance system</p>
        <h2>Teacher-led attendance without server hosting</h2>
        <p>This app stores data locally in the browser. Teachers can take attendance, export Excel files, generate student-view HTML files, and export static JSON for GitHub Pages student viewing.</p>
        <div class="notice warn"><b>Important:</b> No server means no automatic live sync. Export/share or upload public JSON when students need updated records.</div>
        <div class="stat-grid" style="margin-top:14px">
          <div class="stat"><span>Courses</span><b>${data.courseOfferings.length}</b></div>
          <div class="stat"><span>Students</span><b>${data.students.length}</b></div>
          <div class="stat"><span>Classes</span><b>${data.attendanceSessions.length}</b></div>
          <div class="stat"><span>Records</span><b>${data.attendanceRecords.length}</b></div>
        </div>
      </div>
      <div class="card">
        <h2>Login</h2>
        <div class="mode-pill" role="tablist">
          <button id="teacherModeBtn" class="active" type="button">Teacher</button>
          <button id="studentModeBtn" type="button">Student code</button>
        </div>
        <form id="teacherLoginForm" class="grid" style="margin-top:14px">
          <label>Teacher password
            <input type="password" id="teacherPassword" placeholder="Default: teacher123" autocomplete="current-password" />
          </label>
          <button type="submit">Enter Teacher Dashboard</button>
        </form>
        <form id="studentLoginForm" class="grid hidden" style="margin-top:14px">
          <label>Course view code
            <input type="text" id="studentCode" placeholder="Example: MATH101-A-2026" autocomplete="off" />
          </label>
          <button type="submit">View Attendance Sheet</button>
        </form>
        <p class="item-sub">Default teacher password is <span class="kbd">teacher123</span>. Change it in Settings.</p>
      </div>
    </section>`;
}

function bindLogin() {
  const teacherForm = $('#teacherLoginForm');
  const studentForm = $('#studentLoginForm');
  $('#teacherModeBtn').addEventListener('click', () => {
    $('#teacherModeBtn').classList.add('active'); $('#studentModeBtn').classList.remove('active');
    teacherForm.classList.remove('hidden'); studentForm.classList.add('hidden');
  });
  $('#studentModeBtn').addEventListener('click', () => {
    $('#studentModeBtn').classList.add('active'); $('#teacherModeBtn').classList.remove('active');
    studentForm.classList.remove('hidden'); teacherForm.classList.add('hidden');
  });
  teacherForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if ($('#teacherPassword').value === data.settings.teacherPassword) {
      session = { mode: 'teacher', route: 'dashboard', courseId: null };
      saveSession(); toast('Teacher login successful'); render();
    } else toast('Wrong teacher password');
  });
  studentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#studentCode').value.trim().toUpperCase();
    const course = data.courseOfferings.find(c => String(c.viewCode).toUpperCase() === code);
    if (!course) return toast('No attendance sheet found for that code');
    session = { mode: 'student', route: 'student', courseId: course.id };
    saveSession(); render();
  });
}

function renderDashboard() {
  const c = activeCourse();
  const summary = c ? summarizeCourse(c.id) : null;
  const totalStudents = c ? summary.students.length : 0;
  const totalClasses = c ? summary.totalClasses : 0;
  const recentSessions = c ? sessionsForCourse(c.id).slice(-5).reverse() : [];
  return `
    <section class="card">
      <p class="eyebrow">Dashboard</p>
      <h2>${escapeHtml(data.settings.institutionName)}</h2>
      <div class="form-grid">
        <label>Active course offering
          <select id="activeCourseSelect">${getCourseOptions(c?.id)}</select>
        </label>
        <label>Student view code
          <input readonly value="${escapeHtml(c?.viewCode || '')}" />
        </label>
      </div>
      <div class="stat-grid" style="margin-top:14px">
        <div class="stat"><span>Students</span><b>${totalStudents}</b></div>
        <div class="stat"><span>Classes taken</span><b>${totalClasses}</b></div>
        <div class="stat"><span>All courses</span><b>${data.courseOfferings.length}</b></div>
        <div class="stat"><span>Total records</span><b>${data.attendanceRecords.length}</b></div>
      </div>
      <div class="actions">
        <button data-go="take">Take Attendance</button>
        <button class="soft" data-go="sheet">View Sheet</button>
        <button class="ghost" data-go="import">Import Students</button>
        <button class="ghost" data-go="export">Export</button>
      </div>
    </section>

    <section class="grid two">
      <div class="card">
        <h3>Active Course</h3>
        ${c ? `<div class="item"><div><div class="item-title">${escapeHtml(courseLabel(c))}</div><div class="item-sub">${escapeHtml(courseMeta(c))}</div></div></div>` : '<p>No course yet.</p>'}
      </div>
      <div class="card">
        <h3>Recent Attendance Dates</h3>
        <div class="list">
          ${recentSessions.length ? recentSessions.map(s => `<div class="item"><div><div class="item-title">${escapeHtml(s.attendanceDate)} ${s.classNo ? '· Class ' + escapeHtml(s.classNo) : ''}</div><div class="item-sub">${escapeHtml(s.remarks || 'No remarks')}</div></div><span class="badge info">Saved</span></div>`).join('') : '<p>No attendance taken yet.</p>'}
        </div>
      </div>
    </section>`;
}

function bindCommon() {
  const active = $('#activeCourseSelect');
  if (active) active.addEventListener('change', e => { selectedCourseId = e.target.value; render(); });
  $$('[data-go]').forEach(btn => btn.addEventListener('click', () => routeTo(btn.dataset.go)));
}

function renderSetup() {
  return `
    <section class="card">
      <p class="eyebrow">Academic setup</p>
      <h2>Create Course Offering</h2>
      <p>A course offering is a specific attendance sheet: Department + Year + Section + Course Code + Course Name + Session.</p>
      <form id="courseForm" class="form-grid">
        <label>Department <input id="department" required placeholder="Mathematics" /></label>
        <label>Year <input id="academicYear" required placeholder="1st Year" /></label>
        <label>Section <input id="section" required placeholder="A" /></label>
        <label>Academic Session / Batch <input id="academicSession" required value="${escapeHtml(data.settings.defaultAcademicSession)}" /></label>
        <label>Course Code <input id="courseCode" required placeholder="MATH-101" /></label>
        <label>Course Name <input id="courseName" required placeholder="Calculus I" /></label>
        <label>Student View Code <input id="viewCode" placeholder="Auto generated if blank" /></label>
        <div class="actions"><button type="submit">Create Course Offering</button></div>
      </form>
    </section>

    <section class="card">
      <h2>Existing Course Offerings</h2>
      <div class="list">
        ${data.courseOfferings.length ? data.courseOfferings.map(c => `
          <div class="item">
            <div>
              <div class="item-title">${escapeHtml(courseLabel(c))}</div>
              <div class="item-sub">${escapeHtml(courseMeta(c))}</div>
              <div class="item-sub">Students: ${studentsForCourse(c.id).length} · Classes: ${sessionsForCourse(c.id).length}</div>
            </div>
            <div class="actions" style="margin:0">
              <button class="small soft" data-select-course="${c.id}">Use</button>
              <button class="small ghost" data-copy-code="${escapeHtml(c.viewCode)}">Copy code</button>
              <button class="small danger" data-delete-course="${c.id}">Delete</button>
            </div>
          </div>`).join('') : '<p>No course offering yet.</p>'}
      </div>
    </section>`;
}

function bindSetup() {
  bindCommon();
  $('#courseForm').addEventListener('submit', e => {
    e.preventDefault();
    const department = $('#department').value.trim();
    const academicYear = $('#academicYear').value.trim();
    const section = $('#section').value.trim();
    const academicSession = $('#academicSession').value.trim();
    const courseCode = $('#courseCode').value.trim();
    const courseName = $('#courseName').value.trim();
    const viewCode = ($('#viewCode').value.trim() || `${slug(courseCode)}-${slug(section)}-${slug(academicSession)}`).toUpperCase();
    if (data.courseOfferings.some(c => c.viewCode.toUpperCase() === viewCode)) return toast('View code already exists. Use another code.');
    const course = { id: uid('course'), department, academicYear, section, courseCode, courseName, academicSession, viewCode, createdAt: nowISO(), updatedAt: nowISO() };
    data.courseOfferings.push(course); selectedCourseId = course.id; saveData(); toast('Course offering created'); render();
  });
  $$('[data-select-course]').forEach(btn => btn.addEventListener('click', () => { selectedCourseId = btn.dataset.selectCourse; toast('Course selected'); render(); }));
  $$('[data-copy-code]').forEach(btn => btn.addEventListener('click', async () => { await navigator.clipboard?.writeText(btn.dataset.copyCode); toast('View code copied'); }));
  $$('[data-delete-course]').forEach(btn => btn.addEventListener('click', () => deleteCourse(btn.dataset.deleteCourse)));
}

function deleteCourse(courseId) {
  const course = courseById(courseId);
  if (!course) return;
  const countStudents = studentsForCourse(courseId).length;
  const countSessions = sessionsForCourse(courseId).length;
  if (!confirm(`Delete ${course.courseCode}? This removes ${countStudents} students and ${countSessions} attendance dates for this course from local data.`)) return;
  const sessionIds = data.attendanceSessions.filter(s => s.courseOfferingId === courseId).map(s => s.id);
  const studentIds = data.students.filter(s => s.courseOfferingId === courseId).map(s => s.id);
  data.attendanceRecords = data.attendanceRecords.filter(r => !sessionIds.includes(r.attendanceSessionId) && !studentIds.includes(r.studentId));
  data.attendanceSessions = data.attendanceSessions.filter(s => s.courseOfferingId !== courseId);
  data.students = data.students.filter(s => s.courseOfferingId !== courseId);
  data.courseOfferings = data.courseOfferings.filter(c => c.id !== courseId);
  selectedCourseId = data.courseOfferings[0]?.id || null;
  saveData(); toast('Course deleted'); render();
}

function renderImport() {
  const c = activeCourse();
  return `
    <section class="card">
      <p class="eyebrow">Student import</p>
      <h2>Import Roll Numbers and Students</h2>
      <div class="notice">Use CSV for no-server reliability. Download the template, fill it in Excel, then save/upload as CSV.</div>
      <div class="form-grid" style="margin-top:14px">
        <label>Target course offering
          <select id="activeCourseSelect">${getCourseOptions(c?.id)}</select>
        </label>
        <label>CSV file
          <input type="file" id="studentFile" accept=".csv,text/csv" />
        </label>
      </div>
      <div class="actions">
        <button id="downloadTemplate" class="soft">Download CSV Template</button>
        <button id="previewImport" disabled>Preview Import</button>
        <button id="confirmImport" class="success" disabled>Confirm Import</button>
      </div>
      <p class="item-sub">Required columns: <span class="kbd">roll_number</span>, <span class="kbd">student_name</span>. Optional: student_id, phone, email, remarks.</p>
    </section>
    <section class="card">
      <h2>Preview</h2>
      <div id="importSummary" class="notice warn">Upload a CSV file to preview rows before saving.</div>
      <div id="importPreview" class="preview-box" style="margin-top:12px"></div>
    </section>`;
}

function bindImport() {
  bindCommon();
  const file = $('#studentFile');
  const previewBtn = $('#previewImport');
  file.addEventListener('change', () => { previewBtn.disabled = !file.files.length; pendingImportRows = []; $('#confirmImport').disabled = true; });
  $('#downloadTemplate').addEventListener('click', () => {
    downloadText('student_import_template.csv', 'roll_number,student_name,student_id,phone,email,remarks\n101,Student Name,ID001,01XXXXXXXXX,student@example.com,Optional note\n', 'text/csv;charset=utf-8');
  });
  previewBtn.addEventListener('click', async () => {
    const course = activeCourse();
    if (!course) return toast('Create/select a course first');
    const text = await file.files[0].text();
    const rows = parseCSV(text);
    const parsed = normalizeStudentRows(rows);
    pendingImportRows = parsed.valid;
    $('#importSummary').className = parsed.errors.length ? 'notice warn' : 'notice good';
    $('#importSummary').innerHTML = `<b>Rows found:</b> ${parsed.total}. <b>Valid:</b> ${parsed.valid.length}. <b>Problems:</b> ${parsed.errors.length}.`;
    $('#importPreview').innerHTML = renderImportPreview(parsed);
    $('#confirmImport').disabled = !pendingImportRows.length;
  });
  $('#confirmImport').addEventListener('click', () => {
    const course = activeCourse();
    if (!course || !pendingImportRows.length) return;
    const existingRolls = new Set(studentsForCourse(course.id).map(s => String(s.rollNumber).trim().toLowerCase()));
    let added = 0, updated = 0;
    for (const row of pendingImportRows) {
      const match = data.students.find(s => s.courseOfferingId === course.id && String(s.rollNumber).trim().toLowerCase() === String(row.rollNumber).trim().toLowerCase());
      if (match) {
        Object.assign(match, row, { updatedAt: nowISO() }); updated++;
      } else {
        data.students.push({ id: uid('student'), courseOfferingId: course.id, ...row, createdAt: nowISO(), updatedAt: nowISO() }); added++;
      }
      existingRolls.add(String(row.rollNumber).trim().toLowerCase());
    }
    saveData(); pendingImportRows = []; toast(`Import complete: ${added} added, ${updated} updated`); render();
  });
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quote && next === '"') { cell += '"'; i++; }
    else if (ch === '"') quote = !quote;
    else if (ch === ',' && !quote) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quote) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => String(v).trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(v => String(v).trim() !== '')) rows.push(row);
  return rows;
}

function normalizeStudentRows(rows) {
  if (!rows.length) return { total: 0, valid: [], errors: ['Empty file'] };
  const headers = rows[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_'));
  const idx = name => headers.indexOf(name);
  const rollI = idx('roll_number'); const nameI = idx('student_name');
  const out = { total: Math.max(0, rows.length - 1), valid: [], errors: [] };
  if (rollI < 0 || nameI < 0) { out.errors.push('Missing roll_number or student_name columns'); return out; }
  const seen = new Set();
  rows.slice(1).forEach((r, n) => {
    const rollNumber = (r[rollI] || '').trim();
    const studentName = (r[nameI] || '').trim();
    if (!rollNumber || !studentName) { out.errors.push(`Row ${n + 2}: missing roll/name`); return; }
    if (seen.has(rollNumber.toLowerCase())) { out.errors.push(`Row ${n + 2}: duplicate roll ${rollNumber}`); return; }
    seen.add(rollNumber.toLowerCase());
    out.valid.push({
      rollNumber, studentName,
      studentId: (r[idx('student_id')] || '').trim(), phone: (r[idx('phone')] || '').trim(),
      email: (r[idx('email')] || '').trim(), remarks: (r[idx('remarks')] || '').trim()
    });
  });
  return out;
}

function renderImportPreview(parsed) {
  if (!parsed.valid.length && !parsed.errors.length) return '<p>No rows found.</p>';
  return `
    ${parsed.errors.length ? `<div class="notice bad"><b>Problems</b><br>${parsed.errors.map(escapeHtml).join('<br>')}</div>` : ''}
    ${parsed.valid.length ? `<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Roll</th><th>Name</th><th>Student ID</th><th>Phone</th><th>Email</th></tr></thead><tbody>${parsed.valid.slice(0, 80).map(r => `<tr><td>${escapeHtml(r.rollNumber)}</td><td>${escapeHtml(r.studentName)}</td><td>${escapeHtml(r.studentId)}</td><td>${escapeHtml(r.phone)}</td><td>${escapeHtml(r.email)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
}

function renderTakeAttendance() {
  const c = activeCourse();
  const today = new Date().toISOString().slice(0, 10);
  const students = c ? studentsForCourse(c.id) : [];
  return `
    <section class="card">
      <p class="eyebrow">Take attendance</p>
      <h2>Mark attendance by date</h2>
      <div class="form-grid">
        <label>Course offering <select id="activeCourseSelect">${getCourseOptions(c?.id)}</select></label>
        <label>Date <input type="date" id="attendanceDate" value="${today}" /></label>
        <label>Class number / slot <input id="classNo" placeholder="1 or 2 if multiple classes same day" /></label>
        <label>Remarks <input id="sessionRemarks" placeholder="Optional class note" /></label>
      </div>
      <div class="actions">
        <button id="loadAttendance">Load Sheet</button>
        <button id="markAllPresent" class="soft">Mark All Present</button>
        <button id="markAllRandom" class="ghost">Reset to Random Absent</button>
        <button id="saveAttendance" class="success">Save Attendance</button>
      </div>
      <p class="item-sub">Default absence is Random Absent. Use AI for informed/application-submitted absence.</p>
    </section>
    <section class="card">
      <h2>${escapeHtml(c ? courseLabel(c) : 'No course selected')}</h2>
      ${students.length ? renderAttendanceMarkTable(students) : '<div class="notice warn">No students found. Import students first.</div>'}
    </section>`;
}

function renderAttendanceMarkTable(students) {
  return `<div class="table-wrap"><table id="attendanceTable"><thead><tr><th>Roll</th><th>Name</th><th>Status</th><th>Remarks</th></tr></thead><tbody>
    ${students.map(s => `<tr data-student-id="${s.id}"><td>${escapeHtml(s.rollNumber)}</td><td>${escapeHtml(s.studentName)}</td><td>${renderStatusButtons('AR')}</td><td><input class="record-remarks" placeholder="Optional" /></td></tr>`).join('')}
  </tbody></table></div>`;
}
function renderStatusButtons(selected) {
  return `<div class="status-group">
    <button type="button" class="${selected === 'P' ? 'selected good' : ''}" data-status="P">P</button>
    <button type="button" class="${selected === 'AI' ? 'selected warn' : ''}" data-status="AI">AI</button>
    <button type="button" class="${selected === 'AR' ? 'selected bad' : ''}" data-status="AR">AR</button>
  </div>`;
}
function bindTakeAttendance() {
  bindCommon();
  $('#attendanceTable')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-status]'); if (!btn) return;
    const group = btn.parentElement;
    group.querySelectorAll('button').forEach(b => b.className = '');
    const status = btn.dataset.status;
    btn.classList.add('selected', status === 'P' ? 'good' : status === 'AI' ? 'warn' : 'bad');
  });
  $('#loadAttendance').addEventListener('click', loadAttendanceForDate);
  $('#markAllPresent').addEventListener('click', () => markAll('P'));
  $('#markAllRandom').addEventListener('click', () => markAll('AR'));
  $('#saveAttendance').addEventListener('click', saveAttendanceForDate);
}
function markAll(status) {
  $$('#attendanceTable tbody tr').forEach(row => setRowStatus(row, status));
}
function setRowStatus(row, status) {
  const group = $('.status-group', row);
  group.querySelectorAll('button').forEach(btn => {
    btn.className = '';
    if (btn.dataset.status === status) btn.classList.add('selected', status === 'P' ? 'good' : status === 'AI' ? 'warn' : 'bad');
  });
}
function getRowStatus(row) { return $('.status-group button.selected', row)?.dataset.status || 'AR'; }
function findSession(courseId, date, classNo) {
  return data.attendanceSessions.find(s => s.courseOfferingId === courseId && s.attendanceDate === date && String(s.classNo || '') === String(classNo || ''));
}
function loadAttendanceForDate() {
  const course = activeCourse(); if (!course) return toast('Select a course');
  const date = $('#attendanceDate').value; const classNo = $('#classNo').value.trim();
  const sess = findSession(course.id, date, classNo);
  $$('#attendanceTable tbody tr').forEach(row => { setRowStatus(row, 'AR'); $('.record-remarks', row).value = ''; });
  if (!sess) return toast('No previous attendance. New sheet loaded.');
  $('#sessionRemarks').value = sess.remarks || '';
  const recs = recordsForSession(sess.id);
  $$('#attendanceTable tbody tr').forEach(row => {
    const rec = recs.find(r => r.studentId === row.dataset.studentId);
    if (rec) { setRowStatus(row, rec.status); $('.record-remarks', row).value = rec.remarks || ''; }
  });
  toast('Existing attendance loaded for editing');
}
function saveAttendanceForDate() {
  const course = activeCourse(); if (!course) return toast('Select a course');
  const date = $('#attendanceDate').value; if (!date) return toast('Choose a date');
  const classNo = $('#classNo').value.trim();
  let sess = findSession(course.id, date, classNo);
  if (!sess) {
    sess = { id: uid('session'), courseOfferingId: course.id, attendanceDate: date, classNo, takenBy: 'teacher', remarks: $('#sessionRemarks').value.trim(), createdAt: nowISO(), updatedAt: nowISO() };
    data.attendanceSessions.push(sess);
  } else {
    sess.remarks = $('#sessionRemarks').value.trim(); sess.updatedAt = nowISO();
    data.attendanceRecords = data.attendanceRecords.filter(r => r.attendanceSessionId !== sess.id);
  }
  $$('#attendanceTable tbody tr').forEach(row => {
    data.attendanceRecords.push({
      id: uid('record'), attendanceSessionId: sess.id, studentId: row.dataset.studentId,
      status: getRowStatus(row), remarks: $('.record-remarks', row).value.trim(), createdAt: nowISO(), updatedAt: nowISO()
    });
  });
  saveData(); toast('Attendance saved');
}

function renderSheet(courseId = selectedCourseId, publicOnly = false) {
  const c = courseById(courseId) || activeCourse();
  if (!c) return '<section class="card"><h2>No course offering yet</h2></section>';
  const summary = summarizeCourse(c.id);
  return `
    <section class="card">
      <p class="eyebrow">Full attendance sheet</p>
      <h2>${escapeHtml(courseLabel(c))}</h2>
      <p>${escapeHtml(courseMeta(c))}</p>
      ${publicOnly ? '' : `<div class="form-grid"><label>Course offering <select id="activeCourseSelect">${getCourseOptions(c.id)}</select></label></div>
      <div class="actions"><button id="exportExcel" class="soft">Export Excel-compatible .xls</button><button id="exportCsv" class="ghost">Export CSV</button><button onclick="window.print()" class="ghost">Print</button></div>`}
      ${renderSheetTable(c.id)}
    </section>`;
}

function renderSheetTable(courseId) {
  const { students, sessions, present, ai, ar, totalClasses } = summarizeCourse(courseId);
  if (!students.length) return '<div class="notice warn">No students imported yet.</div>';
  if (!sessions.length) return '<div class="notice warn">No attendance sessions saved yet.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Roll</th><th>Name</th>${sessions.map(s => `<th>${escapeHtml(formatDateShort(s.attendanceDate))}${s.classNo ? '<br>Class ' + escapeHtml(s.classNo) : ''}</th>`).join('')}<th>Total P</th><th>AI</th><th>AR</th><th>Absent</th><th>%</th></tr></thead><tbody>
    ${students.map(student => {
      const cells = sessions.map(sess => {
        const rec = recordsForSession(sess.id).find(r => r.studentId === student.id);
        const status = rec?.status || 'AR';
        return `<td title="${escapeHtml(rec?.remarks || statusLabel(status))}">${statusBadge(status)}</td>`;
      }).join('');
      const absent = ai[student.id] + ar[student.id];
      const pct = totalClasses ? ((present[student.id] / totalClasses) * 100).toFixed(1) : '0.0';
      return `<tr><td>${escapeHtml(student.rollNumber)}</td><td>${escapeHtml(student.studentName)}</td>${cells}<td>${present[student.id]}</td><td>${ai[student.id]}</td><td>${ar[student.id]}</td><td>${absent}</td><td>${pct}%</td></tr>`;
    }).join('')}
  </tbody></table></div>`;
}
function formatDateShort(date) {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function bindSheet() {
  bindCommon();
  $('#exportExcel')?.addEventListener('click', () => exportExcel(activeCourse()?.id));
  $('#exportCsv')?.addEventListener('click', () => exportAttendanceCSV(activeCourse()?.id));
}

function renderStudentView(courseId) {
  const c = courseById(courseId);
  if (!c) return '<section class="card"><h2>Attendance sheet not found</h2></section>';
  return `
    <section class="card">
      <p class="eyebrow">Student view-only</p>
      <h2>${escapeHtml(courseLabel(c))}</h2>
      <p>${escapeHtml(courseMeta(c))}</p>
      <div class="notice">You can view the attendance sheet but cannot edit anything.</div>
    </section>
    ${renderSheet(c.id, true)}`;
}
function bindStudentView() {}

function renderExport() {
  const c = activeCourse();
  return `
    <section class="card">
      <p class="eyebrow">Export and sharing</p>
      <h2>Option B and Option C</h2>
      <div class="notice"><b>Option B:</b> Export a view-only HTML or Excel file and share it manually. <br><b>Option C:</b> Export public JSON and upload it with the static student viewer to GitHub Pages.</div>
      <div class="form-grid" style="margin-top:14px"><label>Course offering <select id="activeCourseSelect">${getCourseOptions(c?.id)}</select></label></div>
    </section>
    <section class="grid two">
      <div class="card">
        <h3>Option B: Direct sharing</h3>
        <p>Generate files that can be sent to students in Messenger, WhatsApp, Telegram, Google Drive, or email.</p>
        <div class="actions">
          <button id="exportStudentHtml">Export View-only HTML</button>
          <button id="exportExcel2" class="soft">Export Excel-compatible .xls</button>
          <button id="exportCsv2" class="ghost">Export CSV</button>
        </div>
      </div>
      <div class="card">
        <h3>Option C: Static GitHub Pages view</h3>
        <p>Upload <span class="kbd">student-viewer.html</span> and <span class="kbd">attendance-data.json</span> to GitHub. Students open the viewer and enter their course code.</p>
        <div class="actions">
          <button id="exportPublicJson">Export attendance-data.json</button>
          <button id="exportStaticViewer" class="soft">Export student-viewer.html</button>
        </div>
      </div>
    </section>
    <section class="card">
      <h3>Backup / Restore</h3>
      <p>Use JSON backup to move the editable teacher database between devices or prevent data loss.</p>
      <div class="actions">
        <button id="exportBackup" class="ghost">Export Full JSON Backup</button>
        <label class="button ghost small">Import JSON Backup <input id="backupFile" type="file" accept=".json,application/json" hidden /></label>
      </div>
    </section>`;
}
function bindExport() {
  bindCommon();
  $('#exportExcel2').addEventListener('click', () => exportExcel(activeCourse()?.id));
  $('#exportCsv2').addEventListener('click', () => exportAttendanceCSV(activeCourse()?.id));
  $('#exportStudentHtml').addEventListener('click', () => exportStudentHTML(activeCourse()?.id));
  $('#exportPublicJson').addEventListener('click', exportPublicJSON);
  $('#exportStaticViewer').addEventListener('click', exportStaticViewer);
  $('#exportBackup').addEventListener('click', () => downloadText(`attendance-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(data, null, 2), 'application/json'));
  $('#backupFile').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const incoming = migrateData(JSON.parse(await file.text()));
      if (!confirm('Importing backup will replace current local data. Continue?')) return;
      data = incoming; selectedCourseId = data.courseOfferings[0]?.id || null; saveData(); toast('Backup imported'); render();
    } catch (err) { toast('Invalid backup file'); }
  });
}

function exportExcel(courseId) {
  const course = courseById(courseId); if (!course) return toast('Select a course');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse}td,th{border:1px solid #999;padding:6px}th{background:#eee}</style></head><body><h2>${escapeHtml(courseLabel(course))}</h2><p>${escapeHtml(courseMeta(course))}</p>${renderSheetTable(course.id)}</body></html>`;
  downloadText(`${safeFile(course.courseCode)}_${safeFile(course.section)}_attendance.xls`, html, 'application/vnd.ms-excel');
}
function exportAttendanceCSV(courseId) {
  const course = courseById(courseId); if (!course) return toast('Select a course');
  const { students, sessions, present, ai, ar, totalClasses } = summarizeCourse(course.id);
  const headers = ['Roll Number', 'Student Name', ...sessions.map(s => `${s.attendanceDate}${s.classNo ? ' Class ' + s.classNo : ''}`), 'Total Present', 'Informed/Application Absence', 'Random Absence', 'Total Absent', 'Attendance Percentage'];
  const lines = [headers.map(csvCell).join(',')];
  for (const student of students) {
    const row = [student.rollNumber, student.studentName];
    for (const sess of sessions) {
      const rec = recordsForSession(sess.id).find(r => r.studentId === student.id);
      row.push(rec?.status || 'AR');
    }
    const absent = ai[student.id] + ar[student.id];
    row.push(present[student.id], ai[student.id], ar[student.id], absent, totalClasses ? ((present[student.id] / totalClasses) * 100).toFixed(1) + '%' : '0%');
    lines.push(row.map(csvCell).join(','));
  }
  downloadText(`${safeFile(course.courseCode)}_${safeFile(course.section)}_attendance.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
}
function exportStudentHTML(courseId) {
  const course = courseById(courseId); if (!course) return toast('Select a course');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(course.courseCode)} Attendance</title><style>body{font-family:system-ui;margin:20px;background:#f7f4ef;color:#111827}.card{background:#fff;border-radius:18px;padding:18px;box-shadow:0 10px 30px #0001}table{border-collapse:collapse;width:100%;background:#fff}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}.wrap{overflow:auto}.badge{font-weight:800}</style></head><body><main class="card"><h1>${escapeHtml(courseLabel(course))}</h1><p>${escapeHtml(courseMeta(course))}</p><p>Generated: ${new Date().toLocaleString()}</p>${renderSheetTable(course.id)}</main></body></html>`;
  downloadText(`${safeFile(course.courseCode)}_${safeFile(course.section)}_student_view.html`, html, 'text/html;charset=utf-8');
}
function exportPublicJSON() {
  const payload = {
    generatedAt: nowISO(),
    institutionName: data.settings.institutionName,
    courseOfferings: data.courseOfferings,
    students: data.students,
    attendanceSessions: data.attendanceSessions,
    attendanceRecords: data.attendanceRecords
  };
  downloadText('attendance-data.json', JSON.stringify(payload, null, 2), 'application/json');
}
function exportStaticViewer() {
  downloadText('student-viewer.html', staticViewerHTML(), 'text/html;charset=utf-8');
}
function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  toast(`Downloaded ${filename}`);
}
function csvCell(v) { return `"${String(v ?? '').replaceAll('"', '""')}"`; }
function safeFile(v) { return String(v || 'attendance').replace(/[^a-z0-9_-]+/gi, '_'); }

function staticViewerHTML() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Student Attendance Viewer</title>
<style>body{font-family:system-ui;margin:0;background:#f5f3ef;color:#111827}.wrap{max-width:1100px;margin:auto;padding:18px}.card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:18px;box-shadow:0 10px 30px #0001;margin:12px 0}input,button{font:inherit;border-radius:12px;padding:11px;border:1px solid #d1d5db}button{background:#111827;color:#fff;font-weight:800;cursor:pointer}.table{overflow:auto}table{border-collapse:collapse;width:100%;background:#fff;min-width:760px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}.muted{color:#6b7280}.badge{font-weight:900}</style></head>
<body><main class="wrap"><section class="card"><h1>Student Attendance Viewer</h1><p class="muted">Enter your course view code. This static page reads <code>attendance-data.json</code> from the same folder.</p><form id="f"><input id="code" placeholder="Course view code" autofocus> <button>View sheet</button></form><p id="msg" class="muted"></p></section><section id="out" class="card" hidden></section></main>
<script>
let db=null; const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
fetch('attendance-data.json?cache='+Date.now()).then(r=>r.json()).then(j=>{db=j;msg.textContent='Attendance data loaded. Generated: '+new Date(j.generatedAt).toLocaleString();}).catch(()=>msg.textContent='Could not load attendance-data.json. Upload it beside this file.');
f.onsubmit=e=>{e.preventDefault(); if(!db)return; const code=codeEl().value.trim().toUpperCase(); const c=db.courseOfferings.find(x=>String(x.viewCode).toUpperCase()===code); if(!c){msg.textContent='No course found for that code.';return;} render(c);};
function codeEl(){return document.getElementById('code')}
function render(c){const students=db.students.filter(s=>s.courseOfferingId===c.id).sort((a,b)=>String(a.rollNumber).localeCompare(String(b.rollNumber),undefined,{numeric:true})); const sessions=db.attendanceSessions.filter(s=>s.courseOfferingId===c.id).sort((a,b)=>(a.attendanceDate+(a.classNo||'')).localeCompare(b.attendanceDate+(b.classNo||''))); let html='<h2>'+esc(c.courseCode)+' · '+esc(c.courseName)+'</h2><p class="muted">'+esc(c.department)+' · '+esc(c.academicYear)+' · Section '+esc(c.section)+' · '+esc(c.academicSession)+'</p>'; if(!students.length||!sessions.length){out.innerHTML=html+'<p>No records yet.</p>';out.hidden=false;return;} html+='<div class="table"><table><thead><tr><th>Roll</th><th>Name</th>'+sessions.map(s=>'<th>'+esc(s.attendanceDate)+(s.classNo?'<br>Class '+esc(s.classNo):'')+'</th>').join('')+'<th>Total P</th><th>AI</th><th>AR</th><th>%</th></tr></thead><tbody>'; for(const st of students){let p=0,ai=0,ar=0,row='<tr><td>'+esc(st.rollNumber)+'</td><td>'+esc(st.studentName)+'</td>'; for(const se of sessions){const rec=db.attendanceRecords.find(r=>r.attendanceSessionId===se.id&&r.studentId===st.id); const status=rec?.status||'AR'; if(status==='P')p++; else if(status==='AI')ai++; else ar++; row+='<td><span class="badge">'+status+'</span></td>'; } row+='<td>'+p+'</td><td>'+ai+'</td><td>'+ar+'</td><td>'+(sessions.length?((p/sessions.length)*100).toFixed(1):'0.0')+'%</td></tr>'; html+=row;} html+='</tbody></table></div>'; out.innerHTML=html; out.hidden=false;}
<\/script></body></html>`;
}

function renderSettings() {
  return `
    <section class="card">
      <p class="eyebrow">Settings</p>
      <h2>Local App Settings</h2>
      <form id="settingsForm" class="form-grid">
        <label>Institution name <input id="institutionName" value="${escapeHtml(data.settings.institutionName)}" /></label>
        <label>Default academic session <input id="defaultAcademicSession" value="${escapeHtml(data.settings.defaultAcademicSession)}" /></label>
        <label>Teacher password <input id="teacherPasswordSetting" type="password" value="${escapeHtml(data.settings.teacherPassword)}" /></label>
        <label>Default absent status
          <select id="defaultAbsentStatus">
            <option value="AR" ${data.settings.defaultAbsentStatus === 'AR' ? 'selected' : ''}>Random Absent</option>
            <option value="AI" ${data.settings.defaultAbsentStatus === 'AI' ? 'selected' : ''}>Informed/Application</option>
          </select>
        </label>
        <div class="actions"><button type="submit">Save Settings</button></div>
      </form>
    </section>
    <section class="card">
      <h3>Danger Zone</h3>
      <p>Clear local data only after exporting a full JSON backup.</p>
      <div class="actions"><button id="resetDemo" class="ghost">Reset to Demo Data</button><button id="wipeData" class="danger">Wipe All Local Data</button></div>
    </section>`;
}
function bindSettings() {
  $('#settingsForm').addEventListener('submit', e => {
    e.preventDefault();
    data.settings.institutionName = $('#institutionName').value.trim() || 'Your Institution';
    data.settings.defaultAcademicSession = $('#defaultAcademicSession').value.trim() || new Date().getFullYear().toString();
    data.settings.teacherPassword = $('#teacherPasswordSetting').value || DEFAULT_PASSWORD;
    data.settings.defaultAbsentStatus = $('#defaultAbsentStatus').value;
    saveData(); toast('Settings saved'); render();
  });
  $('#resetDemo').addEventListener('click', () => { if(confirm('Replace current data with demo data?')) { data = seedData(blankData()); selectedCourseId = data.courseOfferings[0]?.id || null; saveData(); render(); } });
  $('#wipeData').addEventListener('click', () => { if(confirm('This deletes all local attendance data. Continue?')) { data = blankData(); saveData(); render(); } });
}

function bindRoute(route) {
  if (route === 'dashboard') bindCommon();
  if (route === 'setup') bindSetup();
  if (route === 'import') bindImport();
  if (route === 'take') bindTakeAttendance();
  if (route === 'sheet') bindSheet();
  if (route === 'export') bindExport();
  if (route === 'settings') bindSettings();
}

$('#bottomNav').addEventListener('click', e => {
  const btn = e.target.closest('button[data-route]');
  if (!btn) return;
  routeTo(btn.dataset.route);
});
$('#logoutBtn').addEventListener('click', () => { session = { mode: null, route: 'login', courseId: null }; saveSession(); render(); });

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredInstallPrompt = e; $('#installBtn').hidden = false;
});
$('#installBtn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return toast('Use browser menu → Install/Add to Home screen');
  deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; $('#installBtn').hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(console.error));
}

render();
