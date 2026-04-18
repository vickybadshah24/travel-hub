import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Camera, Globe2, Share2, Sparkles } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import heroImage from "@/assets/hero-travel.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

type Post = Tables<"posts"> & { profiles?: Pick<Tables<"profiles">, "username" | "display_name" | "avatar_url"> | null };

function Index() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    supabase
      .from("posts")
      .select("*, profiles(username, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => setPosts((data as Post[]) ?? []));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Traveler on a mountain ridge at sunset"
            width={1920}
            height={1280}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-32 sm:pt-32 sm:pb-48">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Your travel story, in one place
            </div>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl lg:text-8xl">
              Every destination
              <br />
              <span className="text-gradient-sunset">tells a story.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
              Build a stunning portfolio of your travels. Upload photos, tag locations, share your socials — all in one beautiful place.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="bg-gradient-sunset hover:opacity-90 border-0 shadow-glow text-base h-12 px-7">
                  Start your journal <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/explore">
                <Button size="lg" variant="outline" className="text-base h-12 px-7 border-border bg-background/30 backdrop-blur">
                  Explore destinations
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { icon: Camera, title: "Capture moments", desc: "Upload photos from every destination with rich captions and dates." },
            { icon: Globe2, title: "Pin locations", desc: "Tag every spot you've been. Build your map of the world." },
            { icon: Share2, title: "Share everything", desc: "Link your Instagram, YouTube, TikTok and more from one profile." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border/50 bg-card p-6 shadow-card transition-smooth hover:border-primary/40">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-ember">
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="font-display text-xl font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent posts */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-4xl font-bold sm:text-5xl">Latest journeys</h2>
            <p className="mt-2 text-muted-foreground">Fresh destinations from the community.</p>
          </div>
          <Link to="/explore" className="hidden sm:inline-flex">
            <Button variant="ghost" className="gap-1">View all <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="text-muted-foreground">No posts yet. Be the first to share an adventure.</p>
            <Link to="/auth" className="mt-4 inline-block">
              <Button className="bg-gradient-sunset hover:opacity-90 border-0">Get started</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        )}
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-xs text-muted-foreground">
        Made for travelers, by travelers · Wanderlog
      </footer>
    </div>
  );
}
