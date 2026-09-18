"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { MemoryGallery } from "@/components/MemoryGallery";
import { useAuth } from "@/context/AuthContext";
import { getPartnerProfile, getMemoriesPaginated, toggleMemoryReaction, type MemoriesCursor } from "@/lib/firestore";
import type { DailyMemory, UserProfile } from "@/types";

export default function GalleryPage() {
  return (
    <AuthGuard>
      <GalleryContent />
    </AuthGuard>
  );
}

function GallerySkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="relative aspect-[4/3] rounded-xl bg-white/5 border border-white/5 animate-pulse overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      ))}
    </div>
  );
}

function GalleryContent() {
  const { user, profile, registerVerifiedUrls } = useAuth();
  const [memories, setMemories] = useState<DailyMemory[]>([]);
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const [lastVisible, setLastVisible] = useState<MemoriesCursor>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMemories = useCallback(async (isInitial = false) => {
    if (!profile?.coupleId) return;

    if (!isInitial) {
      setLoadingMore(true);
    }

    try {
      const limitCount = 12;
      const cursor = isInitial ? null : lastVisible;
      const result = await getMemoriesPaginated(profile.coupleId, limitCount, cursor);

      if (isInitial) {
        setMemories(result.memories);
      } else {
        setMemories((prev) => [...prev, ...result.memories]);
      }

      setLastVisible(result.lastVisible);
      setHasMore(result.memories.length === limitCount);
    } catch (err) {
      console.error("Error loading memories:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [profile, lastVisible]);

  useEffect(() => {
    if (memories.length > 0) {
      registerVerifiedUrls(memories.map((m) => m.imageUrl));
    }
  }, [memories, registerVerifiedUrls]);

  useEffect(() => {
    if (!profile?.coupleId || !user) return;
    getPartnerProfile(profile.coupleId, user.uid).then(setPartner);
    setTimeout(() => {
      loadMemories(true);
    }, 0);
  }, [profile?.coupleId, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleReaction = async (memoryId: string, emoji: string) => {
    if (!user) return;
    const memory = memories.find((m) => m.id === memoryId);
    if (!memory) return;

    const existingReactions = memory.reactions || {};
    const currentReaction = existingReactions[user.uid];
    const newReaction = currentReaction === emoji ? null : emoji;

    try {
      await toggleMemoryReaction(memoryId, user.uid, newReaction);
      setMemories((prev) =>
        prev.map((m) => {
          if (m.id === memoryId) {
            const nextReactions = { ...m.reactions };
            if (newReaction) {
              nextReactions[user.uid] = newReaction;
            } else {
              delete nextReactions[user.uid];
            }
            return { ...m, reactions: nextReactions };
          }
          return m;
        })
      );
    } catch (err) {
      console.error("Failed to toggle reaction:", err);
    }
  };

  if (!user || !profile) return null;

  const userNames: Record<string, string> = {
    [user.uid]: profile.name,
  };
  if (partner) userNames[partner.uid] = partner.name;

  return (
    <div className="relative min-h-screen pb-24 md:pb-8 md:pt-20">
      <Navbar />

      <div className="relative mx-auto max-w-5xl px-4 py-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-extrabold text-white flex items-center gap-2 tracking-tight">
                Shared Gallery <Sparkles className="h-5 w-5 text-yellow-400 fill-yellow-400" />
              </h1>
              <p className="text-xs text-white/40 font-medium mt-1">
                A visual timeline of your relationship milestones
              </p>
            </div>
            {memories.length > 0 && (
              <span className="text-xs text-rose-300 font-semibold bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-full w-fit">
                {memories.length} {memories.length === 1 ? "Memory" : "Memories"} Together
              </span>
            )}
          </div>

          {loading ? (
            <GallerySkeleton />
          ) : memories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white/2 border border-white/5 rounded-3xl p-8 backdrop-blur-md">
              <div className="rounded-full bg-white/5 p-4 mb-4 border border-white/5 text-white/30 animate-pulse">
                <Calendar className="h-8 w-8" />
              </div>
              <h3 className="text-base font-extrabold text-white mb-1">Your journey starts today. ❤️</h3>
              <p className="text-xs text-white/40 max-w-xs leading-relaxed mt-1">
                Upload your first memory together.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              <MemoryGallery
                memories={memories}
                userNames={userNames}
                userId={user.uid}
                onToggleReaction={handleToggleReaction}
              />

              <AnimatePresence>
                {hasMore && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex justify-center pt-4"
                  >
                    <button
                      onClick={() => loadMemories(false)}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold text-white px-6 py-3 shadow-lg hover:border-white/20 transition disabled:opacity-50 cursor-pointer"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="h-4.5 w-4.5 animate-spin text-rose-400" />
                          Loading more memories...
                        </>
                      ) : (
                        <>
                          Load More Memories
                          <ArrowRight className="h-4 w-4 text-rose-300" />
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
