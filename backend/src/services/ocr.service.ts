import axios from 'axios';
import FormData from 'form-data';

// --- (1) Parsing Helpers (ย้ายมาจาก Controller) ---

// Helper 1.1: Map เดือนไทย
const thaiMonths: { [key: string]: string } = {
  'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04',
  'พ.ค.': '05', 'มิ.ย.': '06', 'ก.ค.': '07', 'ส.ค.': '08',
  'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12',
};

/**
 * Helper 1.2: แปลงวันที่แบบไทย (เช่น "14 ม.ค. 2523") เป็น ISO (YYYY-MM-DD)
 * (ใช้เวอร์ชันที่แก้ Error 'possibly undefined' แล้ว)
 */
function parseThaiDate(dateString: string): string {
  // input: "14 ม.ค. 2523"
  
  // 1. ใช้ Destructuring ดึงค่าออกมาใส่ตัวแปรใหม่
  const [dayPart, monthPart, yearPart] = dateString.split(' ');

  // 2. ตรวจสอบว่าตัวแปรใหม่นี้มีค่าจริงๆ (ไม่ใช่ undefined)
  if (!dayPart || !monthPart || !yearPart) {
    return ''; // ถ้าไม่มีส่วนใดส่วนหนึ่ง ให้ return ออกไปเลย
  }

  // 3. (ปลอดภัยแล้ว) ตอนนี้ TypeScript รู้ว่า 3 ตัวนี้เป็น string
  const day = dayPart.padStart(2, '0');
  const month = thaiMonths[monthPart]; // ดึงค่าจาก Map
  const year = parseInt(yearPart) - 543; // พ.ศ. -> ค.ศ.

  // 4. ตรวจสอบว่าแปลงค่าสำเร็จ (month ไม่ undefined และ year เป็นตัวเลข)
  if (!month || isNaN(year)) return ''; 

  return `${year}-${month}-${day}`; // "1980-01-14"
}

/**
 * Helper 1.3: Interface สำหรับเก็บข้อมูลที่ Parse แล้ว (ฉบับสมบูรณ์)
 */
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
  religion: string | null;
}

/**
 * Helper 1.4: ฟังก์ชันหลักในการ Parse ด้วย Regex (ฉบับสมบูรณ์)
 * คืนค่า null ถ้าฟิลด์ไหนหาไม่เจอ
 */
