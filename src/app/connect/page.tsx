"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Users, AlertCircle } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/GlassCard";
import { ConnectGuard } from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { ensureCoupleCodeIndex, joinCouple } from "@/lib/firestore";
import { SecureCoupleCode } from "@/components/SecureCoupleCode";

export default function ConnectPage() {
  return (
    <ConnectGuard>
      <ConnectForm />
    </ConnectGuard>
  );
}

function ConnectForm() {
  const { user, profile, refreshProfile } = useAuth();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [partnerCode, setPartnerCode] = useState("");
  const [error, setError] = useState("");
  const [codeReady, setCodeReady] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile || mode !== "create") return;

    ensureCoupleCodeIndex(profile)
      .then(() => setCodeReady(true))
      .catch(() => {
        setCodeError("Could not register your code. Please try again.");
      });
  }, [profile, mode]);


  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      await joinCouple(user.uid, partnerCode.trim());
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <Heart className="mx-auto h-8 w-8 text-rose-400" fill="currentColor" />
          <h1 className="mt-4 text-2xl font-bold text-white">Connect with your partner</h1>
          <p className="mt-2 text-sm text-white/40">Share your code or join theirs</p>
        </div>

        {mode === "choose" ? (
          <div className="space-y-4">
            <button
              onClick={() => {
                setCodeReady(false);
                setCodeError("");
                setMode("create");
              }}
              className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-xl transition hover:bg-white/10"
            >
              <div className="rounded-xl bg-rose-500/20 p-3">
                <Heart className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <p className="font-medium text-white/90">Create Room</p>
                <p className="text-sm text-white/40">Share your code with partner</p>
              </div>
            </button>

            <button
              onClick={() => setMode("join")}
              className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-xl transition hover:bg-white/10"
            >
              <div className="rounded-xl bg-purple-500/20 p-3">
                <Users className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-white/90">Join Partner</p>
                <p className="text-sm text-white/40">Enter your partner&apos;s code</p>
              </div>
            </button>
          </div>
        ) : mode === "create" ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            {codeError ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{codeError}</p>
              </div>
            ) : !codeReady ? (
              <div className="flex flex-col items-center py-6">
                <LoadingSpinner />
                <p className="mt-3 text-sm text-white/40">Preparing your code...</p>
              </div>
            ) : (
              <>
                <SecureCoupleCode code={profile?.coupleCode || ""} />
                <p className="mt-4 text-center text-xs text-white/30">
                  Waiting for your partner to join...
                </p>
              </>
            )}
            <button
              onClick={() => setMode("choose")}
              className="mt-4 w-full text-sm text-white/40 hover:text-white/60"
            >
              Back
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleJoin}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
          >
            <label className="mb-1.5 block text-xs text-white/50">
              Partner&apos;s Couple Code
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={partnerCode}
              onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] text-white outline-none focus:border-rose-400/50"
              placeholder="ABC123"
            />

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || partnerCode.length < 6}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <LoadingSpinner size="sm" /> : "Connect"}
            </button>
            <button
              type="button"
              onClick={() => setMode("choose")}
              className="mt-4 w-full text-sm text-white/40 hover:text-white/60"
            >
              Back
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
