
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const STORAGE_ROOT =
  process.env.STORAGE_ROOT ||
  path.join(__dirname, "../../uploads");

const BACKEND_URL = (
  process.env.BACKEND_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".pdf",
];

const detectFileType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return null;
  }

  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { extension: ".jpg", mime: "image/jpeg" };
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { extension: ".png", mime: "image/png" };
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { extension: ".webp", mime: "image/webp" };
  }

  if (buffer.toString("ascii", 0, 5) === "%PDF-") {
    return { extension: ".pdf", mime: "application/pdf" };
  }

  return null;
};

const uploadFile = async (
  fileBuffer,
  originalName,
  folder = "borderbound_docs"
) => {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new Error("Invalid or empty file.");
  }

  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error("File size must not exceed 10 MB.");
  }

  const detectedType = detectFileType(fileBuffer);

  if (!detectedType) {
    throw new Error("Unsupported or invalid file type.");
  }

  const originalExtension =
    typeof originalName === "string"
      ? path.extname(originalName).toLowerCase()
      : "";

  if (
    originalExtension &&
    !ALLOWED_EXTENSIONS.includes(originalExtension)
  ) {
    throw new Error("Unsupported file extension.");
  }

  if (
    originalExtension &&
    detectedType.extension !== originalExtension &&
    !(
      detectedType.mime === "image/jpeg" &&
      [".jpg", ".jpeg"].includes(originalExtension)
    )
  ) {
    throw new Error("File extension does not match file content.");
  }

  const allowedFolders = {
    borderbound_docs: "contestant-docs",
    contestant_photos: "contestant-photos",
  };

  const storageFolder = allowedFolders[folder];

  if (!storageFolder) {
    throw new Error("Invalid upload folder.");
  }

  const filename = `${uuidv4()}${detectedType.extension}`;

  const uploadDir = path.join(STORAGE_ROOT, storageFolder);

  await fs.promises.mkdir(uploadDir, {
    recursive: true,
  });

  const filePath = path.join(uploadDir, filename);

  await fs.promises.writeFile(filePath, fileBuffer, {
    flag: "wx",
  });

  const isPhoto = folder === "contestant_photos";

  const url = isPhoto
    ? `${BACKEND_URL}/uploads/contestant-photos/${filename}`
    : `${BACKEND_URL}/private-documents/${filename}`;

  return {
    url,
    publicId: filename,
    provider: "local",
  };
};

module.exports = {
  uploadFile,
};
