import { Request, Response } from 'express';
import axios from 'axios';
import FormData from 'form-data';
import User from '../models/user.model';

// --- Helper Functions ---

// Helper 1: Map เดือนไทย
const thaiMonths: { [key: string]: string } = {
  'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04',
  'พ.ค.': '05', 'มิ.ย.': '06', 'ก.ค.': '07', 'ส.ค.': '08',
  'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12',
};

/**
 * แปลงวันที่แบบไทย (เช่น "14 ม.ค. 2523") เป็น ISO format (YYYY-MM-DD)
 * @param dateString วันที่แบบไทย
 * @returns string (YYYY-MM-DD) หรือ string ว่าง ถ้าแปลงไม่ได้
 */
function parseThaiDate(dateString: string): string {
  // input: "14 ม.ค. 2523"
  
  // 1. ใช้ Destructuring ดึงค่าออกมาใส่ตัวแปรใหม่
  const [dayPart, monthPart, yearPart] = dateString.split(' ');

  // 2. ตรวจสอบว่าตัวแปรใหม่นี้มีค่าจริงๆ (ไม่ใช่ undefined)
  if (!dayPart || !monthPart || !yearPart) {
    return ''; // ถ้าไม่มีส่วนใดส่วนหนึ่ง ให้S return ออกไปเลย
  }

  // 3. (ปลอดภัยแล้ว) ตอนนี้ TypeScript รู้ว่า 3 ตัวนี้เป็น string
  const day = dayPart.padStart(2, '0');
  const month = thaiMonths[monthPart]; // Error ที่นี่จะหายไป
  const year = parseInt(yearPart) - 543; // Error ที่นี่จะหายไป

  // 4. (ปรับปรุง) เพิ่ม isNaN(year) เพื่อความปลอดภัย
  if (!month || isNaN(year)) return ''; 

  return `${year}-${month}-${day}`; 
}

// Interface สำหรับเก็บข้อมูลที่ Parse แล้ว
interface ParsedIDCardData {
  idNumber: string | null;
  
  // ข้อมูลชื่อภาษาไทย
  prefixThai: string | null;
  firstNameThai: string | null;
  lastNameThai: string | null;

  // ข้อมูลชื่อภาษาอังกฤษ
  prefixEng: string | null;
  firstNameEng: string | null;
  lastNameEng: string | null;

  // ข้อมูลอื่นๆ
  dob: string | null;
  address: string | null;
  dateOfIssue: string | null;
  dateOfExpiry: string | null;
}

/**
 * ใช้ Regex เพื่อตัดแบ่งข้อความดิบจาก OCR ให้เป็นข้อมูลที่มีโครงสร้าง
 * @param rawText ข้อความดิบที่ได้จาก Typhoon OCR
 * @returns Object (ParsedIDCardData) ที่มีค่า null ถ้าหาฟิลด์ไม่เจอ
 */
function parseThaiIDCard(rawText: string): ParsedIDCardData {
  // 1. อัปเดตค่าเริ่มต้นให้มีฟิลด์ใหม่ทั้งหมด
  const data: ParsedIDCardData = {
    idNumber: null,
    // ไทย
    prefixThai: null,
    firstNameThai: null,
    lastNameThai: null,
    // อังกฤษ
    prefixEng: null,
    firstNameEng: null,
    lastNameEng: null,
    // อื่นๆ
    dob: null,
    address: null,
    dateOfIssue: null,
    dateOfExpiry: null,
  };

  try {
    // 1. หาเลขบัตรประชาชน (เหมือนเดิม)
    let idMatch = rawText.match(/เลขประจำตัวประชาชน\s*([\d\s]{13,})/);
    if (idMatch && idMatch[1]) {
      data.idNumber = idMatch[1].replace(/\s/g, ''); 
    }

    // 2. หาชื่อ (Thai) - (อัปเดต Regex)
    // เราเปลี่ยน (?:นาย...) เป็น (นาย...) เพื่อจับกลุ่มที่ 1
    let thaiNameMatch = rawText.match(
      /ชื่อตัวและชื่อสกุล\s*(นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.)\s*([^\s]+)\s*([^\n\r]+)/
    );
    if (thaiNameMatch && thaiNameMatch[1] && thaiNameMatch[2] && thaiNameMatch[3]) {
      data.prefixThai = thaiNameMatch[1].trim();     // กลุ่มที่ 1 (นาย)
      data.firstNameThai = thaiNameMatch[2].trim(); // กลุ่มที่ 2 (หมีน้อย)
      data.lastNameThai = thaiNameMatch[3].trim();  // กลุ่มที่ 3 (คอยรัก)
    }

    // 3. หาชื่อ (English) - (เพิ่มใหม่)
    // 3a. หา Prefix และ First Name (จากบรรทัด "Name Mr. Meenoy")
    // [A-Za-z\.]+ = จับตัวอักษร A-Z และจุด (สำหรับ Mr.)
    let engNameMatch = rawText.match(/\nName\s*([A-Za-z\.]+)\s*([A-Za-z]+)/);
    if (engNameMatch && engNameMatch[1] && engNameMatch[2]) {
      data.prefixEng = engNameMatch[1].trim();     // กลุ่มที่ 1 (Mr.)
      data.firstNameEng = engNameMatch[2].trim(); // กลุ่มที่ 2 (Meenoy)
    }

    // 3b. หา Last Name (จากบรรทัด "Last Name Koyruk")
    let engLastNameMatch = rawText.match(/\nLast Name\s*([A-Za-z]+)/);
    if (engLastNameMatch && engLastNameMatch[1]) {
      data.lastNameEng = engLastNameMatch[1].trim(); // กลุ่มที่ 1 (Koyruk)
    }

    // 4. หาวันเกิด (เหมือนเดิม)
    let dobMatch = rawText.match(/เกิดวันที่\s*(\d{1,2}\s*[ก-๙.]+\s*\d{4})/);
    if (dobMatch && dobMatch[1]) {
      data.dob = parseThaiDate(dobMatch[1]);
    }

    // 5. หาที่อยู่ (เหมือนเดิม)
    let addressMatch = rawText.match(/ที่อยู่\s*([^\n\r]+)/);
    if (addressMatch && addressMatch[1]) {
      data.address = addressMatch[1].trim();
    }

    // 6. หาวันออกบัตร (เหมือนเดิม)
    let issueDateMatch = rawText.match(
      /(\d{1,2}\s*[ก-๙.]+\s*\d{4})\s*วันออกบัตร/
    );
    if (issueDateMatch && issueDateMatch[1]) {
      data.dateOfIssue = parseThaiDate(issueDateMatch[1]);
    }

    // 7. หาวันหมดอายุ (เหมือนเดิม)
    let expiryDateMatch = rawText.match(
      /(\d{1,2}\s*[ก-๙.]+\s*\d{4})\s*วันบัตรหมดอายุ/
    );
    if (expiryDateMatch && expiryDateMatch[1]) {
      data.dateOfExpiry = parseThaiDate(expiryDateMatch[1]);
    }

  } catch (error) {
    console.error('Error during parsing:', error);
  }

  return data;
}

