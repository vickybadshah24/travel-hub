import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { UserAvatar } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/messages/")({
  head: () => ({ meta: [{ title: "Messages — Wanderlog" }] }),
  component: MessagesIndex,
});

type ConvRow = {
  id: string;
  type: "direct" | "group";
  group_id: string | null;
  group?: Pick<Tables<"groups">, "name" | "slug" | "cover_url"> | null;
  other_user?: Pick<Tables<"profiles">, "id" | "username" | "display_name" | "avatar_url"> | null;
  last_message?: string | null;
};

function MessagesIndex() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("conversation_id, conversations(id, type, group_id)")
        .eq("user_id", user.id);

      const directIds: string[] = [];
      const groupIds: string[] = [];
      const all: { id: string; type: "direct" | "group"; group_id: string | null }[] = [];
      (parts ?? []).forEach((p) => {
        const c = p.conversations as never as { id: string; type: "direct" | "group"; group_id: string | null };
        if (!c) return;
        all.push(c);
        if (c.type === "direct") directIds.push(c.id);
        else if (c.group_id) groupIds.push(c.group_id);
      });

      // Group convs from group memberships (auto-included)
      const { data: myGroupMem } = await supabase
        .from("group_members")
        .select("group_id, groups(id, name, slug, cover_url)")
        .eq("user_id", user.id);
      const groupMap = new Map<string, { name: string; slug: string; cover_url: string | null }>();
      (myGroupMem ?? []).forEach((g) => {
        const grp = g.groups as never as Tables<"groups">;
        if (grp) groupMap.set(grp.id, { name: grp.name, slug: grp.slug, cover_url: grp.cover_url });
      });
      const groupIdsAll = Array.from(groupMap.keys());
      let groupConvs: { id: string; group_id: string }[] = [];
      if (groupIdsAll.length) {
        const { data } = await supabase
          .from("conversations")
          .select("id, group_id")
          .in("group_id", groupIdsAll);
        groupConvs = (data ?? []) as never;
      }

      // Direct: find other participant
      const otherMap = new Map<string, ConvRow["other_user"]>();
      if (directIds.length) {
        const { data: others } = await supabase
          .from("conversation_participants")
          .select("conversation_id, profiles(id, username, display_name, avatar_url)")
          .in("conversation_id", directIds)
          .neq("user_id", user.id);
        (others ?? []).forEach((o) => {
          otherMap.set(o.conversation_id, o.profiles as never);
        });
      }

      // Last message per conv
      const allConvIds = [...new Set([...all.map((a) => a.id), ...groupConvs.map((g) => g.id)])];
      const lastMap = new Map<string, string>();
      if (allConvIds.length) {
        const { data: msgs } = await supabase
          .from("messages")
          .select("conversation_id, content, created_at")
          .in("conversation_id", allConvIds)
          .order("created_at", { ascending: false })
          .limit(200);
        (msgs ?? []).forEach((m) => {
          if (!lastMap.has(m.conversation_id)) lastMap.set(m.conversation_id, m.content);
        });
      }

      const rows: ConvRow[] = [
        ...all
          .filter((c) => c.type === "direct")
          .map((c) => ({
            id: c.id,
            type: "direct" as const,
            group_id: null,
            other_user: otherMap.get(c.id) ?? null,
            last_message: lastMap.get(c.id) ?? null,
          })),
        ...groupConvs.map((c) => ({
          id: c.id,
          type: "group" as const,
          group_id: c.group_id,
          group: groupMap.get(c.group_id) ?? null,
          last_message: lastMap.get(c.id) ?? null,
        })),
      ];

      setConvs(rows);
      setBusy(false);
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="font-display text-3xl font-bold">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">Chat with travelers and groups.</p>

        <div className="mt-6 space-y-2">
          {busy ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : convs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
              No conversations yet. Visit a profile to start a DM, or join a group to chat.
            </div>
          ) : (
            convs.map((c) =>
              c.type === "direct" && c.other_user ? (
                <Link
                  key={c.id}
                  to="/messages/$convId"
                  params={{ convId: c.id }}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3 hover:border-primary/40"
                >
                  <UserAvatar src={c.other_user.avatar_url} name={c.other_user.username} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">@{c.other_user.username}</p>
                    <p className="truncate text-sm text-muted-foreground">{c.last_message ?? "Say hi 👋"}</p>
                  </div>
                </Link>
              ) : c.type === "group" && c.group ? (
                <Link
                  key={c.id}
                  to="/groups/$slug"
                  params={{ slug: c.group.slug }}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3 hover:border-primary/40"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gradient-ember">
                    {c.group.cover_url && <img src={c.group.cover_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.group.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{c.last_message ?? "Group chat"}</p>
                  </div>
                </Link>
              ) : null,
            )
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
