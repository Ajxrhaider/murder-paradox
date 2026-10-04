import { NextRequest, NextResponse } from "next/server";
import { createGame, toPublicGame } from "@/lib/game";
import {
  decryptGameState,
  encryptGameState,
  GAME_COOKIE_MAX_AGE_SECONDS,
  GAME_COOKIE_NAME,
} from "@/lib/game-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore<T>(data: T): NextResponse<T> {
  const response = NextResponse.json(data);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(GAME_COOKIE_NAME)?.value;
  const state = decryptGameState(token);

  if (!state || state.expiresAt <= Date.now()) {
    return noStore({ game: null });
  }

  return noStore({ game: toPublicGame(state) });
}

export async function POST() {
  try {
    const state = createGame();
    const response = noStore({ game: toPublicGame(state) });

    response.cookies.set({
      name: GAME_COOKIE_NAME,
      value: encryptGameState(state),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: GAME_COOKIE_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error(
      "Could not start a Murder Paradox case:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "The case could not be initialized. Check the server environment variables." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
