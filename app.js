const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let records = [];
let images = [];
let toastTimer;

const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const thaiDate = d => {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
};

function toast(t) {
  const el = $('toast');
  el.textContent = t;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4500);
}

// ==========================================
// ฐานข้อมูลเบราว์เซอร์ IndexedDB (ไม่ต้องมีเซิร์ฟเวอร์/Google Drive)
// ==========================================
let dbPromise = null;
function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('duty-report-local-v1', 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('records')) {
          db.createObjectStore('records', { keyPath: 'id' });
        }
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = e => reject(Error('เปิดพื้นที่เก็บข้อมูลของเบราว์เซอร์ไม่ได้ กรุณาใช้ Chrome หรือ Edge ในโหมดปกติ'));
    });
  }
  return dbPromise;
}

async function dbGetAll() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readonly');
    const store = tx.objectStore('records');
    const req = store.getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updated || '').localeCompare(a.updated || ''));
      resolve(list);
    };
    req.onerror = () => reject(Error('โหลดข้อมูลไม่สำเร็จ'));
  });
}

async function dbSave(item) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    const store = tx.objectStore('records');
    const id = item.id || ('rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
    const data = {
      ...item,
      id,
      author: 'เจ้าหน้าที่',
      updated: new Date().toISOString()
    };
    store.put(data);
    tx.oncomplete = () => resolve(data);
    tx.onerror = () => reject(Error('บันทึกข้อมูลไม่สำเร็จ'));
  });
}

async function dbDelete(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    const store = tx.objectStore('records');
    store.delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(Error('ลบข้อมูลไม่สำเร็จ'));
  });
}

async function dbImportList(list) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    const store = tx.objectStore('records');
    for (const item of list) {
      store.put(item);
    }
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(Error('นำเข้าข้อมูลไม่สำเร็จ'));
  });
}

