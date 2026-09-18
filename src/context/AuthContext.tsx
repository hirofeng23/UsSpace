"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { UserProfile } from "@/types";
import { usePathname } from "next/navigation";
import { getUserProfile } from "@/lib/firestore";
import { reviveTimestamps } from "@/lib/timestamp";

// Local replacement for Firebase's `User` object — just enough shape
// (`uid`, `email`) for the rest of the app, which never used anything else
// from it besides an occasional `displayName` fallback.
export interface LocalUser {
  uid: string;
  email: string;
  displayName?: string;
}

interface AuthContextType {
  user: LocalUser | null;
  profile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    profileData: {
      name: string;
      gender: string;
      relationshipStartDate: Date;
    }
  ) => Promise<void>;
  completeProfile: (profileData: {
    name: string;
    gender: string;
    relationshipStartDate: Date;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  registerVerifiedUrls: (urls: string[]) => void;
  isUrlVerified: (url: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return reviveTimestamps(data) as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const signupInProgress = useRef(false);

  const pathname = usePathname();
  console.log("[AuthContext] Render logs:", {
    loading,
    user: user ? user.uid : null,
    profile: profile ? "Exists" : null,
    pathname,
    profileError,
  });

  // Restore the signed-in state from the session cookie on first load —
  // this replaces Firebase's onAuthStateChanged listener.
  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((raw) => reviveTimestamps(raw) as { user: LocalUser | null; profile: UserProfile | null })
      .then((data) => {
        if (!active) return;
        if (!signupInProgress.current) {
          setUser(data.user);
          setProfile(data.profile);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("[AuthContext] Failed to restore session:", err);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const result = await api<{ uid: string; email: string; profile: UserProfile }>("/api/auth/login", {
      email,
      password,
    });
    setUser({ uid: result.uid, email: result.email });
    setProfile(result.profile);
    setProfileError(null);
  };

  const signup = async (
    email: string,
    password: string,
    profileData: {
      name: string;
      gender: string;
      relationshipStartDate: Date;
    }
  ) => {
    signupInProgress.current = true;
    setLoading(true);
    try {
      const result = await api<{ uid: string; email: string; profile: UserProfile }>("/api/auth/signup", {
        email,
        password,
        name: profileData.name,
        gender: profileData.gender,
        relationshipStartDate: profileData.relationshipStartDate.getTime(),
      });
      setUser({ uid: result.uid, email: result.email });
      setProfile(result.profile);
    } finally {
      signupInProgress.current = false;
      setLoading(false);
    }
  };

  const completeProfile = async (profileData: {
    name: string;
    gender: string;
    relationshipStartDate: Date;
  }) => {
    if (!user) throw new Error("Not authenticated");
    signupInProgress.current = true;
    try {
      const result = await api<{ profile: UserProfile }>("/api/auth/complete-profile", {
        name: profileData.name,
        gender: profileData.gender,
        relationshipStartDate: profileData.relationshipStartDate.getTime(),
      });
      setProfile(result.profile);
    } finally {
      signupInProgress.current = false;
    }
  };

  const logout = async () => {
    await api("/api/auth/logout");
    setUser(null);
    setProfile(null);
  };

  const verifiedUrlsRef = useRef<Set<string>>(new Set());

  const registerVerifiedUrls = (urls: string[]) => {
    urls.forEach((url) => {
      if (url) verifiedUrlsRef.current.add(url);
    });
  };

  const isUrlVerified = () => {
    return true;
  };

  const fetchProfile = async (uid: string) => {
    setProfileError(null);
    try {
      const p = await getUserProfile(uid);
      setProfile(p);
      return p;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setProfileError(msg);
      setProfile(null);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileError,
        login,
        signup,
        completeProfile,
        logout,
        refreshProfile,
        registerVerifiedUrls,
        isUrlVerified,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
