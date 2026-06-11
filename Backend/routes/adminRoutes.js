const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/user");
const Note = require("../models/note");
const College = require("../models/college");
const Ad = require("../models/ad");
const LoginLog = require("../models/loginLog");
const { uploadAdPoster } = require("../config/cloudinary");

// ==========================================
// PUBLIC ENDPOINTS (No Auth Required)
// ==========================================
router.get("/public/ads", async (req, res) => {
  try {
    const ads = await Ad.find({ isActive: true });
    res.json(ads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// SECURED ADMIN ENDPOINTS (Auth & Admin role)
// ==========================================
const verifyAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Access denied. Admin role required." });
  }
};

router.use(auth);
router.use(verifyAdmin);

// 1. GET STATS WITH ANALYTICS FOR GRAPHS
router.get("/stats", async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: "student" });
    const totalNotes = await Note.countDocuments({});
    const totalColleges = await College.countDocuments({});
    const totalFlagged = await Note.countDocuments({ isFlagged: true });
    
    // Group logins by day for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const trafficStats = await LoginLog.aggregate([
      { $match: { timestamp: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Group notes by subject for charts
    const subjectStats = await Note.aggregate([
      { $group: { _id: "$subject", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 }
    ]);

    // Group students by college
    const collegeStats = await User.aggregate([
      { $match: { role: "student" } },
      { $group: { _id: "$college", studentsCount: { $sum: 1 } } }
    ]);

    res.json({
      totalStudents,
      totalNotes,
      totalColleges,
      totalFlagged,
      trafficStats,
      subjectStats,
      collegeStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. GET ALL USERS
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, "-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. BLOCK USER
router.post("/users/:id/block", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: true }, { new: true });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User blocked successfully", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. UNBLOCK USER
router.post("/users/:id/unblock", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: false }, { new: true });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User unblocked successfully", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. GET ALL NOTES
router.get("/notes", async (req, res) => {
  try {
    const notes = await Note.find({}).sort({ createdAt: -1 });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. DELETE NOTE
router.delete("/notes/:id", async (req, res) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    res.json({ message: "Note removed by administrator" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. GET ALL COLLEGES
router.get("/colleges", async (req, res) => {
  try {
    const colleges = await College.find({}).sort({ name: 1 });
    res.json(colleges);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// AD PLACEMENT MANAGEMENT ENDPOINTS
// ==========================================

// GET ALL ADS
router.get("/ads", async (req, res) => {
  try {
    const ads = await Ad.find({}).sort({ createdAt: -1 });
    res.json(ads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE / UPDATE AD (supports optional poster image upload)
router.post("/ads", uploadAdPoster.single("posterImage"), async (req, res) => {
  try {
    const { id, placement, title, description, link, sponsorName } = req.body;
    const posterUrl = req.file ? req.file.path : undefined;

    if (id) {
      // Update existing
      const updateData = { placement, title, description, link, sponsorName };
      if (posterUrl) updateData.posterUrl = posterUrl;
      const ad = await Ad.findByIdAndUpdate(id, updateData, { new: true });
      return res.json({ message: "Ad updated successfully", ad });
    } else {
      // Create new
      const ad = new Ad({
        placement, title, description, link, sponsorName,
        posterUrl: posterUrl || ""
      });
      await ad.save();
      return res.status(201).json({ message: "Ad campaign created", ad });
    }
  } catch (error) {
    console.error("Ad creation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// TOGGLE AD ACTIVE STATUS
router.post("/ads/:id/toggle", async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ message: "Ad campaign not found" });
    }
    ad.isActive = !ad.isActive;
    await ad.save();
    res.json({ message: "Ad status toggled", ad });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE AD
router.delete("/ads/:id", async (req, res) => {
  try {
    const ad = await Ad.findByIdAndDelete(req.params.id);
    if (!ad) {
      return res.status(404).json({ message: "Ad campaign not found" });
    }
    res.json({ message: "Ad campaign removed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
