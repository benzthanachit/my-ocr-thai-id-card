import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './configs/db';
import userRoutes from './routes/user.routes';
import ocrRoutes from './routes/ocr.routes';
import { lineWebhook } from './controllers/line.webhook';

dotenv.config();
connectDB();

const app = express();
const port = process.env.PORT || 5000;

// Middlewares
app.use(cors()); // อนุญาตให้ React (ที่รันคนละ port) เรียก API นี้ได้
app.use(express.json()); // ให้ Express อ่าน JSON body ได้

// Routes
app.use('/api', userRoutes);
app.use('/api', ocrRoutes);
app.post('/webhook', lineWebhook);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});