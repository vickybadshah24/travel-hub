import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type AISuggestion = { name: string; country: string; why: string; vibe: string };
type NearbyPost = Pick<Tables<"posts">, "id" | "title" | "image_url" | "location" | "country" | "latitude" | "longitude"> & {
  profiles?: Pick<Tables<"profiles">, "username"> | null;
};

interface RecommendationsProps {
  postId: string;
  title: string;
  location: string;
  country?: string | null;
  caption?: string | null;
  lat?: number | null;
  lng?: number | null;
}

// Haversine distance in km
function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function Recommendations({ postId, title, location, country, caption, lat, lng }: RecommendationsProps) {
  const [ai, setAi] = useState<AISuggestion[] | null>(null);
  const [nearby, setNearby] = useState<NearbyPost[]>([]);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // 1. Community: fetch nearby posts
    const loadNearby = async () => {
      if (lat == null || lng == null) {
        // fallback: same country/location
        const { data } = await supabase
          .from("posts")
          .select("id, title, image_url, location, country, latitude, longitude, profiles(username)")
          .neq("id", postId)
          .or(country ? `country.eq.${country},location.eq.${location}` : `location.eq.${location}`)
          .limit(8);
        if (!cancelled) setNearby((data as any) ?? []);
        return;
      }
      const { data } = await supabase
        .from("posts")
        .select("id, title, image_url, location, country, latitude, longitude, profiles(username)")
        .neq("id", postId)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(200);
      if (!cancelled && data) {
        const ranked = data
          .map((p: any) => ({ ...p, _d: distKm({ lat, lng }, { lat: p.latitude, lng: p.longitude }) }))
          .filter((p: any) => p._d < 500)
          .sort((a: any, b: any) => a._d - b._d)
          .slice(0, 6);
        setNearby(ranked as any);
      }
    };

    // 2. AI suggestions
    const loadAi = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("recommend-destinations", {
          body: { title, location, country, caption },
        });
        if (cancelled) return;
        if (error) {
          setAiError(error.message || "Could not load suggestions");
        } else if (data?.suggestions) {
          setAi(data.suggestions as AISuggestion[]);
        } else if (data?.error) {
          setAiError(data.error);
        }
      } catch (e) {
        if (!cancelled) setAiError(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    };

    loadNearby();
    loadAi();

    return () => {
      cancelled = true;
    };
  }, [postId, title, location, country, caption, lat, lng]);

  return (
    <div className="space-y-6">
      {/* AI suggestions */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg font-bold">If you liked this, try</h3>
        </div>
        {aiLoading ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-secondary/40" />
            ))}
          </div>
        ) : aiError ? (
          <p className="text-sm text-muted-foreground">AI suggestions unavailable: {aiError}</p>
        ) : ai && ai.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {ai.map((s, i) => (
              <li
                key={i}
                className="rounded-xl border border-border/60 bg-card p-3 transition-smooth hover:border-primary/40"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold">{s.name}</p>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {s.vibe}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{s.country}</p>
                <p className="mt-1.5 text-xs text-foreground/80">{s.why}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No suggestions right now.</p>
        )}
      </section>

      {/* Community nearby */}
      {nearby.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Compass className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-bold">Travelers also visited</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {nearby.map((p) => (
              <Link
                key={p.id}
                to="/p/$postId"
                params={{ postId: p.id }}
                className="group relative aspect-square overflow-hidden rounded-xl"
              >
                <img
                  src={p.image_url}
                  alt={p.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-spring group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-overlay opacity-90" />
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="line-clamp-1 text-xs font-semibold text-white">{p.title}</p>
                  <p className="line-clamp-1 text-[10px] text-white/80">
                    {p.location}
                    {p.country ? `, ${p.country}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
