import { Link, useNavigate } from "@tanstack/react-router";
import { Compass, LogOut, Plus, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-sunset shadow-glow transition-spring group-hover:rotate-12">
            <Compass className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">Wanderlog</span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link to="/explore">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Explore</Button>
          </Link>
          {user ? (
            <>
              <Link to="/new">
                <Button size="sm" className="bg-gradient-sunset hover:opacity-90 border-0 shadow-glow">
                  <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New post</span>
                </Button>
              </Link>
              <Link to="/profile">
                <Button variant="ghost" size="icon"><UserIcon className="h-4 w-4" /></Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="bg-gradient-sunset hover:opacity-90 border-0">Sign in</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
