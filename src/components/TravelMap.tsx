import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker paths (Leaflet expects assets that vite doesn't bundle automatically)
const defaultIcon = L.divIcon({
  className: "wl-pin",
  html: `<div style="position:relative;width:28px;height:36px;">
    <svg viewBox="0 0 28 36" width="28" height="36" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pin-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#FF8A4C"/>
          <stop offset="100%" stop-color="#E5484D"/>
        </linearGradient>
      </defs>
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 22 14 22s14-12.5 14-22C28 6.27 21.73 0 14 0z" fill="url(#pin-grad)" stroke="white" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="white"/>
    </svg>
  </div>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -32],
});

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  image_url?: string | null;
  href?: string;
};

function FitBounds({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 6);
      return;
    }
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
  }, [pins, map]);
  return null;
}

export function TravelMap({
  pins,
  height = 320,
  className = "",
}: {
  pins: MapPin[];
  height?: number | string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div
        className={`w-full overflow-hidden rounded-2xl border border-border/60 bg-secondary ${className}`}
        style={{ height }}
      />
    );
  }

  const center: [number, number] = pins.length > 0 ? [pins[0].lat, pins[0].lng] : [20, 0];

  return (
    <div
      className={`w-full overflow-hidden rounded-2xl border border-border/60 ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={pins.length > 0 ? 4 : 2}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", background: "#0e1726" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds pins={pins} />
        {pins.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={defaultIcon}>
            <Popup>
              <div style={{ minWidth: 180 }}>
                {p.image_url && (
                  <img
                    src={p.image_url}
                    alt={p.title}
                    style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 8, marginBottom: 6 }}
                  />
                )}
                <div style={{ fontWeight: 600, fontSize: 14, color: "#111" }}>{p.title}</div>
                {p.href && (
                  <a
                    href={p.href}
                    style={{ display: "inline-block", marginTop: 6, fontSize: 12, color: "#E5484D", fontWeight: 600 }}
                  >
                    View post →
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
