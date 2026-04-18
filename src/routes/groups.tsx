import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Lock, Globe2, Plus, Users, Mail, Clock } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/Avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/groups")({
  head: () => ({ meta: [{ title: "Groups — Wanderlog" }] }),
  component: GroupsPage,
});

type Group = Tables<"groups"> & { is_member?: boolean; pending_request?: boolean };

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function GroupsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [invites, setInvites] = useState<
    Array<Tables<"group_invites"> & { groups: Tables<"groups"> | null; profiles: Pick<Tables<"profiles">, "username"> | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: all } = await supabase
      .from("groups")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    const list = (all ?? []) as Group[];

    if (user) {
      const { data: mine } = await supabase
        .from("group_members")
        .select("group_id, groups(*)")
        .eq("user_id", user.id);
      const mineIds = new Set((mine ?? []).map((m) => m.group_id));
      list.forEach((g) => (g.is_member = mineIds.has(g.id)));
      setMyGroups((mine ?? []).map((m) => ({ ...(m.groups as never as Group), is_member: true })));

      // Pending join requests by this user
      const { data: reqs } = await supabase
        .from("group_join_requests")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("status", "pending");
      const reqIds = new Set((reqs ?? []).map((r) => r.group_id));
      list.forEach((g) => (g.pending_request = reqIds.has(g.id)));

      // Pending invites for this user
      const { data: inv } = await supabase
        .from("group_invites")
        .select("*, groups(*)")
        .eq("invitee_id", user.id)
        .eq("status", "pending");
      // fetch inviter profiles
      const inviterIds = Array.from(new Set((inv ?? []).map((i) => i.inviter_id)));
      let inviterMap: Record<string, { username: string }> = {};
      if (inviterIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", inviterIds);
        inviterMap = Object.fromEntries((profs ?? []).map((p) => [p.id, { username: p.username }]));
      }
      setInvites(
        ((inv ?? []) as any[]).map((i) => ({
          ...i,
          profiles: inviterMap[i.inviter_id] ?? null,
        })) as any,
      );
    }
    setGroups(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const requestOrJoin = async (g: Group) => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (g.privacy === "public") {
      const { error } = await supabase.from("group_members").insert({ group_id: g.id, user_id: user.id });
      if (error) toast.error(error.message);
      else {
        toast.success("Joined!");
        load();
      }
    } else {
      const { error } = await supabase.from("group_join_requests").insert({ group_id: g.id, user_id: user.id });
      if (error) toast.error(error.message);
      else {
        toast.success("Request sent. The owner will review it.");
        load();
      }
    }
  };

  const respondInvite = async (inviteId: string, accept: boolean) => {
    const { error } = await supabase
      .from("group_invites")
      .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
      .eq("id", inviteId);
    if (error) toast.error(error.message);
    else {
      toast.success(accept ? "Joined the group!" : "Invite declined");
      load();
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-10">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-bold">Travel groups</h1>
            <p className="mt-1 text-sm text-muted-foreground">Find your tribe. Plan trips. Chat together.</p>
          </div>
          {user && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-sunset border-0 shadow-glow">
                  <Plus className="h-4 w-4" /> New group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create a travel group</DialogTitle></DialogHeader>
                <CreateGroupForm
                  userId={user.id}
                  onCreated={(slug) => {
                    setOpen(false);
                    navigate({ to: "/groups/$slug", params: { slug } });
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
        </header>

        {invites.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Invites
            </h2>
            <ul className="space-y-2">
              {invites.map((iv) => (
                <li
                  key={iv.id}
                  className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">@{iv.profiles?.username ?? "someone"}</span>{" "}
                      invited you to{" "}
                      <span className="font-semibold">{iv.groups?.name}</span>
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => respondInvite(iv.id, false)}>
                    Decline
                  </Button>
                  <Button size="sm" onClick={() => respondInvite(iv.id, true)} className="bg-gradient-sunset border-0">
                    Accept
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {user && myGroups.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-bold mb-3">Your groups</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {myGroups.map((g) => <GroupCard key={g.id} group={g} onAction={requestOrJoin} />)}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-display text-xl font-bold mb-3">Discover</h2>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : groups.length === 0 ? (
            <p className="text-muted-foreground text-sm">No groups yet — be the first to start one.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map((g) => <GroupCard key={g.id} group={g} onAction={requestOrJoin} />)}
            </div>
          )}
        </section>
      </main>
      <BottomNav />
    </div>
  );
}

function GroupCard({ group, onAction }: { group: Group; onAction: (g: Group) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
      <div className="relative h-28 bg-gradient-ember">
        {group.cover_url && <img src={group.cover_url} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-overlay" />
        <div className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-xs backdrop-blur">
          {group.privacy === "public" ? <Globe2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {group.privacy}
        </div>
      </div>
      <div className="p-4">
        <Link to="/groups/$slug" params={{ slug: group.slug }} className="font-display text-lg font-bold hover:underline">
          {group.name}
        </Link>
        {group.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{group.description}</p>}
        <div className="mt-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" /> Travel group
          </span>
          {group.is_member ? (
            <Link to="/groups/$slug" params={{ slug: group.slug }}>
              <Button size="sm" variant="outline">Open</Button>
            </Link>
          ) : group.pending_request ? (
            <Button size="sm" variant="outline" disabled>
              <Clock className="h-3 w-3" /> Requested
            </Button>
          ) : (
            <Button size="sm" onClick={() => onAction(group)} className="bg-gradient-sunset border-0">
              {group.privacy === "public" ? "Join" : "Request"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateGroupForm({ userId, onCreated }: { userId: string; onCreated: (slug: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    const baseSlug = slugify(name) || "group";
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: g, error } = await supabase
      .from("groups")
      .insert({ name: name.trim(), slug, description: description.trim() || null, privacy, created_by: userId })
      .select()
      .single();
    if (error || !g) {
      setSubmitting(false);
      toast.error(error?.message || "Could not create group");
      return;
    }
    const { data: conv } = await supabase
      .from("conversations")
      .insert({ type: "group", group_id: g.id, created_by: userId })
      .select()
      .single();
    if (conv) {
      await supabase.from("conversation_participants").insert({ conversation_id: conv.id, user_id: userId });
    }
    setSubmitting(false);
    onCreated(g.slug);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="gname">Group name</Label>
        <Input id="gname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Backpackers of Asia" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gdesc">Description</Label>
        <Textarea id="gdesc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What's this group about?" />
      </div>
      <div className="space-y-2">
        <Label>Privacy</Label>
        <div className="flex gap-2">
          {(["public", "private"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPrivacy(p)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${privacy === p ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
            >
              {p === "public" ? <Globe2 className="inline h-3.5 w-3.5 mr-1" /> : <Lock className="inline h-3.5 w-3.5 mr-1" />}
              {p}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {privacy === "public" ? "Anyone can join instantly." : "People must request to join, and you approve."}
        </p>
      </div>
      <Button type="submit" disabled={submitting} className="w-full bg-gradient-sunset border-0">
        {submitting ? "Creating..." : "Create group"}
      </Button>
    </form>
  );
}
