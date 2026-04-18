import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, MapPin, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";
import type { Tables } from "@/integrations/supabase/types";

type Post = Tables<"posts"> & {
  profiles?: Pick<Tables<"profiles">, "username" | "display_name" | "avatar_url"> | null;
};

export function FeedPost({ post }: { post: Post }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [comments, setComments] = useState<
    Array<Tables<"post_comments"> & { profiles?: { username: string } | null }>
  >([]);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([
      supabase.from("post_likes").select("user_id", { count: "exact" }).eq("post_id", post.id),
      supabase.from("post_comments").select("id", { count: "exact", head: true }).eq("post_id", post.id),
    ]).then(([likesRes, commentsRes]) => {
      if (!mounted) return;
      setLikeCount(likesRes.count ?? 0);
      setCommentCount(commentsRes.count ?? 0);
      if (user && likesRes.data?.some((l) => l.user_id === user.id)) setLiked(true);
    });
    return () => {
      mounted = false;
    };
  }, [post.id, user]);

  const loadComments = async () => {
    setShowComments((s) => !s);
    if (!showComments) {
      const { data } = await supabase
        .from("post_comments")
        .select("*, profiles(username)")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });
      setComments((data as never) ?? []);
    }
  };

  const toggleLike = async () => {
    if (!user) {
      toast.error("Sign in to like");
      return;
    }
    if (liked) {
      setLiked(false);
      setLikeCount((c) => c - 1);
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
    }
  };

  const sendComment = async () => {
    if (!user || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    const { data, error } = await supabase
      .from("post_comments")
      .insert({ post_id: post.id, user_id: user.id, content: text })
      .select("*, profiles(username)")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setComments((c) => [...c, data as never]);
    setCommentCount((c) => c + 1);
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <UserAvatar src={post.profiles?.avatar_url} name={post.profiles?.username} size={36} ring />
        <div className="min-w-0 flex-1">
          <Link
            to="/u/$username"
            params={{ username: post.profiles?.username ?? "" }}
            className="block truncate font-semibold hover:underline"
          >
            {post.profiles?.display_name || post.profiles?.username}
          </Link>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">
              {post.location}
              {post.country ? `, ${post.country}` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        <img src={post.image_url} alt={post.title} className="h-full w-full object-cover" loading="lazy" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 pt-3">
        <button onClick={toggleLike} className="transition-spring hover:scale-110" aria-label="Like">
          <Heart className={`h-6 w-6 ${liked ? "fill-accent text-accent" : ""}`} />
        </button>
        <button onClick={loadComments} className="transition-spring hover:scale-110" aria-label="Comments">
          <MessageCircle className="h-6 w-6" />
        </button>
      </div>

      {/* Counts + caption */}
      <div className="px-4 py-2">
        <p className="text-sm font-semibold">{likeCount.toLocaleString()} {likeCount === 1 ? "like" : "likes"}</p>
        <p className="mt-1 text-sm">
          <Link
            to="/u/$username"
            params={{ username: post.profiles?.username ?? "" }}
            className="font-semibold hover:underline"
          >
            {post.profiles?.username}
          </Link>{" "}
          <span className="font-display text-base">{post.title}</span>
        </p>
        {post.caption && <p className="mt-1 text-sm text-foreground/85">{post.caption}</p>}
        {commentCount > 0 && !showComments && (
          <button onClick={loadComments} className="mt-2 text-sm text-muted-foreground hover:underline">
            View {commentCount} {commentCount === 1 ? "comment" : "comments"}
          </button>
        )}
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-border/50 px-4 py-3 space-y-2">
          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground">No comments yet. Be the first.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-semibold">@{c.profiles?.username ?? "user"}</span>{" "}
              <span className="text-foreground/85">{c.content}</span>
            </div>
          ))}
          {user && (
            <div className="flex items-center gap-2 pt-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendComment()}
                placeholder="Add a comment..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={sendComment}
                disabled={!draft.trim()}
                className="text-primary disabled:text-muted-foreground"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