// ==========================================
// การแสดงผลและควบคุมหน้าจอ
// ==========================================
async function refresh() {
  try {
    records = await dbGetAll();
    const units = [...new Set(records.map(r => r.unit).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
    const selected = $('unitFilter').value;
    $('unitFilter').innerHTML = '<option value="">ทุกหน่วยงาน</option>' + units.map(u => `<option>${esc(u)}</option>`).join('');
    $('unitFilter').value = units.includes(selected) ? selected : '';
    $('unitOptions').innerHTML = units.map(u => `<option value="${esc(u)}"></option>`).join('');
    $('total').textContent = records.length;
    $('todayCount').textContent = records.filter(r => r.date === localDate()).length;
    $('unitsCount').textContent = units.length;
    $('synced').textContent = 'บันทึกในอุปกรณ์นี้ · อัปเดตล่าสุด ' + new Date().toLocaleTimeString('th-TH');
    render();
  } catch (err) {
    toast(err.message);
  }
}

function filtered() {
  const q = $('search').value.trim().toLocaleLowerCase();
  return records.filter(r => (
    (!q || [r.unit, r.activity, r.note].join(' ').toLocaleLowerCase().includes(q)) &&
    (!$('unitFilter').value || r.unit === $('unitFilter').value) &&
    (!$('from').value || r.date >= $('from').value) &&
    (!$('to').value || r.date <= $('to').value)
  ));
}

function render() {
  const rows = filtered();
  $('countLabel').textContent = `แสดง ${rows.length} จาก ${records.length} รายการ`;
  $('records').innerHTML = rows.length ? rows.map(r => {
    const d = new Date(r.date + 'T12:00:00');
    const day = isNaN(d.getDate()) ? '-' : d.getDate();
    const month = isNaN(d.getMonth()) ? '' : d.toLocaleDateString('th-TH', { month: 'short' });
    const year = isNaN(d.getFullYear()) ? '' : d.getFullYear() + 543;
    const imgCount = Array.isArray(r.images) ? r.images.length : 0;

    return `
      <article class="record">
        <div class="datebox">
          <strong>${day}</strong>${esc(month)}<br>${year}
        </div>
        <div>
          <span class="badge">${esc(r.unit)}</span>
          <h3>${esc(r.activity.length > 180 ? r.activity.slice(0, 180) + '…' : r.activity)}</h3>
          ${r.note ? `<p class="muted note">${esc(r.note.slice(0, 120))}</p>` : ''}
          <p class="meta">
            ${imgCount ? `▧ ${imgCount} รูป · ` : ''}บันทึกโดย ${esc(r.author || 'เจ้าหน้าที่')}
          </p>
        </div>
        <div class="actions">
          <button data-view="${esc(r.id)}">ดูรายละเอียด</button>
          <button data-edit="${esc(r.id)}">แก้ไข</button>
        </div>
      </article>
    `;
  }).join('') : `
    <div class="empty">
      <strong>${records.length ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีบันทึกการปฏิบัติงาน'}</strong>
      <p class="muted">${records.length ? 'ลองเปลี่ยนคำค้นหรือช่วงวันที่' : 'เริ่มต้นบันทึกงานโดยกดปุ่ม “＋ บันทึกการปฏิบัติงาน” ด้านบน'}</p>
    </div>
  `;
}

function openEditor(id) {
  const r = records.find(x => x.id === id);
  const form = $('recordForm');
  form.reset();
  for (const key of ['id', 'date', 'unit', 'activity', 'note']) {
    const el = form.elements.namedItem(key);
    if (el) el.value = r ? (r[key] || '') : (key === 'date' ? localDate() : '');
  }
  images = r && Array.isArray(r.images) ? [...r.images] : [];
  $('editorTitle').textContent = r ? 'แก้ไขการปฏิบัติงาน' : 'บันทึกการปฏิบัติงาน';
  previews();
  $('editor').showModal();
}

function previews() {
  $('previews').innerHTML = images.map((im, i) => `
    <div class="preview">
      <img src="${esc(im)}" alt="รูปแนบ ${i + 1}">
      <button type="button" data-remove="${i}" aria-label="ลบรูป ${i + 1}">✕</button>
    </div>
  `).join('');
}

function detail(id) {
  const r = records.find(x => x.id === id);
  if (!r) return;
  const imList = Array.isArray(r.images) ? r.images : [];
  $('detailContent').innerHTML = `
    <span class="badge">${esc(r.unit)}</span>
    <p class="muted">${esc(thaiDate(r.date))}</p>
    <h3 class="detailtext">${esc(r.activity)}</h3>
    <p class="detailtext">${r.note ? esc(r.note) : 'ไม่มีหมายเหตุ'}</p>
    <div class="gallery">
      ${imList.map((im, i) => `
        <a href="${esc(im)}" target="_blank" rel="noopener noreferrer">
          <img src="${esc(im)}" alt="ภาพประกอบ ${i + 1}" loading="lazy">
        </a>
      `).join('')}
    </div>
    <p class="muted small detailtext">
      บันทึกโดย ${esc(r.author || 'เจ้าหน้าที่')} · แก้ไขล่าสุด ${esc(r.updated ? new Date(r.updated).toLocaleString('th-TH') : '-') }
    </p>
    <button data-delete="${esc(r.id)}" style="color:#b23b3b;border-color:#e0b2b2">ลบรายการนี้</button>
  `;
  $('detail').showModal();
}

// ย่อขนาดรูปภาพในเบราว์เซอร์อัตโนมัติ (ไม่เกิน 1600px) เพื่อประหยัดพื้นที่จัดเก็บ
async function compress(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw Error('รองรับเฉพาะ JPG, PNG และ WebP');
  }
  if (file.size > 20000000) throw Error('รูปต้นฉบับต้องไม่เกิน 20 MB');

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.80);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ==========================================
// ส่งรายงาน HTML ให้ผู้บริหาร (รวมรูปในตัวแบบ Base64)
// ==========================================
function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

let cachedCssText = '';
async function getReportCss() {
  if (cachedCssText) return cachedCssText;
  try {
    const res = await fetch('./style.css');
    if (res.ok) {
      cachedCssText = await res.text();
      return cachedCssText;
    }
  } catch (e) {}
  try {
    let sheetText = '';
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          sheetText += rule.cssText + '\n';
        }
      } catch (err) {}
    }
    if (sheetText) {
      cachedCssText = sheetText;
      return cachedCssText;
    }
  } catch (e) {}
  return '';
}

