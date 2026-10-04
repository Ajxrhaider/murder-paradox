export const SUSPECT_IDS = ["mara", "elias", "celeste"] as const;

export type SuspectId = (typeof SUSPECT_IDS)[number];
export type SuspectPalette = "emerald" | "indigo" | "amber";
export type ClaimTopic = "timeline" | "motive" | "action" | "observation";
export type WitnessTone = "composed" | "guarded" | "nervous" | "sharp";

export interface SuspectProfile {
  id: SuspectId;
  name: string;
  title: string;
  initials: string;
  palette: SuspectPalette;
  workArea: string;
  summary: string;
}

export interface CaseFile {
  caseNumber: string;
  title: string;
  victim: string;
  location: string;
  timeOfDeath: string;
  cause: string;
  summary: string;
  evidence: string[];
}

export interface WitnessClaim {
  id: string;
  topic: ClaimTopic;
  text: string;
}

export interface HiddenWitness {
  id: SuspectId;
  truthStatus: "truthful" | "liar";
  claims: WitnessClaim[];
}

export interface GameState {
  id: string;
  createdAt: number;
  expiresAt: number;
  killerId: SuspectId;
  liarId: SuspectId;
  witnesses: Record<SuspectId, HiddenWitness>;
  questionsUsed: number;
  questionsBySuspect: Record<SuspectId, number>;
  revealed: boolean;
  accusedId?: SuspectId;
}

export interface GameResult {
  correct: boolean;
  accusedId: SuspectId;
  culpritId: SuspectId;
  liarId: SuspectId;
}

export interface PublicGame {
  gameId: string;
  startedAt: number;
  expiresAt: number;
  caseFile: CaseFile;
  suspects: SuspectProfile[];
  questionsUsed: number;
  questionsRemaining: number;
  maxQuestions: number;
  maxQuestionsPerSuspect: number;
  questionsBySuspect: Record<SuspectId, number>;
  isOver: boolean;
  result: GameResult | null;
}

export interface WitnessSelection {
  claimIds: string[];
  tone: WitnessTone;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}
