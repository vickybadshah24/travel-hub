import { Link } from "@tanstack/react-router";
import { Home, Compass, PlusSquare, Users, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";

const items = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/explore", icon: Compass, label: "Explore" },
  { to: "/new", icon: PlusSquare, label: "Post", auth: true },
  { to: "/groups", icon: Users, label: "Groups" },
  { to: "/messages", icon: MessageCircle, label: "Chat", auth: true },
] as const;

export function BottomNav() {
  const { user } = useAuth();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-xl md:hidden">
      <ul className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
        {items.map((it) => {
          if (it.auth && !user) return null;
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                activeOptions={{ exact: it.to === "/" }}
                activeProps={{ className: "text-primary" }}
                inactiveProps={{ className: "text-muted-foreground" }}
                className="flex flex-col items-center gap-0.5 rounded-lg p-2 text-xs transition-smooth hover:text-foreground"
              >
                <Icon className="h-6 w-6" strokeWidth={2} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
