import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const pinIcon = L.divIcon({
  className: "wl-pin",
  html: `<div style="width:24px;height:32px;">
    <svg viewBox="0 0 24 32" width="24" height="32" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 8 12 20 12 20s12-12 12-20C24 5.4 18.6 0 12 0z" fill="#FF8A4C" stroke="white" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="white"/>
    </svg>
  </div>`,
  iconSize: [24, 32],
  iconAnchor: [12, 32],
});

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ lat, lng, zoom }: { lat: number | null; lng: number | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lng !== null) map.setView([lat, lng], zoom ?? map.getZoom());
  }, [lat, lng, zoom, map]);
  return null;
}

export type GeocodeResult = {
  lat: number;
  lng: number;
  display_name: string;
  city?: string;
  country?: string;
};

export async function geocode(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    address?: { city?: string; town?: string; village?: string; country?: string };
  }>;
  return data.map((d) => ({
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    display_name: d.display_name,
    city: d.address?.city || d.address?.town || d.address?.village,
    country: d.address?.country,
  }));
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!res.ok) return null;
  const d = (await res.json()) as {
    display_name: string;
    address?: { city?: string; town?: string; village?: string; country?: string };
  };
  return {
    lat,
    lng,
    display_name: d.display_name,
    city: d.address?.city || d.address?.town || d.address?.village,
    country: d.address?.country,
  };
}

interface MapPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (v: { lat: number; lng: number; city?: string; country?: string; display_name?: string }) => void;
  height?: number;
}

export function MapPicker({ value, onChange, height = 280 }: MapPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const search = async () => {
    setSearching(true);
    const r = await geocode(query);
    setResults(r);
    setSearching(false);
  };

  const handlePick = async (lat: number, lng: number) => {
    onChange({ lat, lng });
    const r = await reverseGeocode(lat, lng);
    if (r) onChange({ lat, lng, city: r.city, country: r.country, display_name: r.display_name });
  };

  if (!mounted) {
    return <div className="rounded-2xl bg-secondary" style={{ height }} />;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
          placeholder="Search a city, region, or place..."
          className="flex-1"
        />
        <Button type="button" onClick={search} disabled={!query.trim() || searching} variant="outline">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {results.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-lg border border-border/60 bg-card text-sm">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onChange({ lat: r.lat, lng: r.lng, city: r.city, country: r.country, display_name: r.display_name });
                  setResults([]);
                  setQuery(r.display_name);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-secondary/60"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="line-clamp-2">{r.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-hidden rounded-2xl border border-border/60" style={{ height }}>
        <MapContainer
          center={value ? [value.lat, value.lng] : [20, 0]}
          zoom={value ? 8 : 2}
          scrollWheelZoom
          style={{ height: "100%", width: "100%", background: "#0e1726" }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <ClickHandler onPick={handlePick} />
          <Recenter lat={value?.lat ?? null} lng={value?.lng ?? null} zoom={8} />
          {value && <Marker position={[value.lat, value.lng]} icon={pinIcon} />}
        </MapContainer>
      </div>
      <p className="text-xs text-muted-foreground">Tap the map to drop a pin, or search above.</p>
    </div>
  );
}
