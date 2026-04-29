const multer = require('multer')
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const cloudinary = require('cloudinary').v2

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'qnc-provider-docs',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    resource_type: 'auto',
    public_id: `${Date.now()}-${file.fieldname}`
  })
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only JPG, PNG and PDF files are allowed'))
    }
  }
})

module.exports = { upload, cloudinary }
