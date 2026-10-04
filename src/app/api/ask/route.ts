import { NextRequest, NextResponse } from "next/server";
import {
  isSuspectId,
  MAX_QUESTIONS_PER_SUSPECT,
  renderWitnessReply,
  toPublicGame,
} from "@/lib/game";
import {
  decryptGameState,
  encryptGameState,
  GAME_COOKIE_NAME,
} from "@/lib/game-state";
import { selectWitnessClaims } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION_LENGTH = 500;

function noStore<T>(data: T, status = 200): NextResponse<T> {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

function upstreamStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  if (typeof candidate.status === "number") return candidate.status;
  if (typeof candidate.statusCode === "number") return candidate.statusCode;
  return undefined;
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

  const payload = body as { suspectId?: unknown; question?: unknown };
  const suspectId = payload.suspectId;
  const question = typeof payload.question === "string" ? payload.question.trim() : "";

  if (!isSuspectId(suspectId)) {
    return noStore({ error: "Choose one of the three listed suspects." }, 400);
  }
  if (!question) {
    return noStore({ error: "Enter a question for the witness." }, 400);
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return noStore({ error: `Questions must be ${MAX_QUESTION_LENGTH} characters or fewer.` }, 400);
  }
  if (!process.env.GEMINI_API_KEY) {
    return noStore({ error: "GEMINI_API_KEY is missing from the server environment." }, 503);
  }

  const token = request.cookies.get(GAME_COOKIE_NAME)?.value;
  const state = decryptGameState(token);
  if (!state || state.expiresAt <= Date.now()) {
    return noStore({ error: "No active case was found. Start a new investigation." }, 404);
  }
  if (state.revealed) {
    return noStore({ error: "This case is closed. Start a new investigation to interview again." }, 409);
  }
  if (state.questionsBySuspect[suspectId] >= MAX_QUESTIONS_PER_SUSPECT) {
    return noStore({ error: "You have used all six questions for this witness." }, 429);
  }

  const witness = state.witnesses[suspectId];

  try {
    const selection = await selectWitnessClaims(witness, question);
    const answer = renderWitnessReply(witness, selection);

    state.questionsUsed += 1;
    state.questionsBySuspect[suspectId] += 1;

    const response = noStore({ answer, game: toPublicGame(state) });
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
  } catch (error) {
    const status = upstreamStatus(error);
    console.error(
      "Gemini witness interview failed:",
      status ?? (error instanceof Error ? error.message : "Unknown Gemini error"),
    );

    if (status === 429) {
      return noStore(
        { error: "Gemini’s rate limit or free-tier quota was reached. Wait, then try again." },
        429,
      );
    }

    return noStore(
      { error: "Gemini could not complete the interview. Your question was not used; try again." },
      502,
    );
  }
}
