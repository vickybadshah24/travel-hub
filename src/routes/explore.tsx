import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { PostCard } from "@/components/PostCard";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/explore")({
  head: () => ({ meta: [{ title: "Explore — Wanderlog" }] }),
  component: Explore,
});

type Post = Tables<"posts"> & { profiles?: Pick<Tables<"profiles">, "username" | "display_name" | "avatar_url"> | null };

function Explore() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("posts")
      .select("*, profiles(username, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPosts((data as Post[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <header className="mb-10">
          <h1 className="font-display text-5xl font-bold">Explore</h1>
          <p className="mt-2 text-muted-foreground">Every destination shared by the community.</p>
        </header>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
            No journeys yet. Be the first.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        )}
      </main>
    </div>
  );
}