function parseThaiIDCard(rawText: string): ParsedIDCardData {
  const data: ParsedIDCardData = {
    idNumber: null,
    prefixThai: null,
    firstNameThai: null,
    lastNameThai: null,
    prefixEng: null,
    firstNameEng: null,
    lastNameEng: null,
    dob: null,
    address: null,
    dateOfIssue: null,
    dateOfExpiry: null,
    religion: null,
  };

  try {
    // 1. เลขบัตร (เหมือนเดิม)
    let idMatch = rawText.match(/เลขประจำตัวประชาชน\s*([\d\s]{13,})/);
    if (idMatch && idMatch[1]) {
      data.idNumber = idMatch[1].replace(/\s/g, ''); 
    }

    // 2. ชื่อไทย (เหมือนเดิม)
    let thaiNameMatch = rawText.match(
      /ชื่อตัวและชื่อสกุล\s*(นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.)\s*([^\s]+)\s*([^\n\r]+)/
    );
    if (thaiNameMatch && thaiNameMatch[1] && thaiNameMatch[2] && thaiNameMatch[3]) {
      data.prefixThai = thaiNameMatch[1].trim();
      data.firstNameThai = thaiNameMatch[2].trim();
      data.lastNameThai = thaiNameMatch[3].trim();
    }

    // 3. ชื่ออังกฤษ
    // 3a. First Name (เหมือนเดิม)
    let engNameMatch = rawText.match(/Name\s*([A-Za-z\.]+)\s*([A-Za-z]+)/);
    if (engNameMatch && engNameMatch[1] && engNameMatch[2]) {
      data.prefixEng = engNameMatch[1].trim();
      data.firstNameEng = engNameMatch[2].trim();
    }

    // 3b. Last Name [FIX]
    // แก้ไข: เปลี่ยน "Last Name" (2 คำ) เป็น "Last name" (n เล็ก)
    let engLastNameMatch = rawText.match(/[Ll]ast\s*name\s*([A-Za-z]+)/);
    if (engLastNameMatch && engLastNameMatch[1]) {
      data.lastNameEng = engLastNameMatch[1].trim();
    }

    // 4. วันเกิด (เหมือนเดิม)
    let dobMatch = rawText.match(/เกิดวันที่\s*(\d{1,2}\s*[ก-๙\.]+\s*\d{4})/);
    if (dobMatch && dobMatch[1]) {
      data.dob = parseThaiDate(dobMatch[1]);
    }

    // 5. [เพิ่มใหม่] ศาสนา
    // หาคำว่า "ศาสนา" แล้วเอาข้อความที่อยู่ข้างหลังมา
    let religionMatch = rawText.match(/ศาสนา\s*([^\n\r]+)/);
    if (religionMatch && religionMatch[1]) {
      data.religion = religionMatch[1].trim();
    }

    // 6. ที่อยู่ (เหมือนเดิม)
    let addressMatch = rawText.match(/ที่อยู่\s*([^\n\r]+)/);
    if (addressMatch && addressMatch[1]) {
      data.address = addressMatch[1].trim();
    }

    // 7. วันออกบัตร [FIX]
    // แก้ไข: สลับลำดับ จาก (วันที่) (คำ) เป็น (คำ) (วันที่)
    let issueDateMatch = rawText.match(
      /วันออกบัตร\s*(\d{1,2}\s*[ก-๙\.]+\s*\d{4})/
    );
    if (issueDateMatch && issueDateMatch[1]) {
      data.dateOfIssue = parseThaiDate(issueDateMatch[1]);
    }

    // 8. วันหมดอายุ [FIX]
    // แก้ไข: สลับลำดับ เหมือนวันออกบัตร
    let expiryDateMatch = rawText.match(
      /วันบัตรหมดอายุ\s*(\d{1,2}\s*[ก-๙\.]+\s*\d{4})/
    );
    if (expiryDateMatch && expiryDateMatch[1]) {
      data.dateOfExpiry = parseThaiDate(expiryDateMatch[1]);
    }

  } catch (error) {
    console.error('Error during parsing:', error);
  }

  return data;
}

// --- (2) Main Service Function (Exported) ---

/**
 * นี่คือ Service หลัก (สมองกลาง)
 * รับ Buffer ของรูปภาพ (จาก LINE หรือจาก cURL/Multer)
 * คืนค่า rawText และ parsedData
 * @param imageBuffer Buffer ของไฟล์รูปภาพ
 * @param filename ชื่อไฟล์ (สำหรับส่งให้ FormData)
 * @returns Promise<{ rawText: string, parsedData: ParsedIDCardData }>
 */
export async function processImageBuffer(imageBuffer: Buffer, filename: string = 'image.png') {
  
  // 1. ดึง API Key
  const apiKey = process.env.OPEN_TYPHOON_API_KEY;
  if (!apiKey) {
    throw new Error('OPEN_TYPHOON_API_KEY is not configured.');
  }

  // 2. สร้าง FormData เพื่อส่งไปหา Typhoon
  const formData = new FormData();
  formData.append('file', imageBuffer, { filename });
  formData.append('model', 'typhoon-ocr');
  formData.append('task_type', 'default');
  formData.append('max_tokens', '16000');
  formData.append('temperature', '0.1');
  formData.append('top_p', '0.6');
  formData.append('repetition_penalty', '1.1');

  // 3. ยิง API ไปหา Typhoon ด้วย Axios
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

  // 4. ดึงข้อความดิบ (rawText) ออกจากผลลัพธ์
  const result = response.data;
  let extractedText = '';

  const pageResult = result.results?.[0];
  if (pageResult?.success && pageResult.message) {
    extractedText = pageResult.message.choices[0].message.content;
  } else {
    // ถ้า Typhoon ประมวลผลไม่สำเร็จ ให้โยน Error
    throw new Error(pageResult?.error || 'OCR processing failed');
  }

  // 5. Parse ข้อความดิบ (เรียก Helper 1.4)
  const parsedData = parseThaiIDCard(extractedText);

  // 6. คืนค่าทั้ง 2 ส่วนให้ Controller (LINE หรือ OCR)
  return { rawText: extractedText, parsedData: parsedData };
}