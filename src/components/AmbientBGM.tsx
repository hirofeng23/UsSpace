"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Volume2, VolumeX, Play, Pause, SkipForward, SkipBack, Heart, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { subscribeToPlaylist } from "@/lib/firestore";
import type { CouplePlaylist, PlaylistItem } from "@/types";

type BGMCategory = "telugu" | "hindi" | "english";
type BGMMode = "telugu" | "hindi" | "english" | "automix" | "couple";

const getSpotifyEmbedUrl = (url: string) => {
  if (!url) return "";
  try {
    const match = url.match(/spotify\.com\/(track|playlist|album|artist)\/([a-zA-Z0-9]+)/);
    if (match) {
      const [, type, id] = match;
      return `https://open.spotify.com/embed/${type}/${id}`;
    }
    return "";
  } catch {
    return "";
  }
};

const getYouTubeId = (url: string) => {
  if (!url) return "";
  try {
    let videoId = "";
    const watchMatch = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/
    );
    if (watchMatch) {
      videoId = watchMatch[1];
    }
    return videoId;
  } catch {
    return "";
  }
};

const MUSIC_CATEGORIES = {
  telugu: [
    {
      id: "telugu_morning",
      title: "Telugu Morning Serenity ❤️",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      desc: "Classical flute, acoustic strings & sunrise warmth",
      type: "custom" as const,
    },
    {
      id: "telugu_evening",
      title: "Telugu Sunset Romance ✨",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      desc: "Veena strings & warm lo-fi beats",
      type: "custom" as const,
    },
    {
      id: "telugu_latenight",
      title: "Telugu Moonlight Devotion 🌙",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
      desc: "Classical flute & devotional pads (Night Mode)",
      type: "custom" as const,
    },
  ],
  hindi: [
    {
      id: "hindi_morning",
      title: "Hindi Morning Serenade ✨",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
      desc: "Hopeful morning sitar & keyboard chords",
      type: "custom" as const,
    },
    {
      id: "hindi_evening",
      title: "Hindi Sunset Lounge ☕",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
      desc: "Lo-fi romantic lounge beats",
      type: "custom" as const,
    },
    {
      id: "hindi_latenight",
      title: "Hindi Dreamscape Midnight 🌙",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
      desc: "Dreamy night flute & emotional pads",
      type: "custom" as const,
    },
  ],
  english: [
    {
      id: "english_morning",
      title: "English Dreamy Sunrise ❤️",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
      desc: "Acoustic guitar & morning piano ambience",
      type: "custom" as const,
    },
    {
      id: "english_evening",
      title: "English Sunset Chill ☕",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
      desc: "Sunset chill lounge lo-fi",
      type: "custom" as const,
    },
    {
      id: "english_latenight",
      title: "English Midnight Sleep 🌙",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
      desc: "Deep night emotional ambient drone",
      type: "custom" as const,
    },
  ],
};

const getTrackByTime = (): number => {
  const hours = new Date().getHours();
  if (hours >= 5 && hours < 12) return 0;
  if (hours >= 12 && hours < 22) return 1;
  return 2;
};

const parseFirebaseTimestamp = (
  ts: { toDate?: () => Date; seconds?: number } | string | number | null | undefined
): Date | null => {
  if (!ts) return null;
  if (typeof ts === "object") {
    const obj = ts as { toDate?: () => Date; seconds?: number };
    if (obj.toDate && typeof obj.toDate === "function") {
      return obj.toDate();
    }
    if (typeof obj.seconds === "number") {
      return new Date(obj.seconds * 1000);
    }
  }
  if (typeof ts === "string" || typeof ts === "number") {
    return new Date(ts);
  }
  return null;
};

const resolveAutoMixCategory = (
  hour: number,
  userMood: string | null,
  relationshipDays: number
): BGMCategory => {
  if (
    relationshipDays > 0 &&
    (relationshipDays % 50 === 0 || relationshipDays % 100 === 0 || relationshipDays % 365 === 0)
  ) {
    return "english";
  }

  if (userMood) {
    const moodLower = userMood.toLowerCase();
    if (["happy", "excited", "loved"].includes(moodLower)) {
      return "hindi";
    }
    if (["missing", "sad", "sleepy"].includes(moodLower)) {
      return "telugu";
    }
    if (["busy", "angry"].includes(moodLower)) {
      return "english";
    }
  }

  if (hour >= 5 && hour < 13) return "english";
  if (hour >= 13 && hour < 21) return "hindi";
  return "telugu";
};

