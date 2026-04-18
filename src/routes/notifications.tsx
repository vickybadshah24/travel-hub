import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Heart, MessageSquare, Users as UsersIcon, Check } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Activity — Wanderlog" },
      { name: "description", content: "Likes, comments, and group messages on your travels." },
    ],
  }),
  component: NotificationsPage,
});

type Actor = { id: string; username: string; display_name: string | null; avatar_url: string | null };
type PostMini = { id: string; title: string; image_url: string };
type ConvMini = { id: string; group_id: string | null; groups: { name: string; slug: string } | null };
type Notif = {
  id: string;
  type: "like" | "comment" | "group_message";
  read: boolean;
  created_at: string;
  actor_id: string;
  post_id: string | null;
  comment_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  actor: Actor | null;
  post: PostMini | null;
  comment: { content: string } | null;
  message: { content: string } | null;
  conversation: ConvMini | null;
};

function NotificationsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select(
          `id, type, read, created_at, actor_id, post_id, comment_id, conversation_id, message_id,
           post:posts(id, title, image_url),
           comment:post_comments(content),
           message:messages(content),
           conversation:conversations(id, group_id, groups(name, slug))`,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const rows = (data as any[]) ?? [];
      const actorIds = Array.from(new Set(rows.map((r) => r.actor_id)));
      let actorMap: Record<string, Actor> = {};
      if (actorIds.length > 0) {
        const { data: actors } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", actorIds);
        actorMap = Object.fromEntries((actors ?? []).map((a) => [a.id, a as Actor]));
      }

      if (!cancelled) {
        setItems(rows.map((r) => ({ ...r, actor: actorMap[r.actor_id] ?? null })));
        setBusy(false);
      }
    };

    load();

    const channel = supabase
      .channel(`notifications-page-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markOneRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  if (loading || !user) return null;

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-sunset shadow-glow">
              <Bell className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Activity</h1>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              <Check className="h-4 w-4" /> Mark all read
            </Button>
          )}
        </div>

        {busy ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-secondary/40" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-12 text-center">
            <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium">No activity yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Likes, comments, and group messages will show up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {items.map((n) => (
              <NotificationRow key={n.id} n={n} onClick={() => !n.read && markOneRead(n.id)} />
            ))}
          </ul>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function NotificationRow({ n, onClick }: { n: Notif; onClick: () => void }) {
  const actorName = n.actor?.display_name || n.actor?.username || "Someone";
  const time = formatDistanceToNow(new Date(n.created_at), { addSuffix: true });

  let icon = <Heart className="h-4 w-4 text-rose-400" />;
  let text: React.ReactNode = "";
  let to: any = "/";
  let params: any = undefined;
  let thumb: React.ReactNode = null;

  if (n.type === "like" && n.post) {
    icon = <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />;
    text = <>liked your post <span className="text-muted-foreground">"{n.post.title}"</span></>;
    to = "/p/$postId";
    params = { postId: n.post.id };
    thumb = <img src={n.post.image_url} alt="" className="h-12 w-12 rounded-md object-cover" />;
  } else if (n.type === "comment" && n.post) {
    icon = <MessageSquare className="h-4 w-4 text-primary" />;
    text = (
      <>
        commented on <span className="text-muted-foreground">"{n.post.title}"</span>
        {n.comment?.content && <span className="block truncate text-xs text-muted-foreground">"{n.comment.content}"</span>}
      </>
    );
    to = "/p/$postId";
    params = { postId: n.post.id };
    thumb = <img src={n.post.image_url} alt="" className="h-12 w-12 rounded-md object-cover" />;
  } else if (n.type === "group_message" && n.conversation?.groups) {
    icon = <UsersIcon className="h-4 w-4 text-primary" />;
    text = (
      <>
        messaged in <span className="font-medium">{n.conversation.groups.name}</span>
        {n.message?.content && <span className="block truncate text-xs text-muted-foreground">"{n.message.content}"</span>}
      </>
    );
    to = "/groups/$slug";
    params = { slug: n.conversation.groups.slug };
  } else {
    text = "did something";
  }

  return (
    <li>
      <Link
        to={to}
        params={params}
        onClick={onClick}
        className={`flex items-center gap-3 rounded-xl border p-3 transition-smooth hover:bg-card/60 ${
          n.read ? "border-transparent" : "border-primary/30 bg-primary/5"
        }`}
      >
        <div className="relative shrink-0">
          <UserAvatar src={n.actor?.avatar_url} name={actorName} size={40} />
          <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-2 ring-background">
            {icon}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            <span className="font-semibold">{actorName}</span>{" "}
            <span className="text-foreground/90">{text}</span>
          </p>
          <p className="text-xs text-muted-foreground">{time}</p>
        </div>
        {thumb}
        {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
      </Link>
    </li>
  );
}
