const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage for study note files (PDF, PPT, DOC)
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "cloudmama-notes",
    allowed_formats: ["pdf", "ppt", "pptx", "doc", "docx"],
    resource_type: "raw"
  }
});

// Storage for sponsor ad poster images (JPG, PNG, WebP, GIF)
const adPosterStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "studybin-ads",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif", "JPG", "JPEG", "PNG", "WEBP", "GIF"],
    resource_type: "image",
    transformation: [{ width: 800, crop: "limit", quality: "auto" }]
  }
});

const upload = multer({ storage });
const uploadAdPoster = multer({ storage: adPosterStorage });

module.exports = { cloudinary, upload, uploadAdPoster };