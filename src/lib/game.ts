import { randomInt, randomUUID } from "node:crypto";
import {
  SUSPECT_IDS,
  type CaseFile,
  type GameState,
  type HiddenWitness,
  type PublicGame,
  type SuspectId,
  type SuspectProfile,
  type WitnessClaim,
  type WitnessSelection,
  type WitnessTone,
} from "@/lib/game-types";

export const GAME_LIFETIME_MS = 12 * 60 * 60 * 1000;
export const MAX_QUESTIONS_PER_SUSPECT = 6;
export const MAX_QUESTIONS = SUSPECT_IDS.length * MAX_QUESTIONS_PER_SUSPECT;

export const CASE_FILE: CaseFile = {
  caseNumber: "CASE 001",
  title: "The Orchid House",
  victim: "Dr. Orin Bell",
  location: "The Orchid House at Bellwether Museum",
  timeOfDeath: "9:20 PM",
  cause: "Aconite poisoning in black tea",
  summary:
    "Museum director Dr. Orin Bell was found dead in the Orchid House. The service-hatch log records an opening at 9:14 PM, but the corridor camera went dark at the same time. Three staff members had access to the connected wing.",
  evidence: [
    "Aconite was found in Dr. Bell’s black tea.",
    "The service hatch opened at 9:14 PM.",
    "The service-corridor camera was offline from 9:12 to 9:17 PM.",
  ],
};

export const SUSPECTS: SuspectProfile[] = [
  {
    id: "mara",
    name: "Mara Quinn",
    title: "Head Botanist",
    initials: "MQ",
    palette: "emerald",
    workArea: "the East Greenhouse",
    summary:
      "Knows the glasshouse plants by heart. Dr. Bell had threatened to close her rare-orchid programme.",
  },
  {
    id: "elias",
    name: "Elias Ward",
    title: "Security Chief",
    initials: "EW",
    palette: "indigo",
    workArea: "the Security Booth",
    summary:
      "Controlled the service-hatch keys. Dr. Bell was reviewing an unexplained gap in the security audit.",
  },
  {
    id: "celeste",
    name: "Celeste Voss",
    title: "Art Conservator",
    initials: "CV",
    palette: "amber",
    workArea: "the Restoration Studio",
    summary:
      "Restored the museum’s most valuable portrait. Dr. Bell planned to sell it against her wishes.",
  },
];

const MOTIVES: Record<SuspectId, string> = {
  mara: "Dr. Bell planned to close the rare-orchid programme I had spent ten years building.",
  elias: "Dr. Bell was preparing to report the gap I concealed in the security audit.",
  celeste: "Dr. Bell planned to sell the Bellwether portrait I had spent years restoring.",
};

const FALSE_ALIBI_LOCATIONS = [
  "the West Arcade",
  "the Map Archive",
  "the Staff Kitchen",
  "the Music Gallery",
  "the Loading Court",
];

const STAGE_DIRECTIONS: Record<
  SuspectId,
  Record<WitnessTone, string>
> = {
  mara: {
    composed: "Mara brushes a fleck of soil from her sleeve.",
    guarded: "Mara watches you over folded arms.",
    nervous: "Mara rubs her palms against her coat.",
    sharp: "Mara’s answer comes out clipped and precise.",
  },
  elias: {
    composed: "Elias gives a measured nod.",
    guarded: "Elias keeps his expression carefully blank.",
    nervous: "Elias glances toward the silent security monitor.",
    sharp: "Elias’s voice turns firm.",
  },
  celeste: {
    composed: "Celeste squares the edge of her case notes.",
    guarded: "Celeste studies you without blinking.",
    nervous: "Celeste steadies a hand on the table.",
    sharp: "Celeste answers with cool precision.",
  },
};

function pick<T>(items: readonly T[]): T {
  return items[randomInt(items.length)];
}

function pickFalseLocation(actualLocation: string): string {
  const alternatives = FALSE_ALIBI_LOCATIONS.filter(
    (location) => location !== actualLocation,
  );
  return pick(alternatives);
}

