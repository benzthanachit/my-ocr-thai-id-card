import mongoose, { Schema, Document } from 'mongoose';

// 1. อัปเดต Interface ให้ตรงกับ parsedData
export interface IUser extends Document {
  idNumber: string; // ฟิลด์เดียวที่บังคับ

  // ข้อมูลชื่อภาษาไทย (Optional)
  prefixThai?: string;
  firstNameThai?: string;
  lastNameThai?: string;

  // ข้อมูลชื่อภาษาอังกฤษ (Optional)
  prefixEng?: string;
  firstNameEng?: string;
  lastNameEng?: string;

  // ข้อมูลอื่นๆ (Optional)
  dob?: Date; // เราจะเก็บเป็น Date (Mongoose แปลง "YYYY-MM-DD" ให้)
  address?: string;
  dateOfIssue?: Date;
  dateOfExpiry?: Date;
}

// 2. อัปเดต Schema ให้ตรงกับ Interface
const UserSchema: Schema = new Schema(
  {
    // *** นี่คือฟิลด์เดียวที่บังคับ และต้องไม่ซ้ำ ***
    idNumber: { type: String, required: true, unique: true },

    prefixThai: { type: String },
    firstNameThai: { type: String },
    lastNameThai: { type: String },

    prefixEng: { type: String },
    firstNameEng: { type: String },
    lastNameEng: { type: String },

    dob: { type: Date }, // Mongoose จะแปลง "1980-01-14" เป็น Date object 
    address: { type: String },
    dateOfIssue: { type: Date },
    dateOfExpiry: { type: Date },
  },
  { timestamps: true } // เก็บ createdAt, updatedAt อัตโนมัติ
);

export default mongoose.model<IUser>('User', UserSchema);