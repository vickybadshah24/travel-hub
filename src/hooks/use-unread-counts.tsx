import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useUnreadCounts() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(0);
  const [messages, setMessages] = useState(0);

  useEffect(() => {
    if (!user) {
      setNotifications(0);
      setMessages(0);
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      // Unread notifications
      const { count: notifCount } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (!cancelled) setNotifications(notifCount ?? 0);

      // Unread DMs (direct conversations only — group msgs come via notifications)
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at, conversations!inner(type)")
        .eq("user_id", user.id);

      if (!parts) {
        if (!cancelled) setMessages(0);
        return;
      }

      const directParts = parts.filter(
        (p: any) => p.conversations?.type === "direct",
      );

      let total = 0;
      for (const p of directParts) {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", p.conversation_id)
          .neq("user_id", user.id)
          .gt("created_at", p.last_read_at ?? "1970-01-01");
        total += count ?? 0;
      }

      if (!cancelled) setMessages(total);
    };

    refresh();

    const channel = supabase
      .channel(`unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => refresh(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { notifications, messages };
}
