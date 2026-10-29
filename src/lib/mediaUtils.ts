/**
 * Media utility functions for normalizing data URLs, checking media types,
 * and handling file downloads without triggering generic .bin extensions.
 */

export function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.trim().toLowerCase();
  return (
    clean.startsWith('data:video/') ||
    clean.startsWith('data:application/octet-stream') ||
    clean.startsWith('data:;') ||
    clean.startsWith('blob:') ||
    clean.includes('.mp4') ||
    clean.includes('.webm') ||
    clean.includes('.mov') ||
    clean.includes('.m4v') ||
    clean.includes('.3gp') ||
    clean.includes('.avi') ||
    clean.includes('video/') ||
    clean.includes('data:video')
  );
}

export function formatVideoUrl(url?: string | null): string {
  if (!url) return '';
  let cleanUrl = url.trim();
  if (
    cleanUrl.startsWith('data:application/octet-stream') ||
    cleanUrl.startsWith('data:;') ||
    cleanUrl.startsWith('data:video/quicktime')
  ) {
    cleanUrl = cleanUrl.replace(/^data:[^;]+;/, 'data:video/mp4;');
  } else if (cleanUrl.startsWith('data:') && !cleanUrl.startsWith('data:video/')) {
    cleanUrl = cleanUrl.replace(/^data:[^;]+;/, 'data:video/mp4;');
  } else if (
    !cleanUrl.startsWith('data:') &&
    !cleanUrl.startsWith('http://') &&
    !cleanUrl.startsWith('https://') &&
    !cleanUrl.startsWith('blob:')
  ) {
    cleanUrl = `data:video/mp4;base64,${cleanUrl}`;
  }
  return cleanUrl;
}

export function isImageUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.trim().toLowerCase();
  return (
    clean.startsWith('data:image/') ||
    clean.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i) !== null
  );
}

/**
 * Reads a File object into a DataURL string with optional progress callback.
 */
export function readFileAsDataURL(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    reader.onload = (e) => {
      const res = e.target?.result as string;
      if (res) resolve(res);
      else reject(new Error('Failed to read file contents'));
    };

    reader.onerror = (err) => reject(err);

    reader.readAsDataURL(file);
  });
}
