import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Globe2, Lock, Users, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { UserAvatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/groups/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Wanderlog` }] }),
  component: GroupDetail,
});

type Member = Tables<"group_members"> & { profiles?: Pick<Tables<"profiles">, "username" | "display_name" | "avatar_url"> | null };
type Message = Tables<"messages"> & { profiles?: Pick<Tables<"profiles">, "username" | "avatar_url"> | null };

function GroupDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<Tables<"groups"> | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [conv, setConv] = useState<Tables<"conversations"> | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [tab, setTab] = useState<"chat" | "members">("chat");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("groups").select("*").eq("slug", slug).maybeSingle().then(async ({ data: g }) => {
      if (!g) return;
      setGroup(g);
      const { data: ms } = await supabase
        .from("group_members")
        .select("*, profiles(username, display_name, avatar_url)")
        .eq("group_id", g.id);
      setMembers((ms as never) ?? []);
      if (user) setIsMember(((ms as Member[]) ?? []).some((m) => m.user_id === user.id));
      const { data: c } = await supabase.from("conversations").select("*").eq("group_id", g.id).maybeSingle();
      if (c) setConv(c);
    });
  }, [slug, user]);

  useEffect(() => {
    if (!conv) return;
    let active = true;
    supabase
      .from("messages")
      .select("*, profiles(username, avatar_url)")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (active) setMessages((data as never) ?? []);
      });

    const channel = supabase
      .channel(`messages:${conv.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conv.id}` },
        async (payload) => {
          const m = payload.new as Tables<"messages">;
          const { data: prof } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", m.user_id)
            .maybeSingle();
          setMessages((prev) => [...prev, { ...m, profiles: prof ?? null }]);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [conv]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const join = async () => {
    if (!user || !group) {
      navigate({ to: "/auth" });
      return;
    }
    const { error } = await supabase.from("group_members").insert({ group_id: group.id, user_id: user.id });
    if (error) toast.error(error.message);
    else {
      setIsMember(true);
      toast.success("Joined!");
    }
  };

  const send = async () => {
    if (!user || !conv || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: conv.id, user_id: user.id, content: text });
    if (error) toast.error(error.message);
  };

  if (!group) return <div className="min-h-screen bg-background"><Navbar /></div>;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link to="/groups" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All groups
        </Link>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="relative h-32 sm:h-44 bg-gradient-ember">
            {group.cover_url && <img src={group.cover_url} alt="" className="h-full w-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-overlay" />
          </div>
          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl font-bold">{group.name}</h1>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {group.privacy === "public" ? <Globe2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {group.privacy} · <Users className="h-3 w-3" /> {members.length} members
                </div>
              </div>
              {!isMember && <Button onClick={join} className="bg-gradient-sunset border-0">Join</Button>}
            </div>
            {group.description && <p className="mt-3 text-sm text-foreground/85">{group.description}</p>}
          </div>
        </div>

        <div className="mt-6 flex gap-2 border-b border-border/50">
          {(["chat", "members"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-smooth ${tab === t ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "chat" ? (
          <div className="mt-4 flex h-[60vh] flex-col rounded-2xl border border-border/60 bg-card">
            {!isMember ? (
              <div className="flex flex-1 items-center justify-center p-6 text-center text-muted-foreground">
                <div>
                  <p>Join to see and send messages.</p>
                  <Button onClick={join} className="mt-3 bg-gradient-sunset border-0">Join group</Button>
                </div>
              </div>
            ) : (
              <>
                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.length === 0 && <p className="text-center text-sm text-muted-foreground">Be the first to say hi!</p>}
                  {messages.map((m) => {
                    const me = m.user_id === user?.id;
                    return (
                      <div key={m.id} className={`flex gap-2 ${me ? "flex-row-reverse" : ""}`}>
                        <UserAvatar src={m.profiles?.avatar_url} name={m.profiles?.username} size={32} />
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${me ? "bg-gradient-sunset text-primary-foreground" : "bg-secondary"}`}>
                          {!me && <p className="mb-0.5 text-xs font-semibold opacity-80">@{m.profiles?.username}</p>}
                          {m.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 border-t border-border/50 p-3">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Message the group..."
                    className="flex-1 rounded-full bg-secondary px-4 py-2 text-sm outline-none"
                  />
                  <Button size="icon" onClick={send} disabled={!draft.trim()} className="bg-gradient-sunset border-0 rounded-full">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {members.map((m) => (
              <Link
                key={m.id}
                to="/u/$username"
                params={{ username: m.profiles?.username ?? "" }}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3 hover:border-primary/40"
              >
                <UserAvatar src={m.profiles?.avatar_url} name={m.profiles?.username} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.profiles?.display_name || m.profiles?.username}</p>
                  <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
