'use client';

import { useState } from 'react';
import imageCompression from 'browser-image-compression';

export default function PhotoCapture({
  onFileReady,
}: {
  onFileReady: (file: File | null, previewUrl: string | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;

    setCompressing(true);
    try {
      // Phone photos are often 3-5MB — compress before it ever touches Storage.
      const compressed = await imageCompression(raw, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      });
      const url = URL.createObjectURL(compressed);
      setPreview(url);
      onFileReady(compressed, url);
    } finally {
      setCompressing(false);
    }
  }

  return (
    <div>
      <label className="text-sm text-gray-600 block mb-1">Storefront photo</label>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="block w-full text-sm"
      />
      {compressing && <p className="text-xs text-gray-500 mt-1">Compressing image…</p>}
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Store preview" className="mt-2 h-40 rounded border object-cover" />
      )}
    </div>
  );
}
