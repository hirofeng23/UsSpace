// Single generic endpoint that replaces the many direct Firestore calls the
// app used to make from the browser. The client (src/lib/firestore.ts) posts
// { action, payload } and this route dispatches to the matching function in
// src/lib/server/store.ts, after checking the caller is logged in (and, for
// couple-scoped actions, actually a member of that couple room).

import { NextRequest, NextResponse } from "next/server";
import { getSessionUid } from "@/lib/server/session";
import { ApiError, assertCoupleMember } from "@/lib/server/store";
import * as store from "@/lib/server/store";

export async function POST(req: NextRequest) {
  let body: { action?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const { action, payload = {} } = body;
  const uid = await getSessionUid();

  if (!uid) {
    return NextResponse.json({ message: "Not signed in." }, { status: 401 });
  }

  try {
    const result = await dispatch(action, payload, uid);
    return NextResponse.json(result ?? null);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error(`[api/data] action "${action}" failed:`, err);
    return NextResponse.json({ message: "Something went wrong." }, { status: 500 });
  }
}

async function dispatch(action: string | undefined, payload: Record<string, unknown>, uid: string) {
  switch (action) {
    case "getUserProfile": {
      const targetUid = (payload.uid as string) || uid;
      return store.getUserProfile(targetUid);
    }

    case "getPartnerProfile": {
      const coupleId = payload.coupleId as string;
      assertCoupleMember(coupleId, uid);
      return store.getPartnerProfile(coupleId, uid);
    }

    case "updateUserProfile": {
      return store.updateUserProfile(uid, payload.data as Parameters<typeof store.updateUserProfile>[1]);
    }

    case "ensureCoupleCodeIndex": {
      return store.ensureCoupleCodeIndex(uid);
    }

    case "getCouple": {
      const coupleId = payload.coupleId as string;
      assertCoupleMember(coupleId, uid);
      return store.getCouple(coupleId);
    }

    case "joinCouple": {
      return { coupleId: store.joinCouple(uid, payload.partnerCode as string) };
    }

    case "updateCoupleSong": {
      const coupleId = payload.coupleId as string;
      return store.updateCoupleSong(coupleId, uid, payload.song as Parameters<typeof store.updateCoupleSong>[2]);
    }

    case "createDailyMemory": {
      const coupleId = payload.coupleId as string;
      assertCoupleMember(coupleId, uid);
      return store.createDailyMemory({
        userId: uid,
        coupleId,
        imageUrl: payload.imageUrl as string,
        caption: payload.caption as string | undefined,
        note: payload.note as string | undefined,
      });
    }

    case "getTodayMemory": {
      const coupleId = payload.coupleId as string;
      assertCoupleMember(coupleId, uid);
      return store.getTodayMemory(uid, coupleId);
    }

    case "getMemories": {
      const coupleId = payload.coupleId as string;
      assertCoupleMember(coupleId, uid);
      return store.getMemories(coupleId, payload.limitCount as number | undefined);
    }

    case "getMemoriesPaginated": {
      const coupleId = payload.coupleId as string;
      assertCoupleMember(coupleId, uid);
      return store.getMemoriesPaginated(
        coupleId,
        payload.limitCount as number,
        (payload.cursorMs as number | null) ?? null
      );
    }

    case "toggleMemoryReaction": {
      return store.toggleMemoryReaction(payload.memoryId as string, uid, payload.reaction as string | null);
    }

    case "updateMood": {
      const coupleId = payload.coupleId as string;
      assertCoupleMember(coupleId, uid);
      return store.updateMood(coupleId, uid, payload.mood as string, payload.cooldownMinutes as number | undefined);
    }

    case "getMoods": {
      const coupleId = payload.coupleId as string;
      assertCoupleMember(coupleId, uid);
      return store.getMoods(coupleId, payload.limitCount as number | undefined);
    }

    case "saveFutureMessage": {
      const coupleId = payload.coupleId as string;
      assertCoupleMember(coupleId, uid);
      return store.saveFutureMessage({
        coupleId,
        senderId: uid,
        message: payload.message as string,
        imageUrl: (payload.imageUrl as string | null) ?? null,
        unlockAt: payload.unlockAt as number,
      });
    }

    case "getFutureMessages": {
      const coupleId = payload.coupleId as string;
      assertCoupleMember(coupleId, uid);
      return store.getFutureMessages(coupleId);
    }

    case "markFutureMessageAsOpened": {
      return store.markFutureMessageAsOpened(payload.messageId as string, uid);
    }

    case "getFutureMessageSecret": {
      return store.getFutureMessageSecret(payload.messageId as string, uid);
    }

    case "getPlaylist": {
      const coupleId = payload.coupleId as string;
      assertCoupleMember(coupleId, uid);
      return store.getPlaylist(coupleId);
    }

    case "addSongToPlaylist": {
      const coupleId = payload.coupleId as string;
      assertCoupleMember(coupleId, uid);
      const song = payload.song as { title: string; url: string; platform: "spotify" | "youtube" | "ambience"; artist?: string };
      return store.addSongToPlaylist(coupleId, { ...song, addedBy: uid });
    }

    case "removeSongFromPlaylist": {
      const coupleId = payload.coupleId as string;
      assertCoupleMember(coupleId, uid);
      return store.removeSongFromPlaylist(coupleId, payload.songId as string);
    }

    case "reorderPlaylist": {
      const coupleId = payload.coupleId as string;
      assertCoupleMember(coupleId, uid);
      return store.reorderPlaylist(coupleId, payload.songIds as string[]);
    }

    default:
      throw new ApiError(`Unknown action: ${action}`, 400);
  }
}
