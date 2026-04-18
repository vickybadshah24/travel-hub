import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe, Instagram, Music2, Twitter, Youtube } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { UserAvatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} — Wanderlog` }] }),
  component: UserProfile,
});

function UserProfile() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [posts, setPosts] = useState<Pick<Tables<"posts">, "id" | "image_url" | "title">[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [startingDM, setStartingDM] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          setNotFound(true);
          return;
        }
        setProfile(data);
        supabase
          .from("posts")
          .select("id, image_url, title")
          .eq("user_id", data.id)
          .order("created_at", { ascending: false })
          .then(({ data: p }) => setPosts(p ?? []));
      });
  }, [username]);

  const startDM = async () => {
    if (!user || !profile || user.id === profile.id) return;
    setStartingDM(true);
    // Find existing direct conversation between the two users
    const { data: mine } = await supabase
      .from("conversation_participants")
      .select("conversation_id, conversations!inner(type)")
      .eq("user_id", user.id);
    const myDirect = (mine ?? []).filter((m) => (m as never as { conversations: { type: string } }).conversations.type === "direct");
    let convId: string | null = null;
    if (myDirect.length) {
      const ids = myDirect.map((m) => m.conversation_id);
      const { data: theirs } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", profile.id)
        .in("conversation_id", ids);
      if (theirs && theirs.length) convId = theirs[0].conversation_id;
    }
    if (!convId) {
      const { data: created } = await supabase
        .from("conversations")
        .insert({ type: "direct", created_by: user.id })
        .select()
        .single();
      if (created) {
        convId = created.id;
        await supabase
          .from("conversation_participants")
          .insert([
            { conversation_id: created.id, user_id: user.id },
            { conversation_id: created.id, user_id: profile.id },
          ]);
      }
    }
    setStartingDM(false);
    if (convId) window.location.href = `/messages/${convId}`;
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-background"><Navbar />
        <main className="mx-auto max-w-2xl px-4 py-12 text-center">
          <p className="text-muted-foreground">User not found.</p>
        </main>
      </div>
    );
  }
  if (!profile) {
    return <div className="min-h-screen bg-background"><Navbar /></div>;
  }

  const isMe = user?.id === profile.id;
  const socials = [
    profile.instagram && { icon: Instagram, label: "Instagram", href: `https://instagram.com/${profile.instagram.replace("@", "")}` },
    profile.youtube && { icon: Youtube, label: "YouTube", href: profile.youtube.startsWith("http") ? profile.youtube : `https://youtube.com/${profile.youtube}` },
    profile.tiktok && { icon: Music2, label: "TikTok", href: `https://tiktok.com/@${profile.tiktok.replace("@", "")}` },
    profile.twitter && { icon: Twitter, label: "X", href: `https://x.com/${profile.twitter.replace("@", "")}` },
    profile.website && { icon: Globe, label: "Website", href: profile.website },
  ].filter(Boolean) as { icon: typeof Globe; label: string; href: string }[];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <header className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <UserAvatar src={profile.avatar_url} name={profile.username} size={128} ring />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <h1 className="font-display text-3xl font-bold">@{profile.username}</h1>
              {isMe ? (
                <Link to="/profile">
                  <Button size="sm" variant="outline">Edit profile</Button>
                </Link>
              ) : user ? (
                <Button size="sm" onClick={startDM} disabled={startingDM} className="bg-gradient-sunset border-0">
                  {startingDM ? "..." : "Message"}
                </Button>
              ) : null}
            </div>
            {profile.display_name && <p className="mt-1 text-lg font-semibold">{profile.display_name}</p>}
            {profile.bio && <p className="mt-2 text-sm text-foreground/85">{profile.bio}</p>}
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{posts.length}</span> {posts.length === 1 ? "post" : "posts"}
            </p>
            {socials.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs hover:border-primary/40"
                  >
                    <s.icon className="h-3.5 w-3.5" /> {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </header>

        <div className="mt-10 grid grid-cols-3 gap-1 sm:gap-2">
          {posts.map((p) => (
            <Link
              key={p.id}
              to="/p/$postId"
              params={{ postId: p.id }}
              className="group relative aspect-square overflow-hidden bg-muted sm:rounded-md"
            >
              <img src={p.image_url} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-spring group-hover:scale-110" />
            </Link>
          ))}
          {posts.length === 0 && (
            <div className="col-span-3 rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No posts yet.
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
