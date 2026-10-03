require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

/* ---------- Models ---------- */
const noteSchema = new mongoose.Schema(
  { text: { type: String, required: true, trim: true }, followUpDate: Date },
  { timestamps: true }
);
const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    message: { type: String, trim: true },
    source: { type: String, default: "Website form", trim: true },
    status: { type: String, enum: ["new", "contacted", "converted"], default: "new" },
    notes: [noteSchema],
  },
  { timestamps: true }
);
const Lead = mongoose.model("Lead", leadSchema);
const Admin = mongoose.model(
  "Admin",
  new mongoose.Schema({ email: { type: String, unique: true }, passwordHash: String })
);

/* ---------- Auth ---------- */
const auth = (req, res, next) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Please log in again." });
  }
};

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email: (email || "").toLowerCase() });
  if (!admin || !(await bcrypt.compare(password || "", admin.passwordHash)))
    return res.status(401).json({ error: "Wrong email or password." });
  const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: "8h" });
  res.json({ token });
});

/* ---------- Public: contact form submits here ---------- */
app.post("/api/leads", async (req, res) => {
  const { name, email, phone, message, source } = req.body;
  if (!name || !email) return res.status(400).json({ error: "Name and email are required." });
  const lead = await Lead.create({ name, email, phone, message, source: source || "Website form" });
  res.status(201).json({ id: lead._id });
});

/* ---------- Admin only ---------- */
app.get("/api/leads", auth, async (req, res) => {
  const { status, q } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { email: rx }, { source: rx }];
  }
  res.json(await Lead.find(filter).sort({ createdAt: -1 }));
});

app.get("/api/stats", auth, async (_req, res) => {
  const [total, newCount, contacted, converted] = await Promise.all([
    Lead.countDocuments(),
    Lead.countDocuments({ status: "new" }),
    Lead.countDocuments({ status: "contacted" }),
    Lead.countDocuments({ status: "converted" }),
  ]);
  res.json({ total, new: newCount, contacted, converted,
    conversionRate: total ? Math.round((converted / total) * 100) : 0 });
});

app.patch("/api/leads/:id", auth, async (req, res) => {
  const { status } = req.body;
  if (!["new", "contacted", "converted"].includes(status))
    return res.status(400).json({ error: "Invalid status." });
  const lead = await Lead.findByIdAndUpdate(req.params.id, { status }, { new: true });
  lead ? res.json(lead) : res.status(404).json({ error: "Lead not found." });
});

app.post("/api/leads/:id/notes", auth, async (req, res) => {
  const { text, followUpDate } = req.body;
  if (!text) return res.status(400).json({ error: "Note text is required." });
  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found." });
  lead.notes.push({ text, followUpDate: followUpDate || undefined });
  await lead.save();
  res.status(201).json(lead);
});

app.delete("/api/leads/:id", auth, async (req, res) => {
  await Lead.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

/* ---------- Start ---------- */
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const email = (process.env.ADMIN_EMAIL || "").toLowerCase();
  if (email && !(await Admin.findOne({ email }))) {
    await Admin.create({ email, passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10) });
    console.log("Admin account created for", email);
  }
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log("API running on port " + port));
})();
