import { Link, useNavigate } from "@tanstack/react-router";
import { Compass, LogOut, Plus, User as UserIcon, Users, MessageCircle } from "lucide-react";
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

        <nav className="flex items-center gap-1">
          <Link to="/explore" className="hidden md:inline-flex">
            <Button variant="ghost" size="sm">Explore</Button>
          </Link>
          <Link to="/groups" className="hidden md:inline-flex">
            <Button variant="ghost" size="sm"><Users className="h-4 w-4" /> Groups</Button>
          </Link>
          {user ? (
            <>
              <Link to="/messages" className="hidden md:inline-flex">
                <Button variant="ghost" size="icon"><MessageCircle className="h-4 w-4" /></Button>
              </Link>
              <Link to="/new">
                <Button size="sm" className="bg-gradient-sunset hover:opacity-90 border-0 shadow-glow">
                  <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Post</span>
                </Button>
              </Link>
              <Link to="/profile" className="hidden md:inline-flex">
                <Button variant="ghost" size="icon"><UserIcon className="h-4 w-4" /></Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={handleSignOut} className="hidden md:inline-flex">
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
