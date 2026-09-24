# คู่มือการติดตั้งระบบ สมุดปฏิบัติหน้าที่ (Duty Report)
## บน GitHub Pages และเชื่อมต่อฐานข้อมูล Google Drive

ระบบนี้ถูกออกแบบให้ทำงานร่วมกันอย่างสมบูรณ์แบบระหว่าง **GitHub Pages** (โฮสต์เว็บแอปฟรี) และ **Google Drive** (ฐานข้อมูลและที่เก็บรูปภาพฟรี) โดยมี **Google Apps Script** ทำหน้าที่เป็น Cloud API เชื่อมต่อระหว่างกัน

---

## ขั้นตอนที่ 1: ติดตั้ง Cloud API บน Google Drive (ใช้เวลา 2 นาที)

1. เปิดเบราว์เซอร์ไปที่ [script.google.com](https://script.google.com) ด้วยบัญชี Google ที่คุณต้องการใช้เก็บข้อมูล
2. กดปุ่ม **"โครงการใหม่" (New Project)** ที่มุมซ้ายบน
3. ลบโค้ดเริ่มต้นในหน้าต่างออกทั้งหมด
4. เปิดไฟล์ `google-apps-script/Code.gs` ในโฟลเดอร์นี้ แล้วคัดลอกโค้ดทั้งหมดมาวาง
5. กดเปลี่ยนชื่อโครงการด้านบน (เช่น ตั้งว่า `Duty-Report-API`) แล้วกดรูปแผ่นดิสก์ **บันทึก (Save)**
6. กดปุ่มสีน้ำเงิน **ทำให้ใช้งานได้ (Deploy)** ที่มุมขวาบน > เลือก **การทำให้ใช้งานได้รายการใหม่ (New deployment)**
7. กดที่รูปฟันเฟือง (Select type) เลือก **เว็บแอป (Web app)**
8. ตั้งค่าดังนี้:
   - **คำอธิบาย (Description):** `Duty Report API`
   - **ดำเนินการในฐานะ (Execute as):** **ฉัน (Me)**
   - **ผู้ที่มีสิทธิ์เข้าถึง (Who has access):** **ทุกคน (Anyone)** *(เพื่อให้ระบบเว็บสามารถเชื่อมต่อได้)*
9. กดปุ่ม **ทำให้ใช้งานได้ (Deploy)**
10. ระบบจะขออนุญาตเข้าถึง Google Drive ให้กด **ให้สิทธิ์เข้าถึง (Authorize access)** > เลือกบัญชี Google ของคุณ > กด **ขั้นสูง (Advanced)** > กด **ไปยัง Duty-Report-API (ไม่ปลอดภัย)** > กด **อนุญาต (Allow)**
11. คัดลอก **URL เว็บแอป (Web app URL)** เก็บไว้ (มีลักษณะเป็น `https://script.google.com/macros/s/.../exec`)

> **สิ่งที่ระบบจะสร้างให้อัตโนมัติบน Google Drive ของคุณ:**
> เมื่อเชื่อมต่อครั้งแรก ระบบจะสร้างโฟลเดอร์ชื่อ **`duty-report`** และโฟลเดอร์ย่อย **`photos`** บน Google Drive ของคุณ เพื่อเก็บไฟล์ฐานข้อมูล `records.json` และไฟล์รูปภาพจริงแยกไว้เป็นสัดส่วน

---

## ขั้นตอนที่ 2: นำระบบขึ้น GitHub Pages

1. เข้าสู่ระบบ [github.com](https://github.com)
2. กดปุ่มสร้าง Repository ใหม่ (New repository):
   - Repository name: `duty-report`
   - เลือกเป็น **Public**
   - กด **Create repository**
3. อัปโหลดไฟล์จากโฟลเดอร์ `duty-report` นี้ขึ้นไป (ไฟล์สำคัญคือ `index.html`, `app.js`, `style.css`, `favicon.svg`)
   - หรือหากใช้ Git บนคอมพิวเตอร์ สามารถรันคำสั่ง:
     ```bash
     git init
     git add .
     git commit -m "Deploy Duty Report to GitHub Pages"
     git branch -M main
     git remote add origin https://github.com/<ชื่อผู้ใช้ของคุณ>/duty-report.git
     git push -u origin main
     ```
4. ไปที่เมนู **Settings** ของ Repository บน GitHub
5. เลือกหัวข้อ **Pages** ที่เมนูด้านซ้าย
6. ในส่วน **Build and deployment**:
   - Source: `Deploy from a branch`
   - Branch: เลือก `main` และโฟลเดอร์ `/ (root)`
   - กด **Save**
7. รอประมาณ 1-2 นาที GitHub จะสร้าง URL สำหรับเปิดเว็บ เช่น:
   `https://<your-username>.github.io/duty-report/`

---

## ขั้นตอนที่ 3: เปิดใช้งานและเชื่อมต่อระบบ

1. เปิดลิงก์ GitHub Pages บนคอมพิวเตอร์ แท็บเล็ต หรือสมาร์ตโฟน
2. ที่หน้าเข้าสู่ระบบ กดปุ่ม **"⚙ ตั้งค่า"** (ตรงแถบสถานะคลาวด์)
3. วาง **URL เว็บแอป (Web app URL)** ที่คัดลอกมาจากขั้นตอนที่ 1 ลงในช่อง
4. กดปุ่ม **"ทดสอบการเชื่อมต่อ"** ระบบจะขึ้นข้อความสีเขียวว่า:
   `✓ เชื่อมต่อสำเร็จ! เข้าถึงโฟลเดอร์ "duty-report" ใน Google Drive เรียบร้อย`
5. กดปุ่ม **"บันทึกการตั้งค่า"**
6. เข้าสู่ระบบเพื่อเริ่มใช้งาน:
   - **สำหรับเจ้าหน้าที่ (บันทึก/แก้ไข/ลบ/แนบรูป):**
     - ชื่อผู้ใช้: `staff`
     - รหัสผ่าน: `staff1234`
   - **สำหรับผู้บริหาร (ดูรายงาน/สถิติ/ค้นหา/ส่งออก CSV/พิมพ์ PDF):**
     - ชื่อผู้ใช้: `director`
     - รหัสผ่าน: `director1234`

---

## การเปลี่ยนรหัสผ่าน
หากต้องการเปลี่ยนรหัสผ่านของ `staff` หรือ `director` ในโหมด Google Drive:
1. เข้าไปที่ [script.google.com](https://script.google.com) ในโปรเจกต์ `Duty-Report-API`
2. แก้ไขรหัสผ่านตรงส่วน `CONFIG.ACCOUNTS` ในไฟล์ `Code.gs`
3. กดปุ่ม **Deploy > Manage deployments > Edit > New version > Deploy** รหัสผ่านใหม่จะมีผลทันที
