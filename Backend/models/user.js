const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  college: { type: String, required: true },
  role: { type: String, default: "student" },
  isBlocked: { type: Boolean, default: false },
  savedNotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "note" }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("user", userSchema);