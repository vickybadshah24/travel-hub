import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Globe2, Lock, Users, Send, ArrowLeft, UserPlus, Check, X, Search } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { UserAvatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/groups/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Wanderlog` }] }),
  component: GroupDetail,
});

type Member = Tables<"group_members"> & { profiles?: Pick<Tables<"profiles">, "username" | "display_name" | "avatar_url"> | null };
type Message = Tables<"messages"> & { profiles?: Pick<Tables<"profiles">, "username" | "avatar_url"> | null };
type JoinRequest = Tables<"group_join_requests"> & { profile?: Pick<Tables<"profiles">, "username" | "display_name" | "avatar_url"> | null };

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<"chat" | "members" | "requests">("chat");
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [requestSent, setRequestSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshRequests = async (groupId: string) => {
    const { data } = await supabase
      .from("group_join_requests")
      .select("*")
      .eq("group_id", groupId)
      .eq("status", "pending");
    const rows = (data ?? []) as JoinRequest[];
    if (rows.length > 0) {
      const ids = rows.map((r) => r.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ids);
      const m = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
      setRequests(rows.map((r) => ({ ...r, profile: m[r.user_id] ?? null })));
    } else {
      setRequests([]);
    }
  };

  useEffect(() => {
    supabase.from("groups").select("*").eq("slug", slug).maybeSingle().then(async ({ data: g }) => {
      if (!g) return;
      setGroup(g);
      const { data: ms } = await supabase
        .from("group_members")
        .select("*, profiles(username, display_name, avatar_url)")
        .eq("group_id", g.id);
      const memberRows = (ms as Member[]) ?? [];
      setMembers(memberRows);
      if (user) {
        const myMembership = memberRows.find((m) => m.user_id === user.id);
        setIsMember(!!myMembership);
        setIsAdmin(myMembership?.role === "owner" || myMembership?.role === "admin");

        // Check if user has a pending request
        const { data: existing } = await supabase
          .from("group_join_requests")
          .select("id, status")
          .eq("group_id", g.id)
          .eq("user_id", user.id)
          .eq("status", "pending")
          .maybeSingle();
        setRequestSent(!!existing);

        if (myMembership?.role === "owner" || myMembership?.role === "admin") {
          refreshRequests(g.id);
        }
      }
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

  const requestOrJoin = async () => {
    if (!user || !group) {
      navigate({ to: "/auth" });
      return;
    }
    if (group.privacy === "public") {
      const { error } = await supabase.from("group_members").insert({ group_id: group.id, user_id: user.id });
      if (error) toast.error(error.message);
      else {
        setIsMember(true);
        toast.success("Joined!");
      }
    } else {
      const { error } = await supabase.from("group_join_requests").insert({ group_id: group.id, user_id: user.id });
      if (error) toast.error(error.message);
      else {
        setRequestSent(true);
        toast.success("Request sent.");
      }
    }
  };

  const respondRequest = async (req: JoinRequest, approve: boolean) => {
    if (!user) return;
    const { error } = await supabase
      .from("group_join_requests")
      .update({
        status: approve ? "approved" : "rejected",
        responded_at: new Date().toISOString(),
        responded_by: user.id,
      })
      .eq("id", req.id);
    if (error) toast.error(error.message);
    else {
      toast.success(approve ? "Approved" : "Rejected");
      if (group) {
        refreshRequests(group.id);
        // refresh members
        const { data: ms } = await supabase
          .from("group_members")
          .select("*, profiles(username, display_name, avatar_url)")
          .eq("group_id", group.id);
        setMembers((ms as Member[]) ?? []);
      }
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
              <div className="flex items-center gap-2">
                {isMember && (
                  <InviteDialog groupId={group.id} memberIds={members.map((m) => m.user_id)} />
                )}
                {!isMember && !requestSent && (
                  <Button onClick={requestOrJoin} className="bg-gradient-sunset border-0">
                    {group.privacy === "public" ? "Join" : "Request to join"}
                  </Button>
                )}
                {!isMember && requestSent && (
                  <Button variant="outline" disabled>Request pending</Button>
                )}
              </div>
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
          {isAdmin && (
            <button
              onClick={() => setTab("requests")}
              className={`relative px-4 py-2 text-sm font-medium transition-smooth ${tab === "requests" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
            >
              Requests
              {requests.length > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gradient-sunset px-1.5 text-[10px] font-bold text-primary-foreground">
                  {requests.length}
                </span>
              )}
            </button>
          )}
        </div>

        {tab === "chat" ? (
          <div className="mt-4 flex h-[60vh] flex-col rounded-2xl border border-border/60 bg-card">
            {!isMember ? (
              <div className="flex flex-1 items-center justify-center p-6 text-center text-muted-foreground">
                <div>
                  <p>Join to see and send messages.</p>
                  {!requestSent && (
                    <Button onClick={requestOrJoin} className="mt-3 bg-gradient-sunset border-0">
                      {group.privacy === "public" ? "Join group" : "Request to join"}
                    </Button>
                  )}
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
        ) : tab === "members" ? (
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
        ) : (
          <div className="mt-4 space-y-2">
            {requests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
                No pending requests.
              </div>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
                  <UserAvatar src={r.profile?.avatar_url} name={r.profile?.username} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">@{r.profile?.username ?? "user"}</p>
                    {r.message && <p className="line-clamp-2 text-xs text-muted-foreground">"{r.message}"</p>}
                  </div>
                  <Button size="icon" variant="outline" onClick={() => respondRequest(r, false)} aria-label="Reject">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="icon" onClick={() => respondRequest(r, true)} className="bg-gradient-sunset border-0" aria-label="Approve">
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function InviteDialog({ groupId, memberIds }: { groupId: string; memberIds: string[] }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Pick<Tables<"profiles">, "id" | "username" | "display_name" | "avatar_url">[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    // Load existing pending invites to disable buttons
    supabase
      .from("group_invites")
      .select("invitee_id")
      .eq("group_id", groupId)
      .eq("status", "pending")
      .then(({ data }) => {
        setInvitedIds(new Set((data ?? []).map((d) => d.invitee_id)));
      });
  }, [open, groupId]);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(10);
    setResults(data ?? []);
    setSearching(false);
  };

  const invite = async (inviteeId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("group_invites")
      .insert({ group_id: groupId, inviter_id: user.id, invitee_id: inviteeId });
    if (error) toast.error(error.message);
    else {
      toast.success("Invite sent");
      setInvitedIds((prev) => new Set(prev).add(inviteeId));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4" /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite travelers</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
              placeholder="Search by username..."
            />
            <Button onClick={search} disabled={!query.trim() || searching} variant="outline">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {results.map((p) => {
              const isMember = memberIds.includes(p.id);
              const invited = invitedIds.has(p.id);
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary/40">
                  <UserAvatar src={p.avatar_url} name={p.username} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">@{p.username}</p>
                    {p.display_name && <p className="truncate text-xs text-muted-foreground">{p.display_name}</p>}
                  </div>
                  {isMember ? (
                    <span className="text-xs text-muted-foreground">Member</span>
                  ) : invited ? (
                    <span className="text-xs text-primary">Invited</span>
                  ) : (
                    <Button size="sm" onClick={() => invite(p.id)} className="bg-gradient-sunset border-0">
                      Invite
                    </Button>
                  )}
                </li>
              );
            })}
            {results.length === 0 && query && !searching && (
              <li className="p-4 text-center text-sm text-muted-foreground">No travelers found.</li>
            )}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
