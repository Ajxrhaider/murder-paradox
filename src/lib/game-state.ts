import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { SUSPECT_IDS, type GameState } from "@/lib/game-types";

export const GAME_COOKIE_NAME = "murder_paradox_case";
export const GAME_COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60;

function encryptionKey(): Buffer {
  const secret = process.env.GAME_STATE_SECRET;

  if (!secret || secret.trim().length < 32) {
    throw new Error("GAME_STATE_SECRET must contain at least 32 characters.");
  }

  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptGameState(state: GameState): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(state), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<GameState>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.createdAt !== "number" ||
    typeof candidate.expiresAt !== "number" ||
    typeof candidate.killerId !== "string" ||
    typeof candidate.liarId !== "string" ||
    typeof candidate.questionsUsed !== "number" ||
    typeof candidate.revealed !== "boolean" ||
    !candidate.witnesses ||
    !candidate.questionsBySuspect
  ) {
    return false;
  }

  return SUSPECT_IDS.every((id) => {
    const witness = candidate.witnesses?.[id];
    return (
      typeof candidate.questionsBySuspect?.[id] === "number" &&
      witness?.id === id &&
      (witness.truthStatus === "truthful" || witness.truthStatus === "liar") &&
      Array.isArray(witness.claims)
    );
  });
}

export function decryptGameState(token: string | undefined): GameState | null {
  if (!token) return null;

  try {
    const [version, ivPart, tagPart, ciphertextPart] = token.split(".");
    if (version !== "v1" || !ivPart || !tagPart || !ciphertextPart) return null;

    const iv = Buffer.from(ivPart, "base64url");
    const tag = Buffer.from(tagPart, "base64url");
    const ciphertext = Buffer.from(ciphertextPart, "base64url");
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) return null;

    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    const parsed: unknown = JSON.parse(plaintext);

    return isGameState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
