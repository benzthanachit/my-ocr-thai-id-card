# 🤖 PoC ระบบอ่านบัตรประชาชนไทยด้วย OCR ผ่าน LINE Bot

นี่คือโปรเจกต์ Proof of Concept (PoC) สำหรับสร้างระบบอ่านข้อมูลจากรูปภาพบัตรประชาชนไทย โดยใช้ **LINE Bot** เป็น Interface (Frontend) และมี **Node.js** เป็น Backend ที่เชื่อมต่อกับ **OpenTyphoon API** (สำหรับ OCR) และ **MongoDB** (สำหรับเก็บข้อมูล)

## 🌟 คุณสมบัติหลัก (Features)

  * **LINE Bot Interface:** ผู้ใช้สามารถส่งรูปบัตรประชาชนผ่านแชท LINE ได้โดยตรง
  * **High-Accuracy OCR:** ใช้ **Typhoon 1.5** (OpenTyphoon API) ในการอ่านข้อความจากภาพ
  * **Smart Parsing:** ใช้ Regular Expressions (Regex) เพื่อตัดแบ่ง `rawText` ที่อ่านได้ ให้กลายเป็นข้อมูลที่มีโครงสร้าง (JSON)
  * **Conversational Flow:** บอทมี "สมอง" (Stateful) ในการจดจำข้อมูลที่ Parse ได้ และส่งกลับไปถามผู้ใช้เพื่อ **"ยืนยัน"** (เช่น พิมพ์ "ถูก")
  * **Database Integration:** เมื่อผู้ใช้ยืนยันข้อมูล บอทจะนำข้อมูลนั้นไปบันทึกลง **MongoDB** โดยอัตโนมัติ
  * **Error Handling:** รองรับการแจ้งเตือนเมื่อ OCR อ่านข้อมูลสำคัญ (เช่น เลขบัตร) ไม่ได้ หรือเมื่อข้อมูลเลขบัตรซ้ำในฐานข้อมูล

## 🛠️ สถาปัตยกรรมและเครื่องมือ (Tech Stack)

  * **Frontend (Interface):** LINE Messaging API
  * **Backend:** Node.js, Express.js, TypeScript
  * **Database:** MongoDB (เชื่อมต่อผ่าน Mongoose)
  * **OCR Service:** OpenTyphoon API (Typhoon 1.5)
  * **Local Tunneling:** `ngrok` (สำหรับให้ LINE คุยกับ `localhost` ได้)
  * **Libraries หลัก:**
      * `@line/bot-sdk` (สำหรับจัดการ Webhook และส่งข้อความ LINE)
      * `axios` (สำหรับยิง OpenTyphoon API)
      * `multer` (สำหรับรับไฟล์อัปโหลด - ใช้ใน Route `/api/ocr` เดิม)
      * `mongoose` (สำหรับจัดการ MongoDB)

-----

## 🚀 การติดตั้งและตั้งค่า (Installation & Setup)

### 1\. 📋 สิ่งที่ต้องมี (Prerequisites)

1.  **Node.js** (เวอร์ชัน LTS 18.x ขึ้นไป)
2.  **MongoDB Community Server** (ต้องรัน Service ไว้ในเครื่อง)
3.  **ngrok** (สำหรับสร้าง Tunnel)
4.  **บัญชี LINE Developers** (สำหรับสร้าง Bot)
5.  **API Key ของ OpenTyphoon** (สำหรับ OCR)

### 2\. 📁 การติดตั้งโปรเจกต์ (Backend)

1.  (ถ้ามี) Clone โปรเจกต์ หรือแตกไฟล์โปรเจกต์
2.  เปิด Terminal ไปที่โฟลเดอร์ `backend`:
    ```bash
    cd E:\benzondata\my_code\my-ocr-thai-id-card\backend
    ```
3.  ติดตั้ง Dependencies ทั้งหมด:
    ```bash
    npm install
    ```

### 3\. 🔑 การตั้งค่า Environment (.env)

นี่คือขั้นตอนที่ **สำคัญที่สุด**

1.  สร้างไฟล์ใหม่ชื่อ `.env` ในโฟลเดอร์ `backend`

2.  Copy เนื้อหาด้านล่างนี้ไปวาง แล้ว **แทนที่ค่า** ทั้ง 5 ค่า ให้เป็นของคุณ:

    ```.env
    # 1. MongoDB Connection String (ใช้ค่านี้ได้เลยถ้ารัน MongoDB ที่เครื่อง)
    MONGO_URI=mongodb://localhost:27017/user-poc-db

    # 2. Port ที่ Backend จะรัน
    PORT=5000

    # 3. API Key จาก OpenTyphoon
    OPEN_TYPHOON_API_KEY=sk-xxxx-xxxxxxxxx

    # 4. Token จาก LINE Developers (แท็บ Messaging API -> กด Issue)
    LINE_CHANNEL_ACCESS_TOKEN=xxxxxxxxx

    # 5. Secret จาก LINE Developers (แท็บ Basic settings)
    LINE_CHANNEL_SECRET=xxxxxxxxx
    ```

