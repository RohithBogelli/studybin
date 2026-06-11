const mongoose = require("mongoose");

const adSchema = new mongoose.Schema({
  placement: { type: String, required: true }, // 'home_banner', 'login_sidebar', 'feed_card'
  title: { type: String, required: true },
  description: { type: String, required: true },
  link: { type: String, default: "" },
  sponsorName: { type: String, default: "Sponsor" },
  posterUrl: { type: String, default: "" },   // Cloudinary image URL for sponsor poster
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Ad", adSchema);
