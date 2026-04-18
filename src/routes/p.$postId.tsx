import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { FeedPost } from "@/components/FeedPost";
import { TravelMap } from "@/components/TravelMap";
import { Recommendations } from "@/components/Recommendations";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/p/$postId")({
  head: () => ({ meta: [{ title: "Post — Wanderlog" }] }),
  component: PostPage,
});

type Post = Tables<"posts"> & { profiles?: Pick<Tables<"profiles">, "username" | "display_name" | "avatar_url"> | null };

function PostPage() {
  const { postId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from("posts")
      .select("*, profiles(username, display_name, avatar_url)")
      .eq("id", postId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setPost(data as unknown as Post);
      });
  }, [postId]);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {notFound ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">Post not found.</p>
            <Button onClick={() => navigate({ to: "/explore" })} className="mt-4 bg-gradient-sunset border-0">
              Back to explore
            </Button>
          </div>
        ) : !post ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <>
            <FeedPost post={post} />

            {post.latitude != null && post.longitude != null && (
              <section>
                <h2 className="mb-2 font-display text-lg font-bold">On the map</h2>
                <TravelMap
                  height={240}
                  pins={[
                    {
                      id: post.id,
                      lat: post.latitude,
                      lng: post.longitude,
                      title: post.title,
                      image_url: post.image_url,
                    },
                  ]}
                />
              </section>
            )}

            <Recommendations
              postId={post.id}
              title={post.title}
              location={post.location}
              country={post.country}
              caption={post.caption}
              lat={post.latitude}
              lng={post.longitude}
            />

            {post.user_id === user?.id && (
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!confirm("Delete this destination?")) return;
                    await supabase.from("posts").delete().eq("id", post.id);
                    navigate({ to: "/profile" });
                  }}
                >
                  Delete post
                </Button>
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
