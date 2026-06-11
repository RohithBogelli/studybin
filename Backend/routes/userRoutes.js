const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const College = require("../models/college");
const LoginLog = require("../models/loginLog");
const Note = require("../models/note");
const auth = require("../middleware/auth");

router.get("/test", (req, res) => {
  res.json({ message: "User routes working" });
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, college, collegePincode, role } = req.body;

    if (!name || !email || !password || !college || !collegePincode) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check college pincode
    let collegeDoc = await College.findOne({ name: { $regex: new RegExp("^" + college.trim() + "$", "i") } });

    if (collegeDoc) {
      if (collegeDoc.pincode !== collegePincode) {
        return res.status(400).json({ message: "Incorrect security pin code / password for " + collegeDoc.name });
      }
    } else {
      // Create new college with this pincode
      collegeDoc = new College({
        name: college.trim(),
        pincode: collegePincode
      });
      await collegeDoc.save();
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Secure admin role: only grant if correct secret owner code is provided
    let finalRole = "student";
    if (role === "admin") {
      const adminCode = req.body.adminSecretCode || "";
      const correctCode = process.env.ADMIN_SECRET_CODE || "";
      if (adminCode && correctCode && adminCode === correctCode) {
        finalRole = "admin";
      } else {
        // Wrong/missing code — silently register as student, no error exposed
        finalRole = "student";
      }
    }

    const user = new User({ 
      name, 
      email, 
      password: hashedPassword, 
      college: collegeDoc.name, 
      role: finalRole 
    });
    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account is blocked. Please contact the administrator." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user._id, college: user.college, role: user.role },
      process.env.JWT_SECRET || "cloudmama_secret_key",
      { expiresIn: "7d" }
    );

    // Save login log for traffic analytics
    try {
      const log = new LoginLog({
        userId: user._id,
        email: user.email,
        college: user.college
      });
      await log.save();
    } catch (logErr) {
      console.error("Failed to save login log:", logErr);
    }

    res.status(200).json({
      message: "Login successful",
      token,
      user: { name: user.name, email: user.email, college: user.college, role: user.role }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Toggle Save/Pin Note
router.post("/save-note/:id", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const noteId = req.params.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Ensure savedNotes exists
    if (!user.savedNotes) user.savedNotes = [];

    const isSaved = user.savedNotes.includes(noteId);
    if (isSaved) {
      // Unsave
      user.savedNotes = user.savedNotes.filter(id => id.toString() !== noteId);
    } else {
      // Save
      user.savedNotes.push(noteId);
    }

    await user.save();
    res.status(200).json({ savedNotes: user.savedNotes, isSaved: !isSaved });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get User's Saved Notes
router.get("/saved-notes", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).populate("savedNotes");
    
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.savedNotes || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;