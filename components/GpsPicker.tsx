'use client';

import { useState } from 'react';

export default function GpsPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'locating' | 'error'>('idle');

  function grabLocation() {
    if (!navigator.geolocation) {
      setStatus('error');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        setStatus('idle');
      },
      () => setStatus('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div>
      <label className="text-sm text-gray-600 block mb-1">GPS location</label>
      <div className="flex gap-2 items-center mb-2">
        <button
          type="button"
          onClick={grabLocation}
          className="text-sm bg-gray-100 hover:bg-gray-200 rounded px-3 py-1.5 border"
        >
          📍 Use current location
        </button>
        {status === 'locating' && <span className="text-xs text-gray-500">Locating…</span>}
        {status === 'error' && (
          <span className="text-xs text-red-600">Couldn't get location — enter manually</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          step="any"
          placeholder="Latitude"
          value={latitude ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value), longitude)}
          className="w-full border rounded px-3 py-2"
        />
        <input
          type="number"
          step="any"
          placeholder="Longitude"
          value={longitude ?? ''}
          onChange={(e) => onChange(latitude, e.target.value === '' ? null : parseFloat(e.target.value))}
          className="w-full border rounded px-3 py-2"
        />
      </div>
    </div>
  );
}