// ==========================================
// PURE CSS DYNAMIC WAVEFORM INDICATOR
// ==========================================
function AudioWaveform({
  isPlaying,
  resolvedCategory,
}: {
  isPlaying: boolean;
  resolvedCategory: BGMMode;
}) {
  const [isLateNight] = useState(() => {
    const hours = new Date().getHours();
    return hours >= 22 || hours < 5;
  });
  
  const isTeluguNight = isLateNight && resolvedCategory === "telugu";

  return (
    <div className="flex items-end gap-[3px] h-3 w-5 pointer-events-none select-none">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-rose-400/80 shadow-[0_0_4px_rgba(244,63,94,0.4)]"
          style={{
            height: "3px",
            animation: isPlaying
              ? `bounceWaveform-${i} ${isTeluguNight ? "1.5s" : "0.8s"} ease-in-out ${i * 0.1}s infinite`
              : "none",
          }}
        />
      ))}
      <style jsx global>{`
        @keyframes bounceWaveform-0 { 0%, 100% { height: 3px; } 50% { height: 7px; } }
        @keyframes bounceWaveform-1 { 0%, 100% { height: 3px; } 50% { height: 11px; } }
        @keyframes bounceWaveform-2 { 0%, 100% { height: 3px; } 50% { height: 9px; } }
        @keyframes bounceWaveform-3 { 0%, 100% { height: 3px; } 50% { height: 5px; } }
      `}</style>
    </div>
  );
}

