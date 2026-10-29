/**
 * Helper to compress images on the client side before uploading to the server.
 * This ensures files are lightweight, fast to upload, and fit safely inside Cloud Firestore (under 1MB limit).
 */
export function compressImageIfNeeded(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    // Only compress images. Non-image files (PDFs, videos, BINs) go through instantly
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const res = e.target?.result as string;
        if (res && res.includes(',')) {
          resolve(res.split(',')[1]);
        } else {
          resolve(res || '');
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const resultStr = event.target?.result as string;
      if (!resultStr) {
        resolve('');
        return;
      }

      // If image is already lightweight (e.g., under 150KB), don't degrade it further
      if (file.size <= 150 * 1024) {
        if (resultStr.includes(',')) {
          resolve(resultStr.split(',')[1]);
        } else {
          resolve(resultStr);
        }
        return;
      }

      const img = new Image();
      img.src = resultStr;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (resultStr.includes(',')) {
            resolve(resultStr.split(',')[1]);
          } else {
            resolve(resultStr);
          }
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Export to standard JPEG compressed by quality
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.includes(',')) {
          resolve(dataUrl.split(',')[1]);
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => {
        if (resultStr.includes(',')) {
          resolve(resultStr.split(',')[1]);
        } else {
          resolve(resultStr);
        }
      };
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}
