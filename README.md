# Attendance Ledger PWA

A **local-first classroom attendance-taking web app** that works without PHP, MySQL, Firebase, Supabase, or server hosting.

It is designed for academic attendance where a class/course is identified by:

- Department
- Academic year level, such as 1st Year or 2nd Year
- Section
- Course code
- Course name
- Academic session or batch

Example:

```text
Department: Mathematics
Year: 1st Year
Section: A
Course Code: MATH-101
Course Name: Calculus I
Session: 2026
```

The app supports teacher-side attendance taking, student import by CSV, full attendance sheet view, Excel-compatible export, student view-only mode, and static sharing exports.

---

## 1. Important Concept

This app has **no backend server** and **no shared online database**.

That means:

```text
Teacher takes attendance → data is saved in that teacher's browser/device
```

It does **not** mean:

```text
Teacher takes attendance → all students instantly see live data on their own phones
```

For student access, the app provides two no-server options:

### Option B: Manual sharing

Teacher exports a view-only HTML file, Excel-compatible `.xls`, or CSV file and shares it with students.

### Option C: Static GitHub Pages student view

Teacher exports:

```text
student-viewer.html
attendance-data.json
```

Then uploads both to GitHub Pages. Students open the static viewer page and enter their course view code.

No PHP, no database, no login server.

---

## 2. What This App Can Do

### Teacher mode

- Teacher login with local password
- Create course offerings
- Set department, year, section, course code, course name, academic session
- Auto-generate or manually set student view code
- Download student import template
- Import student list by CSV
- Take attendance by date
- Support multiple classes on the same date using class number/slot
- Mark attendance status:
  - `P` = Present
  - `AI` = Absent Informed / Application Submitted
  - `AR` = Absent Random
- View full attendance sheet
- Export attendance to Excel-compatible `.xls`
- Export attendance to CSV
- Export student view-only HTML file
- Export public JSON for static GitHub student viewing
- Export full JSON backup
- Import full JSON backup
- Install as PWA where supported
- Work offline after first load

### Student mode

- Student enters fixed course view code
- Student sees the full attendance sheet for that course
- Student cannot edit anything

Important: inside the main app, student mode only sees data available on that same browser/device. For students on their own phones, use Option B or C.

---

## 3. Default Login

Default teacher password:

```text
teacher123
```

Change it from:

```text
Settings → Teacher password
```

This password is local-only. It is not a secure server login. It is only meant to prevent casual edits on the same device.

---

## 4. Folder Structure

Your GitHub repository should look like this:

```text
index.html
app.js
styles.css
manifest.json
service-worker.js
offline.html
README.md
assets/
  icon-192.png
  icon-512.png
docs/
  ACCEPTANCE_CHECKLIST.md
```

Very important: `index.html` must be directly in the repository root.

Correct:

```text
attendance-pwa/index.html
attendance-pwa/app.js
attendance-pwa/assets/icon-192.png
```

Wrong:

```text
attendance-pwa/attendance-pwa/index.html
```

---

## 5. How to Use the App

### Step 1: Login as Teacher

Open the app.

Use:

```text
Password: teacher123
```

Then enter the teacher dashboard.

---

### Step 2: Create a Course Offering

Go to:

```text
Setup
```

Fill in:

```text
Department
Year
Section
Academic Session / Batch
Course Code
Course Name
Student View Code
```

If you leave Student View Code blank, the app generates one automatically.

Example code:

```text
MATH101-A-2026
```

Create one course offering per course-section combination.

Example: if 1st Year Section A has 9 courses, create 9 course offerings.

---

### Step 3: Download Student Import Template

Go to:

```text
Import
```

Click:

```text
Download CSV Template
```

The template columns are:

```text
roll_number,student_name,student_id,phone,email,remarks
```

Required:

```text
roll_number
student_name
```

Optional:

```text
student_id
phone
email
remarks
```

Open the CSV in Excel, fill the student list, then save as CSV.

---

### Step 4: Import Student List

Go to:

```text
Import
```

Select the course offering.

Upload the filled CSV file.

Click:

```text
Preview Import
```

The app will check:

- missing roll number
- missing student name
- duplicate roll numbers inside the uploaded file
- invalid/empty rows

Then click:

```text
Confirm Import
```

If a roll number already exists in that course, the app updates that student row instead of duplicating it.

---

### Step 5: Take Attendance

Go to:

```text
Take
```

Select:

```text
Course offering
Date
Class number / slot, optional
Remarks, optional
```

Each student has three attendance options:

```text
P  = Present
AI = Absent Informed / Application Submitted
AR = Absent Random
```

Default absence is `AR`, because blank attendance is risky. A blank cell can mean either absent or not marked, so the app records absence clearly.

Click:

```text
Save Attendance
```

If attendance already exists for the same course, date, and class number, loading/saving will edit that existing session.

---

### Step 6: View Full Attendance Sheet

Go to:

```text
Sheet
```

The sheet shows:

```text
Roll
Student Name
Each attendance date
Total Present
Informed/Application Absence
Random Absence
Total Absent
Attendance Percentage
```

---

### Step 7: Export Attendance

Go to:

```text
Export
```

You can export:

```text
Excel-compatible .xls
CSV
View-only student HTML
Public JSON for GitHub Pages
Static student viewer HTML
Full JSON backup
```

---

## 6. Option B: Manual Student Sharing

Use this when you do not want to maintain any online student view.

