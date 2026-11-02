const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());

const upload = multer({ dest: 'uploads/' });

// 1. MONGODB ATLAS CONNECTION
const MONGO_URI = 'mongodb+srv://admin:admin12345@cluster0.ohnfrd3.mongodb.net/school_erp?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Atlas Connected Successfully! 🚀'))
  .catch(err => console.error('DB Connection Error:', err));

// 2. SCHEMAS & MODELS
const studentSchema = new mongoose.Schema({
  rollNo: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  standard: { type: String, required: true },
  parentName: { type: String, required: true },
  parentPhone: { type: String, required: true },
  totalFee: { type: Number, required: true },
  paidFee: { type: Number, default: 0 },
  marks: {
    telugu: { type: Number, default: 0 },
    english: { type: Number, default: 0 },
    maths: { type: Number, default: 0 },
    science: { type: Number, default: 0 },
    social: { type: Number, default: 0 }
  }
});

const attendanceSchema = new mongoose.Schema({
  date: { type: String, required: true },
  standard: { type: String, required: true },
  records: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    rollNo: String,
    name: String,
    status: { type: String, enum: ['Present', 'Absent'], default: 'Present' }
  }]
});

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  desc: { type: String, required: true },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] }
});

const teacherSchema = new mongoose.Schema({
  teacherId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  designation: { type: String, required: true },
  monthlySalary: { type: Number, required: true },
  unpaidLeaves: { type: Number, default: 0 }
});

const Student = mongoose.model('Student', studentSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Notice = mongoose.model('Notice', noticeSchema);
const Teacher = mongoose.model('Teacher', teacherSchema);

// 3. API ROUTES
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.status(201).json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/students/:id', async (req, res) => {
  try {
    const updated = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update student' });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

app.get('/api/fees/pending', async (req, res) => {
  try {
    const pending = await Student.find({ $expr: { $gt: ['$totalFee', '$paidFee'] } });
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending fees' });
  }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const { date, standard, records } = req.body;
    const updated = await Attendance.findOneAndUpdate(
      { date, standard },
      { date, standard, records },
      { upsert: true, new: true }
    );
    res.json({ message: 'Attendance saved successfully!', data: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save attendance' });
  }
});

app.get('/api/attendance', async (req, res) => {
  try {
    const { date, standard } = req.query;
    const result = await Attendance.findOne({ date, standard });
    res.json(result || { records: [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

app.get('/api/notices', async (req, res) => {
  try {
    const notices = await Notice.find().sort({ _id: -1 });
    res.json(notices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notices' });
  }
});

app.post('/api/notices', async (req, res) => {
  try {
    const notice = new Notice(req.body);
    await notice.save();
    res.status(201).json(notice);
  } catch (err) {
    res.status(400).json({ error: 'Failed to post notice' });
  }
});

app.get('/api/teachers/payroll', async (req, res) => {
  try {
    const teachers = await Teacher.find();
    const payroll = teachers.map(t => {
      const perDay = t.monthlySalary / 26;
      const cut = t.unpaidLeaves * perDay;
      return {
        ...t.toObject(),
        netSalary: Math.round(t.monthlySalary - cut)
      };
    });
    res.json(payroll);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payroll' });
  }
});

app.post('/api/students/upload-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please upload an Excel file' });
    const workbook = xlsx.readFile(req.file.path);
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const formatted = sheetData.map(item => ({
      rollNo: String(item.rollNo),
      name: item.name,
      standard: item.standard,
      parentName: item.parentName || 'Parent',
      parentPhone: String(item.parentPhone),
      totalFee: Number(item.totalFee),
      paidFee: Number(item.paidFee || 0),
      marks: {
        telugu: Number(item.telugu || 0),
        english: Number(item.english || 0),
        maths: Number(item.maths || 0),
        science: Number(item.science || 0),
        social: Number(item.social || 0)
      }
    }));

    await Student.insertMany(formatted, { ordered: false });
    fs.unlinkSync(req.file.path);
    res.json({ message: 'Excel imported successfully!' });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// Seed Data
app.get('/api/seed', async (req, res) => {
  try {
    await Student.deleteMany({});
    await Teacher.deleteMany({});
    await Attendance.deleteMany({});
    await Notice.deleteMany({});

    await Student.create([
      { rollNo: '101', name: 'Aarav Sharma', standard: 'LKG', parentName: 'R. Sharma', parentPhone: '9876543210', totalFee: 15000, paidFee: 10000, marks: { telugu: 90, english: 85, maths: 95, science: 90, social: 88 } },
      { rollNo: '102', name: 'Diya Reddy', standard: 'UKG', parentName: 'K. Reddy', parentPhone: '9876543211', totalFee: 16000, paidFee: 16000, marks: {  telugu: 92, english: 88, maths: 98, science: 94, social: 90 } },
      { rollNo: '103', name: 'Sai Charan', standard: '1st Class', parentName: 'M. Charan', parentPhone: '9876543212', totalFee: 18000, paidFee: 10000, marks: { telugu: 78, english: 70, maths: 82, science: 75, social: 72 } },
      { rollNo: '104', name: 'Bhavya Sri', standard: '2nd Class', parentName: 'V. Rao', parentPhone: '9876543213', totalFee: 20000, paidFee: 12000, marks: { telugu: 88, english: 84, maths: 89, science: 85, social: 80 } },
      { rollNo: '105', name: 'Varun Teja', standard: '3rd Class', parentName: 'N. Teja', parentPhone: '9876543214', totalFee: 22000, paidFee: 22000, marks: { telugu: 95, english: 90, maths: 96, science: 92, social: 94 } },
      { rollNo: '106', name: 'Keerthi Priya', standard: '4th Class', parentName: 'S. Priya', parentPhone: '9876543215', totalFee: 24000, paidFee: 15000, marks: { telugu: 82, english: 80, maths: 78, science: 85, social: 80 } },
      { rollNo: '107', name: 'Manish Varma', standard: '5th Class', parentName: 'T. Varma', parentPhone: '9876543216', totalFee: 25000, paidFee: 18000, marks: { telugu: 85, english: 78, maths: 90, science: 88, social: 84 } },
      { rollNo: '108', name: 'Sneha Latha', standard: '6th Class', parentName: 'G. Latha', parentPhone: '9876543217', totalFee: 28000, paidFee: 14000, marks: { telugu: 91, english: 87, maths: 94, science: 89, social: 88 } }
    ]);

    await Teacher.create([
      { teacherId: 'T-01', name: 'K. Suresh', designation: 'Primary Teacher', monthlySalary: 22000, unpaidLeaves: 1 },
      { teacherId: 'T-02', name: 'M. Ramya', designation: 'High School Faculty', monthlySalary: 25000, unpaidLeaves: 0 }
    ]);

    await Notice.create([
      { title: 'Independence Day Celebrations', desc: 'Cultural events and flag hoisting ceremony at 8:00 AM.', date: '2026-08-15' },
      { title: 'Unit Test - 1 Schedule Announced', desc: 'Examinations for classes 1st to 6th commence next Monday.', date: '2026-08-25' }
    ]);

    res.send('Demo data seeded successfully into Atlas!');
  } catch (err) {
    res.status(500).json({ error: 'Failed to seed data' });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Backend server running on http://localhost:${PORT}`));