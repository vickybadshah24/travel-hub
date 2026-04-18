import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Globe, Instagram, Music2, Twitter, Youtube, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Your profile — Wanderlog" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [posts, setPosts] = useState<Tables<"posts">[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data));
    supabase.from("posts").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setPosts(data ?? []));
  }, [user]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: profile.display_name,
      username: profile.username,
      bio: profile.bio,
      instagram: profile.instagram,
      youtube: profile.youtube,
      tiktok: profile.tiktok,
      twitter: profile.twitter,
      website: profile.website,
    }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this destination?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      setPosts(posts.filter((p) => p.id !== id));
      toast.success("Deleted");
    }
  };

  if (authLoading || !user || !profile) return (
    <div className="min-h-screen bg-background"><Navbar /></div>
  );

  const update = <K extends keyof Tables<"profiles">>(k: K, v: Tables<"profiles">[K]) =>
    setProfile({ ...profile, [k]: v });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-12 space-y-12">
        {/* Profile header */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-dusk border border-border/50 p-8 sm:p-12">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-gradient-sunset opacity-20 blur-3xl" />
          <div className="relative">
            <p className="text-sm text-primary font-medium">Your portfolio</p>
            <h1 className="mt-2 font-display text-4xl sm:text-5xl font-bold">
              {profile.display_name || profile.username}
            </h1>
            <p className="mt-2 text-muted-foreground">@{profile.username}</p>
            {profile.bio && <p className="mt-4 max-w-2xl text-foreground/90">{profile.bio}</p>}
          </div>
        </section>

        {/* Edit profile */}
        <section className="rounded-2xl border border-border/50 bg-card p-6 sm:p-8 shadow-card">
          <h2 className="font-display text-2xl font-bold mb-6">Edit profile</h2>
          <form onSubmit={handleSave} className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dn">Display name</Label>
              <Input id="dn" value={profile.display_name ?? ""} onChange={(e) => update("display_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="un">Username</Label>
              <Input id="un" value={profile.username} onChange={(e) => update("username", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" rows={3} value={profile.bio ?? ""} onChange={(e) => update("bio", e.target.value)} placeholder="Photographer chasing golden hour across continents." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ig"><Instagram className="inline h-3.5 w-3.5" /> Instagram</Label>
              <Input id="ig" value={profile.instagram ?? ""} onChange={(e) => update("instagram", e.target.value)} placeholder="@username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yt"><Youtube className="inline h-3.5 w-3.5" /> YouTube</Label>
              <Input id="yt" value={profile.youtube ?? ""} onChange={(e) => update("youtube", e.target.value)} placeholder="Channel URL" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tt"><Music2 className="inline h-3.5 w-3.5" /> TikTok</Label>
              <Input id="tt" value={profile.tiktok ?? ""} onChange={(e) => update("tiktok", e.target.value)} placeholder="@username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tw"><Twitter className="inline h-3.5 w-3.5" /> Twitter / X</Label>
              <Input id="tw" value={profile.twitter ?? ""} onChange={(e) => update("twitter", e.target.value)} placeholder="@username" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ws"><Globe className="inline h-3.5 w-3.5" /> Website</Label>
              <Input id="ws" type="url" value={profile.website ?? ""} onChange={(e) => update("website", e.target.value)} placeholder="https://..." />
            </div>

            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving} className="bg-gradient-sunset hover:opacity-90 border-0 shadow-glow">
                <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save profile"}
              </Button>
            </div>
          </form>
        </section>

        {/* Posts */}
        <section>
          <h2 className="font-display text-3xl font-bold mb-6">Your destinations</h2>
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
              No destinations yet. Add your first one.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <div key={p.id} className="relative">
                  <PostCard post={p} />
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-destructive backdrop-blur transition-smooth hover:bg-destructive hover:text-destructive-foreground"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
