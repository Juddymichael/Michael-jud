/**
 * Utilities for client-side image processing and compression.
 * Converts uploaded screenshots to lightweight base64 Data URLs for IndexedDB storage.
 */

export async function processScreenshotFile(file: File): Promise<{
  dataUrl: string;
  name: string;
  sizeKb: number;
}> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Le fichier sélectionné doit être une image (PNG, JPG, WebP, etc.).'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Échec de la lecture du fichier image.'));
    reader.onload = () => {
      const result = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Impossible de charger l\'image.'));
      img.onload = () => {
        // Max dimensions to avoid bloating IndexedDB
        const maxW = 1920;
        const maxH = 1080;
        let width = img.width;
        let height = img.height;

        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to raw dataUrl if canvas context unavailable
          const sizeKb = Math.round(result.length / 1024);
          return resolve({ dataUrl: result, name: file.name, sizeKb });
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Use image/jpeg 0.85 for photos, or png if original is png and small
        const isPng = file.type === 'image/png';
        const mime = isPng && file.size < 500 * 1024 ? 'image/png' : 'image/jpeg';
        const compressedUrl = canvas.toDataURL(mime, 0.85);
        const sizeKb = Math.round((compressedUrl.length * 3) / 4 / 1024);

        resolve({
          dataUrl: compressedUrl,
          name: file.name,
          sizeKb,
        });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Validates whether a given string resembles a valid URL (TradingView or chart link)
 */
export function isValidChartUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length < 5) return false;

  try {
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalizes a TradingView or web URL to have https:// prefix
 */
export function normalizeChartUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