function generateExecutiveReportHtml(recordsData, cssContent) {
  const jsonStr = JSON.stringify(recordsData).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>สมุดปฏิบัติหน้าที่ | รายงานสำหรับผู้บริหาร</title>
  <meta name="description" content="รายงานสรุปการปฏิบัติหน้าที่ พร้อมรูปภาพประกอบภารกิจสำหรับผู้บริหาร">
  <link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20width%3D%2232%22%20height%3D%2232%22%20rx%3D%228%22%20fill%3D%22%23164e45%22/%3E%3Cpath%20d%3D%22M9%207h14v18H9z%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222%22/%3E%3Cpath%20d%3D%22m12%2016%203%203%206-7%22%20fill%3D%22none%22%20stroke%3D%22%23c8ec79%22%20stroke-width%3D%222%22/%3E%3C/svg%3E">
  <style>
    ${cssContent}
    .notice{padding:14px 18px;background:#eaf2e8;border:1px solid #c9dcc6;border-radius:10px;margin-bottom:20px;font-size:.875rem}
    @media print{.notice{display:none!important}}
  </style>
</head>
<body>
  <div id="workspace">
    <aside>
      <div class="logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c8ec79" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <span class="logo-title">สมุดปฏิบัติหน้าที่</span>
      </div>
      <p class="eyebrow">EXECUTIVE REPORT</p>
      <div class="navactive">▦ &nbsp; รายงานสำหรับผู้บริหาร</div>
      <div class="asidebottom">
        <p>ผู้บริหาร · รายงานภารกิจ</p>
      </div>
    </aside>

    <main>
      <header>
        <div>
          <p class="eyebrow">รายงานการปฏิบัติหน้าที่</p>
          <h1>สรุปภารกิจและผลการปฏิบัติงาน</h1>
          <p class="muted" id="today"></p>
        </div>
      </header>

      <p class="notice">
        📄 <strong>รายงานสำหรับผู้บริหาร</strong> · ข้อมูลสรุป ณ วันที่ส่งออกไฟล์ · มีรูปภาพฝังในตัวพร้อมดูแบบออฟไลน์โดยไม่ต้องต่อเน็ต
      </p>

      <section class="stats">
        <article>
          <span>รายการทั้งหมด</span>
          <strong id="total">0</strong>
          <small>บันทึกในรายงานนี้</small>
        </article>
        <article>
          <span>ปฏิบัติงานวันนี้</span>
          <strong id="todayCount">0</strong>
          <small>รายการของวันนี้</small>
        </article>
        <article>
          <span>หน่วยงาน</span>
          <strong id="unitsCount">0</strong>
          <small>หน่วยงานที่มีรายงาน</small>
        </article>
      </section>

      <section class="panel">
        <div class="sectionhead">
          <div>
            <h2>รายการปฏิบัติงาน</h2>
            <p class="muted" id="countLabel"></p>
          </div>
          <div class="actions">
            <button id="export">ส่งออก CSV</button>
            <button id="print">พิมพ์รายงาน (PDF)</button>
          </div>
        </div>

        <div class="filters">
          <label>ค้นหารายการ
            <input id="search" placeholder="รายการ หน่วยงาน หรือหมายเหตุ">
          </label>
          <label>หน่วยงาน
            <select id="unitFilter">
              <option value="">ทุกหน่วยงาน</option>
            </select>
          </label>
          <label>ตั้งแต่วันที่
            <input id="from" type="date">
          </label>
          <label>ถึงวันที่
            <input id="to" type="date">
          </label>
          <button id="clear">ล้างตัวกรอง</button>
        </div>

        <div id="records"></div>
      </section>

      <footer>
        <span>สมุดปฏิบัติหน้าที่ · รายงานภารกิจสำหรับผู้บริหาร</span>
        <span id="synced"></span>
      </footer>
    </main>
  </div>

  <dialog id="detail">
    <div class="sectionhead">
      <h2>รายละเอียดการปฏิบัติงาน</h2>
      <button data-close="detail" aria-label="ปิด">✕</button>
    </div>
    <div id="detailContent"></div>
  </dialog>

  <script type="application/json" id="sharedData">${jsonStr}</script>
  <script>
    const $ = id => document.getElementById(id);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const records = JSON.parse(document.getElementById('sharedData').textContent || '[]');
    const thaiDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const localDate = () => {
      const d = new Date();
      return \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;
    };

    function filtered() {
      const q = $('search').value.trim().toLocaleLowerCase();
      return records.filter(r => (
        (!q || [r.unit, r.activity, r.note].join(' ').toLocaleLowerCase().includes(q)) &&
        (!$('unitFilter').value || r.unit === $('unitFilter').value) &&
        (!$('from').value || r.date >= $('from').value) &&
        (!$('to').value || r.date <= $('to').value)
      ));
    }

    function render() {
      const rows = filtered();
      $('countLabel').textContent = \`แสดง \${rows.length} จาก \${records.length} รายการ\`;
      $('records').innerHTML = rows.length ? rows.map(r => {
        const d = new Date(r.date + 'T12:00:00');
        const day = isNaN(d.getDate()) ? '-' : d.getDate();
        const month = isNaN(d.getMonth()) ? '' : d.toLocaleDateString('th-TH', { month: 'short' });
        const year = isNaN(d.getFullYear()) ? '' : d.getFullYear() + 543;
        const imgCount = Array.isArray(r.images) ? r.images.length : 0;
        return \`
          <article class="record">
            <div class="datebox">
              <strong>\${day}</strong>\${esc(month)}<br>\${year}
            </div>
            <div>
              <span class="badge">\${esc(r.unit)}</span>
              <h3>\${esc(r.activity.length > 180 ? r.activity.slice(0, 180) + '…' : r.activity)}</h3>
              \${r.note ? \`<p class="muted note">\${esc(r.note.slice(0, 120))}</p>\` : ''}
              <p class="meta">
                \${imgCount ? \`▧ \${imgCount} รูป · \` : ''}บันทึกโดย \${esc(r.author || 'เจ้าหน้าที่')}
              </p>
            </div>
            <div class="actions">
              <button data-view="\${esc(r.id)}">ดูรายละเอียด</button>
            </div>
          </article>
        \`;
      }).join('') : \`
        <div class="empty">
          <strong>\${records.length ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ไม่มีบันทึกการปฏิบัติงาน'}</strong>
        </div>
      \`;
    }

    function detail(id) {
      const r = records.find(x => x.id === id);
      if (!r) return;
      const imList = Array.isArray(r.images) ? r.images : [];
      $('detailContent').innerHTML = \`
        <span class="badge">\${esc(r.unit)}</span>
        <p class="muted">\${esc(thaiDate(r.date))}</p>
        <h3 class="detailtext">\${esc(r.activity)}</h3>
        <p class="detailtext">\${r.note ? esc(r.note) : 'ไม่มีหมายเหตุ'}</p>
        <div class="gallery">
          \${imList.map((im, i) => \`
            <a href="\${esc(im)}" target="_blank" rel="noopener noreferrer">
              <img src="\${esc(im)}" alt="ภาพประกอบ \${i + 1}" loading="lazy">
            </a>
          \`).join('')}
        </div>
        <p class="muted small detailtext">
          บันทึกโดย \${esc(r.author || 'เจ้าหน้าที่')} · แก้ไขล่าสุด \${esc(r.updated ? new Date(r.updated).toLocaleString('th-TH') : '-')}
        </p>
      \`;
      $('detail').showModal();
    }

    document.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.close) $(b.dataset.close).close();
      if (b.dataset.view) detail(b.dataset.view);
    });

    for (const id of ['search', 'unitFilter', 'from', 'to']) {
      $(id).addEventListener('input', render);
    }
    $('clear').onclick = () => {
      for (const id of ['search', 'unitFilter', 'from', 'to']) $(id).value = '';
      render();
    };
    $('print').onclick = () => window.print();
    $('export').onclick = () => {
      const cell = s => '"' + String(s ?? '').replace(/^[=+@\\-\\t\\r]/, "'$&").replace(/"/g, '""') + '"';
      const rows = [
        ['วันที่', 'หน่วยงาน', 'รายการปฏิบัติ', 'หมายเหตุ', 'จำนวนรูป', 'ผู้บันทึก'],
        ...filtered().map(r => [
          thaiDate(r.date),
          r.unit,
          r.activity,
          r.note,
          Array.isArray(r.images) ? r.images.length : 0,
          r.author || 'เจ้าหน้าที่'
        ])
      ];
      const url = URL.createObjectURL(new Blob(['\\ufeff' + rows.map(r => r.map(cell).join(',')).join('\\r\\n')], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'รายงานการปฏิบัติหน้าที่-' + localDate() + '.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    function init() {
      const units = [...new Set(records.map(r => r.unit).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
      $('unitFilter').innerHTML = '<option value="">ทุกหน่วยงาน</option>' + units.map(u => \`<option>\${esc(u)}</option>\`).join('');
      $('total').textContent = records.length;
      $('todayCount').textContent = records.filter(r => r.date === localDate()).length;
      $('unitsCount').textContent = units.length;
      $('today').textContent = thaiDate(localDate());
      $('synced').textContent = 'รายงานข้อมูล ณ วันที่ ' + thaiDate(localDate());
      render();
    }
    init();
  <\\/script>
</body>
</html>`;
}

$('shareReport').onclick = async () => {
  const currentList = filtered();
  if (!currentList.length) {
    toast('ไม่มีรายการตามตัวกรองที่เลือก กรุณาเลือกข้อมูลที่ต้องการส่งออก');
    return;
  }

  const btn = $('shareReport');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ กำลังรวมรูปภาพ...';

  try {
    const css = await getReportCss();
    const reportHtml = generateExecutiveReportHtml(currentList, css);
    downloadFile('รายงานผู้บริหาร-' + localDate() + '.html', reportHtml, 'text/html;charset=utf-8');
    toast(`✓ สร้างรายงาน HTML พร้อมรูปภาพในตัวเรียบร้อย (${currentList.length} รายการ) ส่งไฟล์นี้ให้ผู้บริหารได้ทันที`);
  } catch (err) {
    toast('เกิดข้อผิดพลาดในการสร้างรายงาน: ' + (err.message || err));
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

// ==========================================
// สำรองข้อมูล และ กู้คืนข้อมูล (JSON Backup / Restore)
// ==========================================
$('backupBtn').onclick = () => {
  if (!records.length) {
    toast('ยังไม่มีข้อมูลสำหรับสำรอง');
    return;
  }
  const payload = JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    records: records
  }, null, 2);
  downloadFile('สำรองข้อมูลสมุดปฏิบัติหน้าที่-' + localDate() + '.json', payload, 'application/json');
  toast(`✓ สำรองข้อมูลเรียบร้อย (${records.length} รายการ)`);
};

$('restoreFile').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : (data.records && Array.isArray(data.records) ? data.records : null);
    if (!list) throw Error('รูปแบบไฟล์สำรองไม่ถูกต้อง');
    if (!confirm(`ต้องการนำเข้าข้อมูล ${list.length} รายการใช่หรือไม่? (รายการที่มีรหัสตรงกันจะถูกอัปเดต)`)) {
      return;
    }
    await dbImportList(list);
    toast(`✓ นำเข้าข้อมูล ${list.length} รายการเรียบร้อยแล้ว`);
    await refresh();
  } catch (err) {
    toast('นำเข้าไม่สำเร็จ: ' + (err.message || 'ไฟล์ไม่ถูกต้อง'));
  } finally {
    e.target.value = '';
  }
};

