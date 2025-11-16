import { Request, Response } from 'express';
// A. Middleware and Configuration
// B. Text and Image Event Handlers
// C. Reply Logic
// D. Error Handling
import * as line from '@line/bot-sdk';
import { processImageBuffer } from '../services/ocr.service';
import User from '../models/user.model'; // (Model สำหรับบันทึกลง DB)

// 1. ตั้งค่า Config (ดึงจาก .env)
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new line.Client(lineConfig);

// 2. [สำคัญ] สร้าง "สมองจำ" (State Management)
// นี่คือการจำว่าเราคุยค้างกับใครไว้ (สำหรับ PoC เราใช้ In-memory object)
// Key คือ userId (จาก LINE), Value คือข้อมูล parsedData ที่รอการยืนยัน
const pendingConfirmations: { [userId: string]: any } = {};

/**
 * 3. ตัวจัดการ Webhook หลัก (Main Entry Point)
 * รับ Request จาก LINE ที่ URL /webhook
 */
export const lineWebhook = async (req: Request, res: Response) => {
  // ตรวจสอบลายเซ็น (ยืนยันว่า LINE ส่งมาจริง)
  try {
    const signature = req.headers['x-line-signature'] as string;
    
    // SDK จะตรวจสอบ req.body (raw) กับ secret ให้อัตโนมัติ
    // ถ้าไม่ตรง SDK จะโยน Error ออกมา
    if (!line.validateSignature(JSON.stringify(req.body), lineConfig.channelSecret, signature)) {
       throw new Error('Invalid signature');
    }
    
    // ถ้าลายเซ็นถูกต้อง, ส่ง 200 OK กลับไปให้ LINE ทันที
    // (LINE ไม่รอคำตอบ แค่ต้องการรู้ว่าเราได้รับ Event แล้ว)
    res.status(200).send(); 
    
    // วน Loop จัดการทุก Event ที่ LINE ส่งมา (เผื่อส่งมาหลายอัน)
    const events: line.WebhookEvent[] = req.body.events;
    for (const event of events) {
      if (event.type === 'message') {
        await handleMessageEvent(event);
      }
      // (เราสามารถเพิ่ม event 'follow' (แอดเพื่อน) หรือ 'postback' (กดปุ่ม) ที่นี่ได้ในอนาคต)
    }
  } catch (error: any) {
    console.error('Webhook Error:', error.message);
    // ส่ง 500 กลับไป (ถ้าลายเซ็นไม่ตรง หรือมีปัญหา)
    res.status(500).send();
  }
};

/**
 * 4. ตัวจัดการ Event (แยกตามประเภทข้อความ)
 */
