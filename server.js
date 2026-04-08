const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());
app.use(cors());

// 1. Kết nối MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://db-mongo:27017/finance_db';
mongoose.connect(mongoUri)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// 2. Cấu hình Gemini AI
const API_KEY = "AIzaSyBBfgQDkV_xXklPgYrKT7BE76jnA69j1eo"; 
const genAI = new GoogleGenerativeAI(API_KEY);

// 3. Schema dữ liệu
const Transaction = mongoose.model('Transaction', new mongoose.Schema({
  content: String,
  amount: Number,
  category: String,
  date: { type: Date, default: Date.now }
}));

// [API]: Phân tích AI
app.post('/api/add-ai', async (req, res) => {
  console.log("📩 Nhận yêu cầu AI cho câu:", req.body.text);
  try {
    const { text } = req.body;
    
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `
      Hôm nay là ${new Date().toISOString()}.
      Phân tích câu chi tiêu: "${text}". 
      Yêu cầu: Tách các món chi tiêu riêng biệt. Tính đúng ngày của tuần này.
      Trả về DUY NHẤT một mảng JSON chuẩn: [{"amount": số, "category": "loại", "content": "nội dung", "date": "YYYY-MM-DD"}]
    `;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    console.log("🤖 Gemini 3 Flash phản hồi:", rawText);

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("AI không trả về JSON chuẩn");
    
    const dataArray = JSON.parse(jsonMatch[0]);
    await Transaction.insertMany(dataArray);
    
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Lỗi AI:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// [API]: Lấy danh sách
app.get('/api/transactions', async (req, res) => {
  const list = await Transaction.find().sort({ date: 1 });
  res.json(list);
});

// [API]: Tính tổng
app.get('/api/stats/total', async (req, res) => {
  const total = await Transaction.aggregate([{ $group: { _id: null, sum: { $sum: "$amount" } } }]);
  res.json({ total: total.length > 0 ? total[0].sum : 0 });
});

// [API]: Xóa từng ID
app.get('/api/transactions/delete/:id', async (req, res) => {
  await Transaction.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// [API]: Xóa toàn bộ
app.get('/api/transactions/all/delete', async (req, res) => {
  await Transaction.deleteMany({});
  res.json({ success: true });
});

app.listen(5000, () => console.log('🚀 Backend Gemini 3 Flash Preview is READY'));