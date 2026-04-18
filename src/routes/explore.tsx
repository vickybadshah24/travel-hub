import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/explore")({
  head: () => ({ meta: [{ title: "Explore — Wanderlog" }] }),
  component: Explore,
});

type Post = Pick<Tables<"posts">, "id" | "image_url" | "title">;

function Explore() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("posts")
      .select("id, image_url, title")
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }) => {
        setPosts(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-4xl px-1 sm:px-4 py-4 sm:py-8">
        <header className="mb-4 px-3 sm:px-0">
          <h1 className="font-display text-3xl sm:text-5xl font-bold">Explore</h1>
          <p className="mt-1 text-sm text-muted-foreground">Discover destinations from travelers everywhere.</p>
        </header>
        {loading ? (
          <p className="px-4 text-muted-foreground">Loading...</p>
        ) : posts.length === 0 ? (
          <div className="m-3 rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
            No journeys yet.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {posts.map((p) => (
              <Link
                key={p.id}
                to="/p/$postId"
                params={{ postId: p.id }}
                className="group relative aspect-square overflow-hidden bg-muted sm:rounded-md"
              >
                <img
                  src={p.image_url}
                  alt={p.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-spring group-hover:scale-110"
                />
              </Link>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
