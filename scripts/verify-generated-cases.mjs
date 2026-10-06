import assert from "node:assert/strict";
import { createDecipheriv, createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const baseUrl = (process.env.GAME_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const caseCount = Number.parseInt(process.env.CASES_TO_VERIFY ?? "300", 10);
const cookieName = "murder_paradox_case";
const knownSuspectIds = ["mara", "elias", "celeste"];
const forbiddenPublicKeys = ["killerId", "liarId", "witnesses", "truthStatus", "claims"];

function getGameSecret() {
  if (process.env.GAME_STATE_SECRET) return process.env.GAME_STATE_SECRET;

  if (existsSync(".env.local")) {
    const content = readFileSync(".env.local", "utf8");
    const line = content.split(/\r?\n/).find((entry) => /^\s*GAME_STATE_SECRET\s*=/.test(entry));
    if (line) {
      return line.replace(/^\s*GAME_STATE_SECRET\s*=\s*/, "").trim().replace(/^(["'])(.*)\1$/, "$2");
    }
  }

  throw new Error("Set GAME_STATE_SECRET or add it to .env.local so the test can inspect the encrypted game cookie.");
}

const secret = getGameSecret();
assert.ok(secret.trim().length >= 32, "GAME_STATE_SECRET must be at least 32 characters.");
assert.ok(Number.isInteger(caseCount) && caseCount >= 1, "CASES_TO_VERIFY must be a positive integer.");
const key = createHash("sha256").update(secret, "utf8").digest();

function extractCookie(response) {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`(?:^|,\\s*)${cookieName}=([^;]+)`));
  assert.ok(match, "API response did not set the encrypted game cookie.");
  assert.ok(setCookie.length < 4096, `Set-Cookie header is ${setCookie.length} bytes; keep game cookies below common browser limits.`);
  return match[1];
}

function decryptGameState(token) {
  const [version, ivPart, tagPart, ciphertextPart] = token.split(".");
  assert.equal(version, "v3", "Expected the compressed v3 encrypted-cookie format.");
  assert.ok(ivPart && tagPart && ciphertextPart, "Encrypted cookie has an invalid format.");

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");
  assert.equal(iv.length, 12, "AES-GCM IV must be 12 bytes.");
  assert.equal(tag.length, 16, "AES-GCM authentication tag must be 16 bytes.");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const json = inflateRawSync(compressed, { maxOutputLength: 16_384 }).toString("utf8");
  return JSON.parse(json);
}

const seenScenarioTitles = new Set();
const seenRoleTitles = new Set();

function inspectCase(state, publicGame) {
  seenScenarioTitles.add(state.caseFile.title);
  for (const suspect of state.suspects) seenRoleTitles.add(suspect.title);

  assert.equal(state.suspects.length, 3, "Every generated case must contain exactly three suspects.");
  assert.deepEqual(state.suspects.map((suspect) => suspect.id).sort(), [...knownSuspectIds].sort());
  assert.equal(new Set(state.suspects.map((suspect) => suspect.name)).size, 3, "Suspect names must be unique within a case.");
  assert.equal(new Set(state.suspects.map((suspect) => suspect.title)).size, 3, "The three suspect roles must be distinct within a case.");
  assert.ok(state.suspects.every((suspect) => suspect.name && suspect.title && suspect.workArea));
  assert.ok(state.caseFile.title && state.caseFile.victim && state.caseFile.location && state.caseFile.cause);
  assert.equal(state.caseFile.evidence.length, 3, "Each case must have three dossier evidence entries.");
  assert.ok(knownSuspectIds.includes(state.killerId));
  assert.ok(knownSuspectIds.includes(state.liarId));

  const truthful = Object.values(state.witnesses).filter((witness) => witness.truthStatus === "truthful");
  const liars = Object.values(state.witnesses).filter((witness) => witness.truthStatus === "liar");
  assert.equal(truthful.length, 2, "Every generated case must have exactly two truthful witnesses.");
  assert.equal(liars.length, 1, "Every generated case must have exactly one liar.");

  for (const witness of truthful) {
    assert.equal(witness.claims.length, 4, "A truthful witness must have four server-authored claims.");
    assert.deepEqual(
      new Set(witness.claims.map((claim) => claim.topic)),
      new Set(["timeline", "motive", "action", "observation"]),
      "A truthful witness must have one claim for each testimony topic.",
    );

    const observation = witness.claims.find((claim) => claim.topic === "observation");
    assert.ok(observation, "Truthful witnesses must have an observation claim.");
    if (witness.id !== state.killerId) {
      const killer = state.suspects.find((suspect) => suspect.id === state.killerId);
      assert.ok(observation.text.includes(killer.name), "A truthful bystander must identify the killer in their observation.");
    }
  }

  const liar = liars[0];
  assert.equal(liar.claims.length, 1, "The liar must have exactly one immutable claim.");
  assert.equal(liar.claims[0].topic, "timeline", "The liar's only claim must be the false alibi.");
  const locationMatch = liar.claims[0].text.match(/^I was in (.+) from /);
  assert.ok(locationMatch, "The liar's claim must be a single location alibi.");
  const liarProfile = state.suspects.find((suspect) => suspect.id === liar.id);
  const scene = state.caseFile.location.split(" · ")[0];
  const actualLocation = liar.id === state.killerId ? scene : liarProfile.workArea;
  assert.notEqual(locationMatch[1], actualLocation, "The liar's generated alibi must be false.");

  if (state.killerId !== state.liarId) {
    const killerClaims = state.witnesses[state.killerId].claims;
    const admission = killerClaims.find((claim) => claim.topic === "action");
    assert.ok(admission?.text.includes(state.caseFile.victim), "A truthful killer must have a true admission tied to this victim.");
  }

  const serializedPublicGame = JSON.stringify(publicGame);
  for (const keyName of forbiddenPublicKeys) {
    assert.ok(!serializedPublicGame.includes(`\"${keyName}\"`), `Public game JSON must not expose ${keyName}.`);
  }
  assert.equal(publicGame.gameId, state.id);
  assert.equal(publicGame.caseFile.title, state.caseFile.title);
  assert.equal(publicGame.suspects.length, 3);
}

for (let index = 0; index < caseCount; index += 1) {
  const response = await fetch(`${baseUrl}/api/game`, { method: "POST", cache: "no-store" });
  assert.equal(response.status, 200, `Case ${index + 1} failed to initialize (HTTP ${response.status}).`);
  const payload = await response.json();
  assert.ok(payload.game, "Game-start response must contain a public case.");
  const state = decryptGameState(extractCookie(response));
  inspectCase(state, payload.game);

  if (index === 0) {
    const cookie = `${cookieName}=${extractCookie(response)}`;
    const restoredResponse = await fetch(`${baseUrl}/api/game`, {
      headers: { Cookie: cookie },
      cache: "no-store",
    });
    assert.equal(restoredResponse.status, 200);
    const restoredPayload = await restoredResponse.json();
    assert.equal(restoredPayload.game?.gameId, state.id, "Encrypted state must survive a case refresh.");

    const verdictResponse = await fetch(`${baseUrl}/api/accuse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ suspectId: state.killerId }),
      cache: "no-store",
    });
    assert.equal(verdictResponse.status, 200, "A valid verdict must close the case.");
    const verdictPayload = await verdictResponse.json();
    assert.equal(verdictPayload.game?.result?.correct, true, "Accusing the generated killer must score as correct.");
    assert.equal(verdictPayload.game?.result?.culpritId, state.killerId);
    assert.equal(verdictPayload.game?.result?.liarId, state.liarId);
  }
}

if (caseCount >= 300) {
  assert.equal(seenScenarioTitles.size, 20, "A 300-case run should exercise all 20 scenario frameworks.");
  assert.equal(seenRoleTitles.size, 24, "A 300-case run should exercise all 24 role archetypes.");
}

console.log(`Verified ${caseCount} generated cases across ${seenScenarioTitles.size} scenarios and ${seenRoleTitles.size} roles: three unique suspects, two truthful witnesses, one fixed false-alibi witness, encrypted refresh, hidden-role privacy, and verdict reveal.`);
