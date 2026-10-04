import { NextRequest, NextResponse } from "next/server";
import { isSuspectId, toPublicGame } from "@/lib/game";
import {
  decryptGameState,
  encryptGameState,
  GAME_COOKIE_NAME,
} from "@/lib/game-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore<T>(data: T, status = 200): NextResponse<T> {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "Send a valid JSON request." }, 400);
  }

  if (!body || typeof body !== "object") {
    return noStore({ error: "Send a valid JSON request." }, 400);
  }

  const suspectId = (body as { suspectId?: unknown }).suspectId;
  if (!isSuspectId(suspectId)) {
    return noStore({ error: "Choose one of the three listed suspects." }, 400);
  }

  const token = request.cookies.get(GAME_COOKIE_NAME)?.value;
  const state = decryptGameState(token);
  if (!state || state.expiresAt <= Date.now()) {
    return noStore({ error: "No active case was found. Start a new investigation." }, 404);
  }

  if (!state.revealed) {
    state.revealed = true;
    state.accusedId = suspectId;
  }

  const response = noStore({ game: toPublicGame(state) });
  response.cookies.set({
    name: GAME_COOKIE_NAME,
    value: encryptGameState(state),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.max(1, Math.floor((state.expiresAt - Date.now()) / 1000)),
  });

  return response;
}
