import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { TravelMap, type MapPin as Pin } from "@/components/TravelMap";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "World map — Wanderlog" },
      { name: "description", content: "Every traveler's destination, pinned on a world map." },
      { property: "og:title", content: "World map — Wanderlog" },
      { property: "og:description", content: "Every traveler's destination, pinned on a world map." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    supabase
      .from("posts")
      .select("id, title, image_url, latitude, longitude")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        const list = (data ?? []).map((p) => ({
          id: p.id,
          lat: p.latitude as number,
          lng: p.longitude as number,
          title: p.title,
          image_url: p.image_url,
          href: `/p/${p.id}`,
        }));
        setPins(list);
        setCount(list.length);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-sunset shadow-glow">
            <MapPin className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">World map</h1>
            <p className="text-sm text-muted-foreground">
              {count} {count === 1 ? "destination" : "destinations"} pinned by travelers
            </p>
          </div>
        </header>
        <TravelMap pins={pins} height="70vh" />
        {count === 0 && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No pinned destinations yet. Add a post and drop a pin to start the map!
          </p>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
