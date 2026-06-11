const mongoose = require("mongoose");

const collegeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  pincode: { type: String, required: true }, // The security pin code / password set for the college
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("College", collegeSchema);