function makeTruthfulClaims(
  suspect: SuspectProfile,
  isKiller: boolean,
  killerName: string,
): WitnessClaim[] {
  const timeline = isKiller
    ? "I was in the Orchid House at 9:14 PM, carrying Dr. Bell’s black tea."
    : `I was in ${suspect.workArea} from 9:10 to 9:18 PM.`;

  const action = isKiller
    ? "I put aconite in Dr. Bell’s tea and left the cup within his reach."
    : "I did not enter the Orchid House after 9:00 PM or handle Dr. Bell’s tea.";

  const observation = isKiller
    ? "I carried Dr. Bell’s black tea through the service hatch into the Orchid House at 9:14 PM."
    : `I saw ${killerName} carry Dr. Bell’s black tea through the service hatch into the Orchid House at 9:14 PM.`;

  return [
    { id: "timeline", topic: "timeline", text: timeline },
    { id: "motive", topic: "motive", text: MOTIVES[suspect.id] },
    { id: "action", topic: "action", text: action },
    { id: "observation", topic: "observation", text: observation },
  ];
}

function makeFalseClaim(actualLocation: string): WitnessClaim[] {
  const falseLocation = pickFalseLocation(actualLocation);

  return [
    {
      id: "timeline",
      topic: "timeline",
      text: `I was in ${falseLocation} from 9:10 to 9:18 PM.`,
    },
  ];
}

export function isSuspectId(value: unknown): value is SuspectId {
  return typeof value === "string" && SUSPECT_IDS.some((id) => id === value);
}

export function createGame(): GameState {
  const killerId = pick(SUSPECT_IDS);
  const liarId = pick(SUSPECT_IDS);
  const witnesses = {} as Record<SuspectId, HiddenWitness>;

  for (const suspect of SUSPECTS) {
    const isKiller = suspect.id === killerId;
    const actualLocation = isKiller ? "the Orchid House" : suspect.workArea;
    const truthStatus = suspect.id === liarId ? "liar" : "truthful";
    const claims =
      truthStatus === "liar"
        ? makeFalseClaim(actualLocation)
        : makeTruthfulClaims(
            suspect,
            isKiller,
            SUSPECTS.find((candidate) => candidate.id === killerId)?.name ?? "the suspect",
          );

    witnesses[suspect.id] = {
      id: suspect.id,
      truthStatus,
      claims,
    };
  }

  const truthfulCount = Object.values(witnesses).filter(
    (witness) => witness.truthStatus === "truthful",
  ).length;

  if (truthfulCount !== 2) {
    throw new Error("Game invariant failed: each case must have two truthful witnesses.");
  }

  const createdAt = Date.now();

  return {
    id: randomUUID(),
    createdAt,
    expiresAt: createdAt + GAME_LIFETIME_MS,
    killerId,
    liarId,
    witnesses,
    questionsUsed: 0,
    questionsBySuspect: { mara: 0, elias: 0, celeste: 0 },
    revealed: false,
  };
}

export function toPublicGame(state: GameState): PublicGame {
  const result = state.revealed && state.accusedId
    ? {
        correct: state.accusedId === state.killerId,
        accusedId: state.accusedId,
        culpritId: state.killerId,
        liarId: state.liarId,
      }
    : null;

  return {
    gameId: state.id,
    startedAt: state.createdAt,
    expiresAt: state.expiresAt,
    caseFile: CASE_FILE,
    suspects: SUSPECTS,
    questionsUsed: state.questionsUsed,
    questionsRemaining: Math.max(0, MAX_QUESTIONS - state.questionsUsed),
    maxQuestions: MAX_QUESTIONS,
    maxQuestionsPerSuspect: MAX_QUESTIONS_PER_SUSPECT,
    questionsBySuspect: state.questionsBySuspect,
    isOver: state.revealed,
    result,
  };
}

export function renderWitnessReply(
  witness: HiddenWitness,
  selection: WitnessSelection,
): string {
  const allowedIds = new Set(witness.claims.map((claim) => claim.id));
  const selectedClaims = selection.claimIds
    .filter((id, index, all) => allowedIds.has(id) && all.indexOf(id) === index)
    .slice(0, 2)
    .map((id) => witness.claims.find((claim) => claim.id === id))
    .filter((claim): claim is WitnessClaim => Boolean(claim));
  const stageDirection = STAGE_DIRECTIONS[witness.id][selection.tone];

  if (selectedClaims.length === 0) {
    return `${stageDirection} “I can only speak to what I know about that evening. Ask me about the timeline, the tea, or my connection to Dr. Bell.”`;
  }

  return `${stageDirection} “${selectedClaims.map((claim) => claim.text).join(" ")}"`;
}
