
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const MAX_FILE_SIZE =
  10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = {
  jpg: {
    mime: "image/jpeg",
    extension: ".jpg",
    resourceType: "image",
  },

  jpeg: {
    mime: "image/jpeg",
    extension: ".jpeg",
    resourceType: "image",
  },

  png: {
    mime: "image/png",
    extension: ".png",
    resourceType: "image",
  },

  webp: {
    mime: "image/webp",
    extension: ".webp",
    resourceType: "image",
  },

  pdf: {
    mime: "application/pdf",
    extension: ".pdf",
    resourceType: "raw",
  },
};

// --------------------------------------------------
// Cloudinary Configuration
// --------------------------------------------------

const isCloudinaryConfigured =
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name:
      process.env.CLOUDINARY_CLOUD_NAME,

    api_key:
      process.env.CLOUDINARY_API_KEY,

    api_secret:
      process.env.CLOUDINARY_API_SECRET,
  });
}

// --------------------------------------------------
// File Signature Detection
// --------------------------------------------------

const detectFileType = (
  buffer
) => {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 4
  ) {
    return null;
  }

  // JPEG
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return {
      extension: ".jpg",
      mime: "image/jpeg",
      resourceType: "image",
    };
  }

  // PNG
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
    return {
      extension: ".png",
      mime: "image/png",
      resourceType: "image",
    };
  }

  // WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString(
      "ascii",
      0,
      4
    ) === "RIFF" &&
    buffer.toString(
      "ascii",
      8,
      12
    ) === "WEBP"
  ) {
    return {
      extension: ".webp",
      mime: "image/webp",
      resourceType: "image",
    };
  }

  // PDF
  if (
    buffer.length >= 5 &&
    buffer.toString(
      "ascii",
      0,
      5
    ) === "%PDF-"
  ) {
    return {
      extension: ".pdf",
      mime: "application/pdf",
      resourceType: "raw",
    };
  }

  return null;
};

// --------------------------------------------------
// Filename Extension
// --------------------------------------------------

const getSafeExtension = (
  originalName
) => {
  if (
    typeof originalName !==
    "string"
  ) {
    return "";
  }

  const extension =
    path
      .extname(originalName)
      .toLowerCase();

  return extension;
};

// --------------------------------------------------
// Upload File
// --------------------------------------------------

const uploadFile = async (
  fileBuffer,
  originalName,
  folder = "borderbound_docs"
) => {
  if (
    !Buffer.isBuffer(fileBuffer) ||
    fileBuffer.length === 0
  ) {
    throw new Error(
      "Invalid or empty file."
    );
  }

  if (
    fileBuffer.length >
    MAX_FILE_SIZE
  ) {
    throw new Error(
      "File size must not exceed 10 MB."
    );
  }

  const detectedType =
    detectFileType(fileBuffer);

  if (!detectedType) {
    throw new Error(
      "Unsupported or invalid file type."
    );
  }

  const originalExtension =
    getSafeExtension(
      originalName
    );

  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
  ];

  if (
    originalExtension &&
    !allowedExtensions.includes(
      originalExtension
    )
  ) {
    throw new Error(
      "Unsupported file extension."
    );
  }

  // If an extension exists, ensure it
  // matches the detected file content.
  if (
    originalExtension &&
    detectedType.extension !==
      originalExtension
  ) {
    const jpegMismatch =
      detectedType.mime ===
        "image/jpeg" &&
      (originalExtension ===
        ".jpg" ||
        originalExtension ===
          ".jpeg");

    if (!jpegMismatch) {
      throw new Error(
        "File extension does not match file content."
      );
    }
  }

  // ------------------------------------------------
  // Cloudinary
  // ------------------------------------------------

  if (isCloudinaryConfigured) {
    return new Promise(
      (resolve, reject) => {
        const uploadStream =
          cloudinary.uploader.upload_stream(
            {
              folder,
              resource_type:
                detectedType.resourceType,

              // Prevent accidental public
              // transformations from using
              // arbitrary incoming metadata.
              use_filename: false,
              unique_filename: true,

              // Keep uploaded asset immutable
              // from filename perspective.
              filename_override:
                uuidv4(),
            },
            (
              error,
              result
            ) => {
              if (error) {
                return reject(
                  error
                );
              }

              if (
                !result ||
                !result.secure_url ||
                !result.public_id
              ) {
                return reject(
                  new Error(
                    "Cloudinary upload failed."
                  )
                );
              }

              return resolve({
                url:
                  result.secure_url,

                publicId:
                  result.public_id,

                provider:
                  "cloudinary",
              });
            }
          );

        uploadStream.on(
          "error",
          (error) => {
            reject(error);
          }
        );

        uploadStream.end(
          fileBuffer
        );
      }
    );
  }

  // ------------------------------------------------
  // Local fallback
  // ------------------------------------------------

  // Never silently use local file storage
  // in production.
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    throw new Error(
      "Cloudinary is not configured."
    );
  }

  const uploadsDir =
    path.join(
      __dirname,
      "../../uploads"
    );

  if (
    !fs.existsSync(
      uploadsDir
    )
  ) {
    fs.mkdirSync(
      uploadsDir,
      {
        recursive: true,
      }
    );
  }

  const filename =
    `${uuidv4()}${detectedType.extension}`;

  const filePath =
    path.join(
      uploadsDir,
      filename
    );

  fs.writeFileSync(
    filePath,
    fileBuffer,
    {
      flag: "wx",
    }
  );

  return {
    url: `/uploads/${filename}`,
    publicId: filename,
    provider: "local",
  };
};

module.exports = {
  uploadFile,
};
