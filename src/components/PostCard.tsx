import { MapPin, Calendar } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Post = Tables<"posts"> & { profiles?: Pick<Tables<"profiles">, "username" | "display_name" | "avatar_url"> | null };

export function PostCard({ post }: { post: Post }) {
  const date = post.visited_at ? new Date(post.visited_at).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : null;

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-card shadow-card transition-spring hover:shadow-elegant hover:-translate-y-1">
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={post.image_url}
          alt={post.title}
          loading="lazy"
          className="h-full w-full object-cover transition-spring group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-overlay" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-2">
            <MapPin className="h-3.5 w-3.5" />
            <span>{post.location}{post.country ? `, ${post.country}` : ""}</span>
          </div>
          <h3 className="font-display text-2xl font-bold leading-tight text-foreground">
            {post.title}
          </h3>
          {date && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" /> {date}
            </div>
          )}
        </div>
      </div>
      {post.caption && (
        <div className="p-5 pt-4">
          <p className="text-sm text-muted-foreground line-clamp-3">{post.caption}</p>
          {post.profiles && (
            <p className="mt-3 text-xs text-muted-foreground/70">
              by <span className="text-foreground font-medium">@{post.profiles.username}</span>
            </p>
          )}
        </div>
      )}
    </article>
  );
}
