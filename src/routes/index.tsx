import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { StoriesBar } from "@/components/StoriesBar";
import { FeedPost } from "@/components/FeedPost";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/")({
  component: Index,
});

type Post = Tables<"posts"> & { profiles?: Pick<Tables<"profiles">, "username" | "display_name" | "avatar_url"> | null };

function Index() {
  const { user, loading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    supabase
      .from("posts")
      .select("*, profiles(username, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setPosts((data as unknown as Post[]) ?? []));
  }, []);

  if (!loading && !user) {
    return <Landing />;
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <StoriesBar />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
            No journeys yet. Share the first.
            <div className="mt-4">
              <Link to="/new">
                <Button className="bg-gradient-sunset hover:opacity-90 border-0">Post a destination</Button>
              </Link>
            </div>
          </div>
        ) : (
          posts.map((p) => <FeedPost key={p.id} post={p} />)
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-dusk" />
        <div className="absolute -top-32 -right-20 h-96 w-96 rounded-full bg-gradient-sunset opacity-30 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-gradient-ember opacity-20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 pt-24 pb-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur">
            One feed. Every adventure.
          </div>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] sm:text-7xl lg:text-8xl">
            Wander.
            <br />
            <span className="text-gradient-sunset">Share. Connect.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Post destinations, join travel groups, message fellow explorers, and follow journeys around the world.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-sunset hover:opacity-90 border-0 shadow-glow text-base h-12 px-7">
                Join Wanderlog
              </Button>
            </Link>
            <Link to="/explore">
              <Button size="lg" variant="outline" className="text-base h-12 px-7 bg-background/30 backdrop-blur">
                Explore feed
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
