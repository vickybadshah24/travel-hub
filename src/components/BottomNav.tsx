import { Link } from "@tanstack/react-router";
import { Home, Compass, PlusSquare, MessageCircle, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useUnreadCounts } from "@/hooks/use-unread-counts";

type Item = {
  to: "/" | "/explore" | "/new" | "/notifications" | "/messages";
  icon: typeof Home;
  label: string;
  auth?: boolean;
  badgeKey?: "notifications" | "messages";
};
const items: Item[] = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/explore", icon: Compass, label: "Explore" },
  { to: "/new", icon: PlusSquare, label: "Post", auth: true },
  { to: "/notifications", icon: Bell, label: "Activity", auth: true, badgeKey: "notifications" },
  { to: "/messages", icon: MessageCircle, label: "Chat", auth: true, badgeKey: "messages" },
];

export function BottomNav() {
  const { user } = useAuth();
  const counts = useUnreadCounts();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-xl md:hidden">
      <ul className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
        {items.map((it) => {
          if (it.auth && !user) return null;
          const Icon = it.icon;
          const badge = it.badgeKey ? counts[it.badgeKey] : 0;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                activeOptions={{ exact: it.to === "/" }}
                activeProps={{ className: "text-primary" }}
                inactiveProps={{ className: "text-muted-foreground" }}
                className="relative flex flex-col items-center gap-0.5 rounded-lg p-2 text-xs transition-smooth hover:text-foreground"
                aria-label={it.label}
              >
                <Icon className="h-6 w-6" strokeWidth={2} />
                {badge > 0 && (
                  <span className="absolute right-1 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-gradient-sunset px-1.5 text-[10px] font-bold leading-[18px] text-primary-foreground shadow-glow">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
