const express = require("express");
const Note = require("../models/note");
const auth = require("../middleware/auth");
const { upload } = require("../config/cloudinary");

const router = express.Router();

// TEST
router.get("/test", (req, res) => {
  res.json({ message: "Notes routes working" });
});

// ADD NOTE WITH PDF UPLOAD
router.post("/add", auth, upload.single("file"), async (req, res) => {
  try {
    const { title, description, subject, college, uploadedBy } = req.body;

    const note = new Note({
      title,
      description,
      subject,
      college,
      uploadedBy,
      fileUrl: req.file ? req.file.path : null
    });

    await note.save();
    res.status(201).json({ message: "Note added successfully", note });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET NOTES BY COLLEGE
router.get("/college/:college", auth, async (req, res) => {
  try {
    const notes = await Note.find({ college: req.params.college });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ DELETE NOTE (Only Admin allowed)
router.delete("/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Only administrators can delete notes." });
    }
    await Note.findByIdAndDelete(req.params.id);
    res.json({ message: "Note deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;