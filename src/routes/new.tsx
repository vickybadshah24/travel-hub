import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ImagePlus, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapPicker } from "@/components/MapPicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/new")({
  head: () => ({ meta: [{ title: "New post — Wanderlog" }] }),
  component: NewPost,
});

function NewPost() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("");
  const [caption, setCaption] = useState("");
  const [visitedAt, setVisitedAt] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  const handleFile = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !file) {
      toast.error("Please add a photo");
      return;
    }
    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("travel-media").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("travel-media").getPublicUrl(path);

      const { error: insErr } = await supabase.from("posts").insert({
        user_id: user.id,
        title,
        location,
        country: country || null,
        caption: caption || null,
        image_url: publicUrl,
        visited_at: visitedAt || null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      });
      if (insErr) throw insErr;

      toast.success("Destination added!");
      navigate({ to: "/profile" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create post";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-display text-4xl font-bold">Share a destination</h1>
        <p className="mt-2 text-muted-foreground">Add a photo, drop a pin, tell the story.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <label className="block">
            <span className="sr-only">Upload photo</span>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card transition-smooth hover:border-primary/50 cursor-pointer">
              {preview ? (
                <img src={preview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <ImagePlus className="h-10 w-10" />
                  <span className="text-sm">Click to upload a photo</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                required
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </div>
          </label>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sunrise over Bagan" />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Pin the destination
            </Label>
            <MapPicker
              value={coords}
              onChange={(v) => {
                setCoords({ lat: v.lat, lng: v.lng });
                if (v.city && !location) setLocation(v.city);
                if (v.country && !country) setCountry(v.country);
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" required maxLength={120} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bagan" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" maxLength={80} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Myanmar" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visited">Visited</Label>
            <Input id="visited" type="date" value={visitedAt} onChange={(e) => setVisitedAt(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="caption">Story</Label>
            <Textarea id="caption" rows={4} maxLength={2000} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What made this place special?" />
          </div>

          <Button type="submit" disabled={submitting} className="w-full bg-gradient-sunset hover:opacity-90 border-0 shadow-glow h-11">
            {submitting ? "Publishing..." : "Publish destination"}
          </Button>
        </form>
      </main>
    </div>
  );
}