// ==========================================
// การบันทึกและจัดการฟอร์ม
// ==========================================
$('recordForm').onsubmit = async e => {
  e.preventDefault();
  $('save').disabled = true;
  try {
    const formData = Object.fromEntries(new FormData(e.target));
    await dbSave({ ...formData, images });
    $('editor').close();
    toast('✓ บันทึกข้อมูลเรียบร้อยแล้ว');
    await refresh();
  } catch (err) {
    toast(err.message);
  } finally {
    $('save').disabled = false;
  }
};

$('photos').onchange = async e => {
  const files = [...e.target.files];
  if (files.length + images.length > 6) {
    toast('แนบรูปได้สูงสุด 6 รูป');
    e.target.value = '';
    return;
  }
  $('save').disabled = true;
  e.target.disabled = true;
  try {
    const added = [];
    for (const f of files) added.push(await compress(f));
    images.push(...added);
    previews();
  } catch (err) {
    toast(err.message);
  } finally {
    $('save').disabled = false;
    e.target.disabled = false;
    e.target.value = '';
  }
};

document.addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;

  if (b.dataset.close) {
    const modal = $(b.dataset.close);
    if (modal) modal.close();
  }
  if (b.dataset.view) detail(b.dataset.view);
  if (b.dataset.edit) openEditor(b.dataset.edit);
  if (b.dataset.remove !== undefined) {
    images.splice(Number(b.dataset.remove), 1);
    previews();
  }
  if (b.dataset.delete && confirm('ต้องการลบรายการนี้พร้อมรูปภาพหรือไม่?')) {
    b.disabled = true;
    try {
      await dbDelete(b.dataset.delete);
      $('detail').close();
      toast('ลบรายการแล้ว');
      await refresh();
    } catch (err) {
      toast(err.message);
    } finally {
      b.disabled = false;
    }
  }
});

