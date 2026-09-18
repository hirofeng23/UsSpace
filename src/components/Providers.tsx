"use client";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AmbientBGM } from "./AmbientBGM";
import { usePathname } from "next/navigation";

function ProvidersLogger() {
  const { user, profile, loading, profileError } = useAuth();
  const pathname = usePathname();
  const authLoading = loading;

  console.log("PROVIDERS RENDERED", {
    authLoading,
    user: user ? user.uid : null,
    profile: profile ? "Exists" : null,
    loading,
    pathname,
    profileError,
  });

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleBlur = () => document.documentElement.classList.add("window-blurred");
    const handleFocus = () => document.documentElement.classList.remove("window-blurred");
    
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return (
    <AuthProvider>
      <ProvidersLogger />
      {children}
      <AmbientBGM />
    </AuthProvider>
  );
}
