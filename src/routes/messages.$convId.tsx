import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { UserAvatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/messages/$convId")({
  head: () => ({ meta: [{ title: "Chat — Wanderlog" }] }),
  component: ChatThread,
});

type Message = Tables<"messages"> & { profiles?: Pick<Tables<"profiles">, "username" | "avatar_url"> | null };

function ChatThread() {
  const { convId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<Pick<Tables<"profiles">, "username" | "display_name" | "avatar_url"> | null>(null);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("user_id, profiles(username, display_name, avatar_url)")
        .eq("conversation_id", convId);
      const otherP = (parts ?? []).find((p) => p.user_id !== user.id);
      if (otherP && active) setOther(otherP.profiles as never);

      const { data } = await supabase
        .from("messages")
        .select("*, profiles(username, avatar_url)")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (active) setMessages((data as never) ?? []);
    })();

    const channel = supabase
      .channel(`dm:${convId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
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
  }, [convId, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!user || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: convId, user_id: user.id, content: text });
    if (error) toast.error(error.message);
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-4">
        <div className="mb-3 flex items-center gap-3">
          <Link to="/messages" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {other && (
            <Link
              to="/u/$username"
              params={{ username: other.username }}
              className="flex items-center gap-2"
            >
              <UserAvatar src={other.avatar_url} name={other.username} size={36} />
              <div>
                <p className="font-semibold leading-tight">@{other.username}</p>
                {other.display_name && <p className="text-xs text-muted-foreground">{other.display_name}</p>}
              </div>
            </Link>
          )}
        </div>

        <div className="flex h-[70vh] flex-col rounded-2xl border border-border/60 bg-card">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && <p className="text-center text-sm text-muted-foreground">Send the first message.</p>}
            {messages.map((m) => {
              const me = m.user_id === user?.id;
              return (
                <div key={m.id} className={`flex gap-2 ${me ? "flex-row-reverse" : ""}`}>
                  {!me && <UserAvatar src={m.profiles?.avatar_url} name={m.profiles?.username} size={32} />}
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${me ? "bg-gradient-sunset text-primary-foreground" : "bg-secondary"}`}>
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
              placeholder="Type a message..."
              className="flex-1 rounded-full bg-secondary px-4 py-2 text-sm outline-none"
            />
            <Button size="icon" onClick={send} disabled={!draft.trim()} className="bg-gradient-sunset border-0 rounded-full">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