async function handleMessageEvent(event: line.MessageEvent) {
  const userId = event.source.userId; // ID ของผู้ใช้ที่ส่งมา
  if (!userId) return; // ถ้าไม่มี userId (เช่น คุยในกลุ่มที่ไม่ได้แอด) ให้ออก

  // --- A. กรณีผู้ใช้ส่ง "รูปภาพ" ---
  if (event.message.type === 'image') {
    
    try {
      // 1. ดึงรูปภาพจาก LINE มาเป็น Buffer
      const imageBuffer = await getImageBufferFromLine(event.message.id);

      // 2. ส่งไป OCR และ Parse (เรียกใช้ Logic กลางจาก ocr.service.ts)
      const { rawText, parsedData } = await processImageBuffer(imageBuffer);

      if (!parsedData || !parsedData.idNumber) {
        // ถ้าอ่านได้ แต่ไม่เจอเลขบัตร (ซึ่งจำเป็น)
        await replyMessage(event.replyToken, 'ขออภัยครับ บอทไม่สามารถอ่าน "เลขบัตรประชาชน" จากรูปได้ กรุณาลองใหม่อีกครั้งครับ');
        return;
      }

      // 3. [State] เก็บข้อมูลที่ Parse ได้ "ชั่วคราว"
      pendingConfirmations[userId] = parsedData;

      // 4. สร้างข้อความตอบกลับเพื่อ "ยืนยัน"
      const confirmationText = `
ข้อมูลที่อ่านได้:
เลขบัตร: ${parsedData.idNumber}
ชื่อ: ${parsedData.prefixThai} ${parsedData.firstNameThai} ${parsedData.lastNameThai}
วันเกิด: ${parsedData.dob} (YYYY-MM-DD)
ที่อยู่: ${parsedData.address}

ข้อมูลถูกต้องหรือไม่?
(กรุณาพิมพ์ "ถูก" เพื่อยืนยัน หรือส่งรูปใหม่หากข้อมูลผิด)
      `.trim(); // .trim() เพื่อลบช่องว่างหัวท้าย

      await replyMessage(event.replyToken, confirmationText);

    } catch (ocrError) {
      console.error('OCR Service Error:', ocrError);
      await replyMessage(event.replyToken, 'ขออภัยครับ เกิดข้อผิดพลาดในการอ่านรูปภาพ (อาจจะไฟล์ใหญ่ไป หรือ Typhoon API มีปัญหา)');
    }
  }

  // --- B. กรณีผู้ใช้ส่ง "ข้อความ" ---
  if (event.message.type === 'text') {
    const userText = event.message.text.trim();

    // B1. กรณีพิมพ์ "ถูก" (และต้องมีข้อมูลค้างอยู่)
    if (userText === 'ถูก' && pendingConfirmations[userId]) {
      
      const dataToSave = pendingConfirmations[userId];
      
      try {
        // 5. บันทึกลง DB
        const newUser = new User(dataToSave);
        await newUser.save();
        
        // 6. [State] ลบข้อมูลที่ค้างอยู่ออก (สำคัญมาก!)
        delete pendingConfirmations[userId];

        await replyMessage(event.replyToken, `บันทึกข้อมูลคุณ ${dataToSave.firstNameThai} (เลขบัตร: ${dataToSave.idNumber}) เรียบร้อยแล้วครับ!`);

      } catch (dbError: any) {
        // [State] ลบข้อมูลค้างออกเสมอ ไม่ว่าจะ Save สำเร็จหรือไม่
        delete pendingConfirmations[userId];

        if (dbError.code === 11000) { // Error เลขบัตรซ้ำ
          await replyMessage(event.replyToken, `ข้อมูลเลขบัตร ${dataToSave.idNumber} นี้ ถูกบันทึกในระบบแล้วครับ (ไม่บันทึกซ้ำ)`);
        } else {
          console.error('Database Save Error:', dbError);
          await replyMessage(event.replyToken, 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูลครับ');
        }
      }
    }
    // B2. กรณีผู้ใช้พิมพ์อย่างอื่น ในขณะที่รอ "ถูก"
    else if (pendingConfirmations[userId]) {
       await replyMessage(event.replyToken, "กรุณาพิมพ์ 'ถูก' เพื่อยืนยันข้อมูล หรือส่งรูปใหม่ครับ");
    }
    // B3. กรณีทักทายเฉยๆ (ไม่มีข้อมูลค้าง)
    else {
       await replyMessage(event.replyToken, 'สวัสดีครับ กรุณาส่งรูปบัตรประชาชนเพื่อเริ่มทำการ OCR ครับ');
    }
    // (ส่วนนี้คือส่วนที่เราจะทำ "การแก้ไข" ที่คุณพูดถึงในอนาคต เช่น "ผิด, ที่อยู่=...")
  }
}

/**
 * 5. Helper ดึง Buffer รูปภาพจาก LINE
 * @param messageId ID ของข้อความรูปภาพ
 * @returns Buffer ของไฟล์รูปภาพ
 */
async function getImageBufferFromLine(messageId: string): Promise<Buffer> {
  const stream = await client.getMessageContent(messageId);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * 6. Helper Function สำหรับการ Reply (เพื่อจัดการ Error ในที่เดียว)
 * @param replyToken Token สำหรับตอบกลับ
 * @param text ข้อความที่จะส่ง
 */
async function replyMessage(replyToken: string, text: string) {
  try {
    await client.replyMessage(replyToken, {
      type: 'text',
      text: text,
    });
  } catch (replyError) {
    console.error('LINE Reply Error:', replyError);
  }
}