$('newBtn').onclick = () => openEditor();
$('refresh').onclick = () => refresh().catch(e => toast(e.message));

for (const id of ['search', 'unitFilter', 'from', 'to']) {
  $(id).addEventListener('input', render);
}

$('clear').onclick = () => {
  for (const id of ['search', 'unitFilter', 'from', 'to']) $(id).value = '';
  render();
};

$('print').onclick = () => window.print();

// ส่งออก CSV พร้อมแก้ปัญหาภาษาไทยใน Excel และป้องกัน CSV Formula Injection
$('export').onclick = () => {
  const cell = s => '"' + String(s ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""') + '"';
  const rows = [
    ['วันที่', 'หน่วยงาน', 'รายการปฏิบัติ', 'หมายเหตุ', 'จำนวนรูป', 'ผู้บันทึก'],
    ...filtered().map(r => [
      thaiDate(r.date),
      r.unit,
      r.activity,
      r.note,
      Array.isArray(r.images) ? r.images.length : 0,
      r.author || 'เจ้าหน้าที่'
    ])
  ];
  const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'รายงานการปฏิบัติหน้าที่-' + localDate() + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ==========================================
// เริ่มต้นระบบทันที (ไม่มีหน้า Login)
// ==========================================
async function boot() {
  $('today').textContent = thaiDate(localDate());
  await refresh();
}

boot();