Go to:

```text
Export → Option B
```

Click one of these:

```text
Export View-only HTML
Export Excel-compatible .xls
Export CSV
```

Then share the file manually through WhatsApp, Messenger, Telegram, Google Drive, or email.

The view-only HTML file can be opened by students in a browser.

---

## 7. Option C: Static GitHub Pages Student View

Use this when you want students to open a fixed online link and enter their course code.

Go to:

```text
Export → Option C
```

Download:

```text
student-viewer.html
attendance-data.json
```

Upload both files to a GitHub Pages repository.

The files must be in the same folder:

```text
student-viewer.html
attendance-data.json
```

Students open:

```text
https://yourusername.github.io/your-repo/student-viewer.html
```

Then they enter their course view code, for example:

```text
MATH101-A-2026
```

They will see the attendance sheet for that course.

When attendance changes, repeat this:

```text
Export new attendance-data.json → upload/replace it on GitHub → students refresh the viewer
```

No server database is involved.

---

## 8. Backup and Restore

Because the app is local-first, backup is very important.

Go to:

```text
Export → Backup / Restore
```

Click:

```text
Export Full JSON Backup
```

This saves your editable teacher database.

To restore later:

```text
Import JSON Backup
```

Warning: importing a backup replaces the current local data.

Recommended habit:

```text
Export full JSON backup after every important attendance update.
```

---

## 9. Deployment on GitHub Pages

### Step 1: Create a GitHub repository

Create a repo such as:

```text
attendance-pwa
```

Keep it public for simplest GitHub Pages deployment.

---

### Step 2: Upload files

Upload the contents of this folder, not the zip file.

Make sure the repo root contains:

```text
index.html
app.js
styles.css
manifest.json
service-worker.js
offline.html
assets/
docs/
```

Do not accidentally upload like this:

```text
attendance-pwa/attendance-pwa/index.html
```

---

### Step 3: Enable GitHub Pages

Go to:

```text
Repository → Settings → Pages
```

Set:

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

Save.

Wait until deployment is green in:

```text
Repository → Actions
```

Your live link will look like:

```text
https://yourusername.github.io/attendance-pwa/
```

---

## 10. Installing on Android

Open the live GitHub Pages link directly in Chrome.

Do not open it inside Facebook, Messenger, WhatsApp, or GitHub app browser.

Then:

```text
Chrome menu ⋮ → Add to Home screen / Install app
```

If nothing happens:

1. Check that these links load:

```text
https://yourusername.github.io/attendance-pwa/manifest.json
https://yourusername.github.io/attendance-pwa/service-worker.js
https://yourusername.github.io/attendance-pwa/assets/icon-192.png
https://yourusername.github.io/attendance-pwa/assets/icon-512.png
```

2. If icon links show 404, upload the `assets` folder correctly.
3. Clear Chrome cache for the site.
4. Reopen the site directly in Chrome.
5. Try install again.

---

## 11. PWA Path Note

This manifest uses relative paths:

```json
"start_url": "./",
"scope": "./"
```

This makes it portable across GitHub Pages repositories with different names.

If you want hardcoded GitHub Pages paths instead, edit `manifest.json` like this:

```json
"id": "/attendance-pwa/",
"start_url": "/attendance-pwa/",
"scope": "/attendance-pwa/"
```

Only do this if your repository name is exactly `attendance-pwa`.

---

## 12. Updating the App on GitHub

To upload a corrected version:

1. Unzip the corrected folder.
2. Go to GitHub repo.
3. Click:

```text
Add file → Upload files
```

4. Upload the corrected files/folders.
5. Commit changes.
6. Wait for GitHub Pages deployment to turn green.
7. Hard refresh the site.

If the old app still appears, it is probably service worker cache.

Fix:

- Open DevTools → Application → Service Workers → Unregister
- Or clear site cache
- Or change `CACHE_NAME` in `service-worker.js` to a new version

Example:

```js
const CACHE_NAME = 'attendance-ledger-pwa-v1.0.1';
```

---

## 13. Limitations of No-Server Version

This app cannot do these properly without a backend:

- live multi-device sync
- secure online student login
- multiple teachers editing the same central data simultaneously
- automatic student updates across phones
- server-side audit logs
- cloud backup

For those, the app would need a backend such as:

```text
PHP + MySQL
Firebase
Supabase
Node.js + PostgreSQL
```

---

## 14. Recommended Usage Pattern

For a department/class:

```text
Teacher opens app
Teacher creates all course offerings
Teacher imports student lists course-wise
Teacher takes attendance after each class
Teacher exports Excel sheet when needed
Teacher exports JSON backup regularly
Teacher optionally exports student-view HTML or GitHub public JSON
```

For students:

```text
Option B: receive shared HTML/Excel/CSV file
Option C: open student-viewer.html link and enter course code
```

---

## 15. Status Codes

```text
P  = Present
AI = Absent Informed / Application Submitted
AR = Absent Random
```

Attendance percentage is calculated as:

```text
Present classes / Total classes taken × 100
```

Both `AI` and `AR` count as absent, but they are shown separately.

---

## 16. Suggested Future Upgrades

Possible Phase 2 features:

- real backend sync
- teacher accounts
- student accounts
- admin panel
- edit audit trail
- low attendance warning
- SMS/email/WhatsApp notification
- student-wise individual view
- multiple teachers with permissions
- proper XLSX import/export using server-side processing
- department-wide summary reports

