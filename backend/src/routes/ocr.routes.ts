import { Router } from 'express';
import multer from 'multer';
import { handleOcr } from '../controllers/ocr.controller';

const router = Router();

// ตั้งค่า Multer ให้เก็บไฟล์ใน memory (เป็น Buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// สร้าง Endpoint: POST /api/ocr
// ใช้ upload.single('imageFile') เพื่อบอกว่าเรารับไฟล์ 1 ไฟล์
// ที่มีชื่อ field ว่า 'imageFile'
router.post('/ocr', upload.single('imageFile'), handleOcr);

export default router;