-----

## ⚡ วิธีการรันและใช้งาน (Usage)

เราต้องรัน 2 โปรแกรมพร้อมกัน (Backend และ ngrok)

### ขั้นตอนที่ 1: รัน Backend Server

1.  เปิด Terminal ที่ 1 (ใน VSCode)
2.  ไปที่โฟลเดอร์ `backend`
3.  รันคำสั่ง `dev` (ซึ่งจะใช้ `nodemon` สตาร์ทเซิร์ฟเวอร์):
    ```bash
    npm run dev
    ```
4.  รอจนกว่าคุณจะเห็นข้อความ:
    `Server is running on http://localhost:5000`
    `MongoDB Connected...`

### ขั้นตอนที่ 2: รัน Ngrok (เปิดประตูบ้าน)

1.  เปิด Terminal ที่ 2 (อันใหม่)
2.  รันคำสั่ง `ngrok` เพื่อชี้ไปที่ `PORT` ที่เราตั้งไว้ (คือ 5000):
    ```bash
    ngrok http 5000
    ```
3.  `ngrok` จะแสดงผลลัพธ์ ให้ **Copy URL** ที่เป็น `https://` (เช่น `https://1234-abcd-5678.ngrok-free.app`)

### ขั้นตอนที่ 3: ตั้งค่า LINE Bot Webhook

1.  ไปที่ [LINE Developers Console](https://www.google.com/search?q=https://developers.line.biz/th/) แล้วเลือกบอทของคุณ
2.  ไปที่แท็บ **"Messaging API"**
3.  หาช่อง **"Webhook URL"** แล้วกด "Edit"
4.  **วาง URL** ที่ได้จาก `ngrok` (ข้อ 2.3) แล้ว **ต่อท้ายด้วย `/webhook`**
      * ตัวอย่าง: `https://1234-abcd-5678.ngrok-free.app/webhook`
5.  กด "Save"
6.  เปิดสวิตช์ **"Use webhook"** (สำคัญมาก)
7.  (แนะนำ) ปิด "Auto-reply messages" (ข้อความตอบกลับอัตโนมัติ) เพื่อให้บอทเราควบคุม 100%

### ขั้นตอนที่ 4: ทดสอบ Flow การทำงาน

1.  ไปที่แท็บ **"Basic settings"** ใน LINE Developers Console
2.  คุณจะเห็น **QR Code** ของบอท
3.  ใช้มือถือของคุณ สแกน QR Code นี้เพื่อแอดบอทเป็นเพื่อน
4.  **เปิดแชท LINE** กับบอท
5.  **ส่งรูปบัตรประชาชน** (รูปที่คุณใช้ทดสอบ) เข้าไปในแชท
6.  **รอสักครู่:** บอทควรจะตอบกลับมาพร้อม `rawText` และ `parsedData` ที่อ่านได้ทั้งหมด และถามว่า "ข้อมูลถูกต้องหรือไม่?"
7.  **พิมพ์ "ถูก"** แล้วส่ง
8.  **รอสักครู่:** บอทควรจะตอบกลับว่า "บันทึกข้อมูลเรียบร้อยแล้วครับ\!"
9.  **(ทดสอบ Error)** ลองส่งรูป **ใบเดิม** ซ้ำอีกครั้ง บอทควรตอบว่า "ข้อมูลเลขบัตรนี้ ถูกบันทึกในระบบแล้วครับ"

-----

## 🗂️ โครงสร้างไฟล์ (ที่สำคัญ)

```
backend/
├── src/
│   ├── configs/
│   │   └── db.ts           # (เชื่อมต่อ MongoDB)
│   ├── controllers/
│   │   ├── user.controller.ts  # (Logic CRUD API เดิม)
│   │   └── line.webhook.ts   # (Logic ของ LINE Bot)
│   ├── models/
│   │   └── user.model.ts     # (Schema ของ MongoDB ที่อัปเกรดแล้ว)
│   ├── routes/
│   │   ├── user.routes.ts    # (Endpoints /api/users)
│   │   └── ocr.routes.ts     # (Endpoints /api/ocr)
│   ├── services/
│   │   └── ocr.service.ts    # (สมองกลาง: ยิง Typhoon API + Parser)
│   └── index.ts              # (ไฟล์หลัก รัน Express + ผูก Routes)
├── .env                    # (เก็บ API Keys และ Secrets)
├── package.json
└── tsconfig.json
```