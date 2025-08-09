export async function resizeImageToMax1024(file: File): Promise<{
  dataUrl: string;
  mime: string;
}> {
  const img = await createImageBitmap(file);
  const maxSide = 1024;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await canvas.convertToBlob({ type: mime, quality: 0.92 });
  const dataUrl = await blobToDataUrl(blob);
  return { dataUrl, mime };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}