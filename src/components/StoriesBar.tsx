import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";
import type { Tables } from "@/integrations/supabase/types";

type RecentTraveler = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  image_url: string;
};

export function StoriesBar() {
  const { user } = useAuth();
  const [travelers, setTravelers] = useState<RecentTraveler[]>([]);

  useEffect(() => {
    supabase
      .from("posts")
      .select("user_id, image_url, profiles!inner(username, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!data) return;
        const seen = new Set<string>();
        const list: RecentTraveler[] = [];
        for (const row of data as unknown as Array<
          { user_id: string; image_url: string; profiles: Pick<Tables<"profiles">, "username" | "display_name" | "avatar_url"> }
        >) {
          if (seen.has(row.user_id)) continue;
          seen.add(row.user_id);
          list.push({
            user_id: row.user_id,
            username: row.profiles.username,
            display_name: row.profiles.display_name,
            avatar_url: row.profiles.avatar_url ?? row.image_url,
            image_url: row.image_url,
          });
          if (list.length >= 12) break;
        }
        setTravelers(list);
      });
  }, []);

  return (
    <div className="border-b border-border/40">
      <div className="mx-auto max-w-2xl overflow-x-auto px-4 py-4 scrollbar-none">
        <div className="flex items-start gap-4">
          {user && (
            <Link to="/new" className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="relative">
                <UserAvatar size={64} name="You" src={null} />
                <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary border-2 border-background">
                  <Plus className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                </div>
              </div>
              <span className="max-w-[64px] truncate text-xs text-muted-foreground">Your post</span>
            </Link>
          )}
          {travelers.map((t) => (
            <Link
              key={t.user_id}
              to="/u/$username"
              params={{ username: t.username }}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <UserAvatar size={64} name={t.username} src={t.avatar_url} ring />
              <span className="max-w-[64px] truncate text-xs">@{t.username}</span>
            </Link>
          ))}
          {travelers.length === 0 && !user && (
            <p className="text-sm text-muted-foreground">No travelers yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