// ==========================================
// PURE CSS SPARKLE SYSTEM (Telugu Mode active)
// ==========================================
function TeluguSparkles() {
  const [isLateNight] = useState(() => {
    const hours = new Date().getHours();
    return hours >= 22 || hours < 5;
  });

  const [sparkles] = useState(() => {
    return Array.from({ length: 6 }).map((_, i) => ({
      id: i,
      left: `${10 + Math.random() * 80}%`,
      delay: Math.random() * -6,
      size: Math.random() * 5 + 3,
      duration: isLateNight ? Math.random() * 6 + 12 : Math.random() * 4 + 6,
      opacity: isLateNight ? Math.random() * 0.25 + 0.1 : Math.random() * 0.45 + 0.15,
    }));
  });

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl z-0">
      {sparkles.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-amber-300/80 shadow-[0_0_8px_rgba(234,179,8,0.5)]"
          style={{
            left: s.left,
            bottom: "-10px",
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.opacity,
            animation: `floatSparkle ${s.duration}s linear infinite`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
      <style jsx global>{`
        @keyframes floatSparkle {
          0% {
            transform: translateY(0) scale(0.6);
            opacity: 0;
          }
          20% {
            opacity: inherit;
          }
          80% {
            opacity: inherit;
          }
          100% {
            transform: translateY(-90px) scale(1.1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export function AmbientBGM() {
  const { profile } = useAuth();
  const pathname = usePathname();
  // Pages with the bottom tab bar (Navbar) need the floating player pushed
  // up above it on mobile; auth-flow screens (login/signup/connect/etc.)
  // have no bottom nav, so the button can sit lower without covering the
  // vertically-centered form's submit button.
  const hasBottomNav = ["/dashboard", "/gallery", "/vault", "/settings"].some((p) =>
    pathname?.startsWith(p)
  );
  
  const [permission, setPermission] = useState<"pending" | "allowed" | "denied">("pending");
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);
  const [trackIndex, setTrackIndex] = useState(() => getTrackByTime());
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  const [bgmMode, setBgmMode] = useState<BGMMode>(() => {
    if (typeof window === "undefined") return "automix";
    const savedMode = localStorage.getItem("twoframes_bgm_mode");
    if (
      savedMode === "telugu" ||
      savedMode === "hindi" ||
      savedMode === "english" ||
      savedMode === "automix" ||
      savedMode === "couple"
    ) {
      return savedMode as BGMMode;
    }
    return "automix";
  });

  const [playlist, setPlaylist] = useState<CouplePlaylist | null>(null);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [mountTime] = useState(() => Date.now());
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Sync state values to stable refs to avoid dependency invalidation inside playback hooks
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  const isPlayingRef = useRef(isPlaying);
  const playlistSongsRef = useRef<PlaylistItem[]>([]);
  const currentPlayingIdRef = useRef<string | null>(null);

  useEffect(() => {
    volumeRef.current = volume;
    isMutedRef.current = isMuted;
    isPlayingRef.current = isPlaying;
  }, [volume, isMuted, isPlaying]);

  useEffect(() => {
    playlistSongsRef.current = playlist?.songs || [];
  }, [playlist]);

  useEffect(() => {
    currentPlayingIdRef.current = currentPlayingId;
  }, [currentPlayingId]);

  // Subscribe to playlist for real-time synchronization
  useEffect(() => {
    if (!profile?.coupleId) return;
    return subscribeToPlaylist(profile.coupleId, setPlaylist);
  }, [profile?.coupleId]);

  // Sync BGM player updates globally via storage events
  useEffect(() => {
    const handleUpdate = () => {
      const savedMode = localStorage.getItem("twoframes_bgm_mode");
      if (
        savedMode === "telugu" ||
        savedMode === "hindi" ||
        savedMode === "english" ||
        savedMode === "automix" ||
        savedMode === "couple"
      ) {
        setBgmMode(savedMode as BGMMode);
      }
      
      const savedPlaying = localStorage.getItem("twoframes_bgm_playing");
      if (savedPlaying === "true") {
        setIsPlaying(true);
      } else if (savedPlaying === "false") {
        setIsPlaying(false);
      }

      setCurrentPlayingId(localStorage.getItem("twoframes_playlist_playing_id"));
    };

    window.addEventListener("twoframes_bgm_update", handleUpdate);
    return () => window.removeEventListener("twoframes_bgm_update", handleUpdate);
  }, []);

  // Compute relationship days purely via useMemo with stable mountTime reference
  const relationshipDays = useMemo(() => {
    if (!profile?.relationshipStartDate) return 0;
    const date = parseFirebaseTimestamp(profile.relationshipStartDate);
    if (!date) return 0;
    const diffMs = mountTime - date.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }, [profile, mountTime]);

  // Resolve current category (Telugu / Hindi / English)
  const resolvedCategory = useMemo(() => {
    if (bgmMode !== "automix") return bgmMode;
    const hour = new Date(mountTime).getHours();
    const userMood = typeof window !== "undefined" ? localStorage.getItem("twoframes_user_mood") : null;
    return resolveAutoMixCategory(hour, userMood, relationshipDays);
  }, [bgmMode, relationshipDays, mountTime]);

  // Resolve current track in the collaborative playlist or defaults
  const songs = useMemo(() => playlist?.songs || [], [playlist]);
  const coupleTrack = useMemo(() => {
    if (songs.length === 0) return null;
    const match = songs.find((s) => s.id === currentPlayingId);
    return match || songs[0];
  }, [songs, currentPlayingId]);

  const currentTrack = useMemo(() => {
    if (bgmMode === "couple") {
      if (coupleTrack) {
        return {
          id: coupleTrack.id,
          title: coupleTrack.title,
          url: coupleTrack.url,
          desc: coupleTrack.artist || "Shared Favorite",
          type: coupleTrack.platform,
        };
      }
      return {
        id: "no_couple_song",
        title: "No Soundtrack Configured",
        url: "",
        desc: "Add tracks in Playlist widget",
        type: "ambience" as const,
      };
    }
    const list = MUSIC_CATEGORIES[resolvedCategory as BGMCategory];
    return list[trackIndex] || list[0];
  }, [bgmMode, resolvedCategory, trackIndex, coupleTrack]);

  // Stable track transition handler to advance playlist
  const handleTrackEnded = useCallback(() => {
    const list = playlistSongsRef.current;
    const activeId = currentPlayingIdRef.current;
    if (list.length <= 1) return;

    const currentIndex = list.findIndex((s) => s.id === activeId);
    const nextIndex = (currentIndex + 1) % list.length;
    const nextSong = list[nextIndex];
    if (nextSong) {
      localStorage.setItem("twoframes_playlist_playing_id", nextSong.id);
      window.dispatchEvent(new Event("twoframes_bgm_update"));
    }
  }, []);

  // PostMessage listener to capture YouTube state changes and advance queue
  useEffect(() => {
    const handleYTMessage = (event: MessageEvent) => {
      try {
        if (typeof event.data === "string" && event.data.includes("infoDelivery")) {
          const data = JSON.parse(event.data);
          if (data.event === "infoDelivery" && data.info) {
            // playerState: 0 means ENDED
            if (data.info.playerState === 0) {
              handleTrackEnded();
            }
          }
        }
      } catch {
        // Ignore parsing errors for irrelevant messages
      }
    };

    window.addEventListener("message", handleYTMessage);
    return () => window.removeEventListener("message", handleYTMessage);
  }, [handleTrackEnded]);

  // Read persisted preference on mount
  useEffect(() => {
    const savedEnabled = localStorage.getItem("twoframes_bgm_enabled");
    if (savedEnabled === "true") {
      setTimeout(() => {
        setPermission("allowed");
        const savedPlaying = localStorage.getItem("twoframes_bgm_playing");
        setIsPlaying(savedPlaying !== "false");
      }, 0);
    } else if (savedEnabled === "false") {
      setTimeout(() => {
        setPermission("denied");
        setIsPlaying(false);
      }, 0);
    }
  }, []);

  // Update track automatically when time of day changes (checked every 5 minutes)
  useEffect(() => {
    if (permission !== "allowed") return;
    const checkTime = () => {
      const idx = getTrackByTime();
      if (idx !== trackIndex) {
        setTrackIndex(idx);
      }
    };
    const interval = setInterval(checkTime, 300000);
    return () => clearInterval(interval);
  }, [permission, trackIndex]);

  // Synchronize document body background classes based on theme category
  useEffect(() => {
    if (typeof document === "undefined") return;

    document.body.classList.remove(
      "theme-telugu",
      "theme-telugu-night",
      "theme-hindi",
      "theme-english"
    );

    if (permission !== "allowed") return;

    if (resolvedCategory === "telugu") {
      document.body.classList.add("theme-telugu");
      const hours = new Date().getHours();
      if (hours >= 22 || hours < 5) {
        document.body.classList.add("theme-telugu-night");
      }
    } else if (resolvedCategory === "hindi") {
      document.body.classList.add("theme-hindi");
    } else if (resolvedCategory === "english") {
      document.body.classList.add("theme-english");
    }

    return () => {
      document.body.classList.remove(
        "theme-telugu",
        "theme-telugu-night",
        "theme-hindi",
        "theme-english"
      );
    };
  }, [resolvedCategory, permission, trackIndex]);

  // Smooth volume transition helper
  const fadeVolume = useCallback((
    audio: HTMLAudioElement,
    target: number,
    duration: number,
    onComplete?: () => void
  ) => {
    if (fadeIntervalRef.current) {
      cancelAnimationFrame(fadeIntervalRef.current);
    }

    const start = audio.volume;
    const diff = target - start;
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      audio.volume = Math.max(0, Math.min(1, start + diff * progress));

      if (progress < 1) {
        fadeIntervalRef.current = requestAnimationFrame(animate);
      } else {
        if (onComplete) onComplete();
      }
    };

    fadeIntervalRef.current = requestAnimationFrame(animate);
  }, []);

  // Stable track switcher with smooth fade transitions
  const fadeOutAndSwitch = useCallback((audio: HTMLAudioElement, newUrl: string) => {
    fadeVolume(audio, 0, 800, () => {
      audio.pause();
      
      setTimeout(() => {
        audio.src = newUrl;
        audio.preload = "auto";
        audio.load();
        if (isPlayingRef.current) {
          audio.volume = 0;
          audio.play()
            .then(() => {
              fadeVolume(audio, isMutedRef.current ? 0 : volumeRef.current, 1200);
            })
            .catch((err) => {
              console.warn("Autoplay blocked on track transition:", err);
            });
        }
      }, 300);
    });
  }, [fadeVolume]);

  // Audio lifecycle controller (Guarantees only ONE audio source exists)
  useEffect(() => {
    if (permission !== "allowed") return;

    // Pause standard HTML5 audio if we are playing YouTube or Spotify couple track, or if URL is empty
    const isYtOrSpotify = currentTrack.type === "youtube" || currentTrack.type === "spotify";
    if (bgmMode === "couple" && (!currentTrack.url || isYtOrSpotify)) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return;
    }

    if (!audioRef.current) {
      if (!currentTrack.url) return;
      const audio = new Audio(currentTrack.url);
      audio.loop = songs.length <= 1; // loop only if playlist is single-track
      audioRef.current = audio;

      // HTML5 Audio end triggers queue advancement
      audio.addEventListener("ended", () => {
        handleTrackEnded();
      });

      // HTML5 Audio error skips track automatically
      audio.addEventListener("error", (e) => {
        console.warn("Playback error on HTML5 audio. Skipping...", e);
        handleTrackEnded();
      });

      if (isPlayingRef.current) {
        audio.volume = 0;
        audio.play()
          .then(() => {
            fadeVolume(audio, isMutedRef.current ? 0 : volumeRef.current, 1200);
          })
          .catch((err) => {
            console.warn("Autoplay blocked on creation:", err);
            setIsPlaying(false);
          });
      }
    } else {
      audioRef.current.loop = songs.length <= 1;
      fadeOutAndSwitch(audioRef.current, currentTrack.url);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [currentTrack.url, permission, bgmMode, currentTrack.type, songs.length, handleTrackEnded, fadeOutAndSwitch, fadeVolume]);

  // Sync play/pause state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || permission !== "allowed") return;

    if (bgmMode === "couple" && (currentTrack.type === "youtube" || currentTrack.type === "spotify")) {
      return;
    }

    if (isPlaying) {
      audio.volume = 0;
      audio.play()
        .then(() => {
          fadeVolume(audio, isMutedRef.current ? 0 : volumeRef.current, 1200);
        })
        .catch((err) => {
          console.warn("Autoplay blocked, waiting for click:", err);
          setIsPlaying(false);
        });
    } else {
      fadeVolume(audio, 0, 800, () => {
        audio.pause();
      });
    }
  }, [isPlaying, permission, bgmMode, currentTrack.type, fadeVolume]);

  // Sync volume to YouTube iframe player
  useEffect(() => {
    if (bgmMode === "couple" && currentTrack.type === "youtube" && ytIframeRef.current) {
      try {
        const targetVolume = isMuted ? 0 : Math.round(volume * 100);
        ytIframeRef.current.contentWindow?.postMessage(
          JSON.stringify({
            event: "command",
            func: "setVolume",
            args: [targetVolume],
          }),
          "*"
        );
      } catch (err) {
        console.warn("Could not post volume command to YouTube iframe:", err);
      }
    }
  }, [volume, isMuted, bgmMode, currentTrack.type, isPlaying]);

  // Sync volume state instantly for direct slider changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(1, isMuted ? 0 : volume));
  }, [volume, isMuted]);

  const handleAllow = () => {
    localStorage.setItem("twoframes_bgm_enabled", "true");
    localStorage.setItem("twoframes_bgm_playing", "true");
    setPermission("allowed");
    setIsPlaying(true);
    setTrackIndex(getTrackByTime());
    window.dispatchEvent(new Event("twoframes_bgm_update"));
  };

  const handleDeny = () => {
    localStorage.setItem("twoframes_bgm_enabled", "false");
    localStorage.setItem("twoframes_bgm_playing", "false");
    setPermission("denied");
    setIsPlaying(false);
    window.dispatchEvent(new Event("twoframes_bgm_update"));
  };

  const handleTogglePlay = () => {
    const nextPlay = !isPlaying;
    setIsPlaying(nextPlay);
    localStorage.setItem("twoframes_bgm_playing", nextPlay ? "true" : "false");
    window.dispatchEvent(new Event("twoframes_bgm_update"));
  };

  const handleNextTrack = () => {
    if (bgmMode === "couple") {
      handleTrackEnded();
      return;
    }
    setTrackIndex((prev) => (prev + 1) % 3);
  };

  const handlePrevTrack = () => {
    if (bgmMode === "couple") {
      if (songs.length <= 1) return;
      const currentIndex = songs.findIndex((s) => s.id === coupleTrack?.id);
      const prevIndex = currentIndex <= 0 ? songs.length - 1 : currentIndex - 1;
      const prevSong = songs[prevIndex];
      if (prevSong) {
        localStorage.setItem("twoframes_playlist_playing_id", prevSong.id);
        window.dispatchEvent(new Event("twoframes_bgm_update"));
      }
      return;
    }
    setTrackIndex((prev) => (prev <= 0 ? 2 : prev - 1));
  };

  const handleModeChange = (mode: BGMMode) => {
    setBgmMode(mode);
    localStorage.setItem("twoframes_bgm_mode", mode);
    window.dispatchEvent(new Event("twoframes_bgm_update"));
  };

  const gradientClasses = {
    telugu: "from-[#220c1f]/95 to-[#0b030b]/98 border-rose-500/25 shadow-rose-500/10",
    hindi: "from-[#170a24]/95 to-[#08030f]/98 border-purple-500/20 shadow-purple-500/10",
    english: "from-[#0a1324]/95 to-[#030612]/98 border-blue-500/20 shadow-blue-500/10",
    automix: "from-[#110d1c]/95 to-[#07050b]/98 border-rose-500/20 shadow-rose-500/5",
    couple: "from-[#240a1b]/95 to-[#0f040c]/98 border-pink-500/25 shadow-pink-500/10",
  };

  const menuItems = useMemo(() => {
    const base = [
      { id: "telugu" as BGMMode, label: "Telugu", icon: "❤️" },
      { id: "hindi" as BGMMode, label: "Hindi", icon: "✨" },
      { id: "english" as BGMMode, label: "English", icon: "🌙" },
      { id: "automix" as BGMMode, label: "Auto", icon: "🎵" },
    ];
    if (songs.length > 0) {
      base.push({ id: "couple" as BGMMode, label: "Couple", icon: "💑" });
    }
    return base;
  }, [songs.length]);

  const loopParam = songs.length <= 1 ? "1" : "0";
  const ytVideoId = coupleTrack ? getYouTubeId(coupleTrack.url) : "";
  const playlistParam = songs.length <= 1 && ytVideoId ? `&playlist=${ytVideoId}` : "";

  return (
    <>
      {/* 1. Modal permission prompt */}
      <AnimatePresence>
        {permission === "pending" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="max-w-sm rounded-2xl border border-rose-500/20 bg-gradient-to-b from-[#180a24]/90 to-[#0e0717]/95 p-6 text-center shadow-2xl"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
                <Music className="h-6 w-6 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Enable romantic ambience? ❤️</h3>
              <p className="mt-2 text-sm text-white/50 leading-relaxed">
                Background instrumental piano, classical veena/flute, and lo-fi melodies tailored to your relationship timeline.
              </p>
              
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleAllow}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:opacity-90 active:scale-98"
                >
                  <Heart className="h-4 w-4 fill-current animate-beat" />
                  Yes, play music
                </button>
                <button
                  type="button"
                  onClick={handleDeny}
                  className="rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/10 transition"
                >
                  Keep muted
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Floating BGM Player Controller */}
      {permission === "allowed" && (
        <div
          className={`fixed right-4 z-50 md:bottom-6 ${
            hasBottomNav ? "bottom-24" : "bottom-4"
          }`}
        >
          <div className="relative">
            
            {/* Music note floating trigger */}
            <motion.button
              type="button"
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              animate={isPlaying ? { scale: [1, 1.08, 1], rotate: [0, 4, -4, 0] } : {}}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-lg backdrop-blur-xl transition duration-300 outline-none ${
                isPlaying
                  ? "bg-rose-500/25 border-rose-500/40 text-rose-300 shadow-rose-500/20"
                  : "bg-white/5 border-white/10 text-white/40"
              }`}
            >
              <Music className="h-5 w-5" />
            </motion.button>

            {/* Glowing sound wave dots when playing */}
            {isPlaying && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
            )}

            {/* Control panel popup */}
            <AnimatePresence>
              {isPanelOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 15 }}
                  className={`absolute bottom-14 right-0 w-72 rounded-2xl border bg-gradient-to-br p-4 shadow-2xl backdrop-blur-xl transition-all duration-500 ${gradientClasses[bgmMode]}`}
                >
                  {resolvedCategory === "telugu" && <TeluguSparkles />}

                  <div className="relative z-10 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1">
                      Ambience Player <Sparkles className="h-3 w-3 text-amber-300 animate-pulse" />
                    </p>
                    
                    <AudioWaveform isPlaying={isPlaying} resolvedCategory={resolvedCategory} />
                  </div>
                  
                  {/* Animated track details */}
                  <div className="relative z-10 mt-3 mb-4 h-11 flex flex-col justify-center border-b border-white/5 pb-2">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentTrack.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      >
                        <p className="text-xs font-bold text-white line-clamp-1">{currentTrack.title}</p>
                        <p className="text-[9px] text-white/40 line-clamp-1 mt-0.5">{currentTrack.desc}</p>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Mode preference selector */}
                  <div className="relative z-10 mb-4 rounded-xl border border-white/5 bg-black/20 p-1 flex">
                    {menuItems.map((m) => {
                      const active = bgmMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleModeChange(m.id)}
                          title={`${m.label} Ambience`}
                          className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg uppercase tracking-wider transition-all ${
                            active
                              ? "bg-rose-500/25 text-rose-300 border border-rose-500/20 shadow-sm"
                              : "text-white/40 hover:text-white/80"
                          }`}
                        >
                          <span className="block text-xs mb-0.5">{m.icon}</span>
                          {m.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Audio Controls */}
                  <div className="relative z-10 flex items-center gap-3">
                    {/* Prev Track Button */}
                    <button
                      type="button"
                      onClick={handlePrevTrack}
                      title="Previous track"
                      disabled={bgmMode === "couple" && songs.length <= 1}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/5 text-white/80 hover:bg-white/10 transition disabled:opacity-30"
                    >
                      <SkipBack className="h-3.5 w-3.5" />
                    </button>

                    {/* Play/Pause Button */}
                    <button
                      type="button"
                      onClick={handleTogglePlay}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600 active:scale-95 transition"
                    >
                      {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                    </button>
                    
                    {/* Next Track Button */}
                    <button
                      type="button"
                      onClick={handleNextTrack}
                      title="Next track"
                      disabled={bgmMode === "couple" && songs.length <= 1}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/5 text-white/80 hover:bg-white/10 transition disabled:opacity-30"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                    </button>

                    {/* Mute Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsMuted(!isMuted)}
                      className="ml-auto text-white/50 hover:text-white/80 transition animate-fade-in"
                    >
                      {isMuted ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
                    </button>

                    {/* Volume Slider */}
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      disabled={isMuted}
                      onChange={(e) => {
                        setVolume(parseFloat(e.target.value));
                        if (isMuted) setIsMuted(false);
                      }}
                      className="w-16 h-1 rounded-full bg-white/10 appearance-none outline-none accent-rose-500 disabled:opacity-30 cursor-pointer"
                    />
                  </div>

                  {/* Disable link */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      handleDeny();
                    }}
                    className="relative z-10 mt-4 w-full text-center text-[9px] font-bold uppercase tracking-wider text-white/30 hover:text-rose-400 transition"
                  >
                    Disable Ambient Music
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Persistent Spotify Frame (mounted at root of BGM player to prevent unmounting when panel closes) */}
            {bgmMode === "couple" && coupleTrack?.platform === "spotify" && (
              <div
                className={
                  isPanelOpen
                    ? "absolute bottom-14 right-0 w-72 rounded-2xl border border-white/5 bg-[#170a24]/95 p-3 shadow-xl backdrop-blur-xl mb-44 z-50 animate-fade-in"
                    : "absolute -left-[9999px] -top-[9999px] w-1 h-1 pointer-events-none opacity-0"
                }
              >
                <iframe
                  src={getSpotifyEmbedUrl(coupleTrack.url)}
                  width="100%"
                  height="80"
                  frameBorder="0"
                  allowFullScreen={false}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="rounded-xl border border-white/5 shadow-inner"
                />
              </div>
            )}

            {/* Hidden YouTube background iframe player (Autoplays queue tracks) */}
            {bgmMode === "couple" && coupleTrack?.platform === "youtube" && isPlaying && coupleTrack.url && (
              <iframe
                ref={ytIframeRef}
                src={`https://www.youtube.com/embed/${getYouTubeId(coupleTrack.url)}?enablejsapi=1&autoplay=1&mute=${isMuted ? 1 : 0}&loop=${loopParam}${playlistParam}&controls=0`}
                className="w-0 h-0 absolute pointer-events-none opacity-0"
                allow="autoplay; encrypted-media"
              />
            )}

          </div>
        </div>
      )}
    </>
  );
}