// --- Main Controller Function ---

/**
 * Controller หลักสำหรับ Endpoint POST /api/ocr
 * 1. รับไฟล์ภาพจาก Client
 * 2. ส่งไฟล์ไปหา OpenTyphoon API
 * 3. รับผลลัพธ์ rawText
 * 4. เรียก parseThaiIDCard เพื่อแยกฟิลด์
 * 5. ส่ง JSON (parsedData) กลับไป
 */
export const handleOcr = async (req: Request, res: Response) => {
  try {
    // 1. ตรวจสอบว่ามีไฟล์ส่งมาหรือไม่ (จาก multer)
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded.' });
    }

    // 2. ดึง API Key จาก .env (ปลอดภัย)
    const apiKey = process.env.OPEN_TYPHOON_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'API Key is not configured.' });
    }

    // 3. สร้าง FormData เพื่อส่งไปหา Typhoon
    const formData = new FormData();
    formData.append('file', req.file.buffer, { filename: req.file.originalname });
    formData.append('model', 'typhoon-ocr');
    formData.append('task_type', 'default');
    formData.append('max_tokens', '16000');
    formData.append('temperature', '0.1');
    formData.append('top_p', '0.6');
    formData.append('repetition_penalty', '1.1');

    // 4. ยิง API ไปหา Typhoon ด้วย Axios
    const response = await axios.post(
      'https://api.opentyphoon.ai/v1/ocr',
      formData,
      {
        headers: {
          ...formData.getHeaders(), // สำคัญมากสำหรับ file upload
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    // 5. ดึงข้อความดิบ (rawText) ออกจากผลลัพธ์
    const result = (await response.data) as any; // (Cast as any เพื่อความง่าย)
    let extractedText = '';

    const pageResult = result.results?.[0];
    if (pageResult?.success && pageResult.message) {
      extractedText = pageResult.message.choices[0].message.content;
    } else {
      console.error('OCR Error:', pageResult?.error);
      return res
        .status(500)
        .json({ message: 'OCR processing failed', error: pageResult?.error });
    }

    // 6. Parse ข้อความดิบ
    const parsedData = parseThaiIDCard(extractedText);

    // 7. [อัปเกรด] ตรวจสอบว่าได้เลขบัตรประชาชนหรือไม่ (จำเป็น)
    if (!parsedData.idNumber) {
      return res.status(400).json({
        message: 'OCR successful, but could not parse ID Number. Not saved.',
        rawText: extractedText,
        parsedData: parsedData,
      });
    }

    // 8. [อัปเกรด] สร้างและบันทึก User ใหม่ลง DB
    const newUser = new User(parsedData); // (Mongoose จะแมปฟิลด์ให้เอง)
    const savedUser = await newUser.save(); // <-- บันทึกลง MongoDB!

    // 9. [อัปเกรด] ส่ง User ที่เพิ่งบันทึกเสร็จกลับไป
    res.status(201).json({ // 201 = Created
      message: 'OCR successful AND User saved to database!',
      savedUser: savedUser, // นี่คือข้อมูลจาก MongoDB
      rawText: extractedText,
    });

  } catch (error: any) {
    // [อัปเกรด] จัดการ Error (สำคัญ: กรณีเลขบัตรซ้ำ)
    if (error.code === 11000) {
      // 11000 คือ Mongoose/MongoDB duplicate key error
      console.error('Duplicate key error:', error.message);
      return res.status(409).json({ // 409 = Conflict
        message: 'This ID Number already exists in the database.',
        error: error.message,
      });
    }

    // Error อื่นๆ (เช่น Typhoon API พัง)
    console.error(
      'Error in handleOcr:',
      error.response?.data || error.message
    );
    res
      .status(500)
      .json({ message: 'Internal server error', details: error.message });
  }
};