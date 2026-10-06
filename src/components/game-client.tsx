"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  ChevronRight,
  Clock3,
  Fingerprint,
  FlaskConical,
  LockKeyhole,
  MapPin,
  MessageCircle,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  SUSPECT_IDS,
  type ChatMessage,
  type PublicGame,
  type SuspectId,
  type SuspectPalette,
  type SuspectProfile,
} from "@/lib/game-types";

type ApiPayload = {
  answer?: string;
  error?: string;
  game?: PublicGame | null;
};

type PaletteClasses = {
  avatar: string;
  active: string;
  dot: string;
  label: string;
};

const PALETTE_CLASSES: Record<SuspectPalette, PaletteClasses> = {
  emerald: {
    avatar: "bg-emerald-400/10 text-emerald-300 ring-emerald-300/20",
    active: "border-emerald-300/30 bg-emerald-300/[0.06]",
    dot: "bg-emerald-400",
    label: "text-emerald-300",
  },
  indigo: {
    avatar: "bg-indigo-400/10 text-indigo-300 ring-indigo-300/20",
    active: "border-indigo-300/30 bg-indigo-300/[0.06]",
    dot: "bg-indigo-400",
    label: "text-indigo-300",
  },
  amber: {
    avatar: "bg-amber-300/10 text-amber-200 ring-amber-200/20",
    active: "border-amber-200/30 bg-amber-200/[0.06]",
    dot: "bg-amber-300",
    label: "text-amber-200",
  },
};

const OPENING_LINES: Record<SuspectId, string> = {
  mara: "Ask what you need. I have no interest in polishing a story for you.",
  elias: "Be direct. I will answer what I can about that night.",
  celeste: "Ask your questions. I have already given my statement once.",
};

function suggestedQuestions(caseFile: PublicGame["caseFile"]): string[] {
  const scene = caseFile.location.split(" · ")[0] || caseFile.location;

  return [
    `Where were you around ${caseFile.timeOfDeath}?`,
    `What did you see near ${scene}?`,
    "Did you handle anything relevant to the incident?",
    `What was your relationship with ${caseFile.victim}?`,
  ];
}

function emptyConversations(): Record<SuspectId, ChatMessage[]> {
  return { mara: [], elias: [], celeste: [] };
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ChatMessage>;
  return (
    typeof candidate.id === "string" &&
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.text === "string"
  );
}

function restoreConversations(gameId: string): Record<SuspectId, ChatMessage[]> {
  const restored = emptyConversations();

  try {
    const raw = window.sessionStorage.getItem(`murder-paradox:chat:${gameId}`);
    if (!raw) return restored;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return restored;

    const source = parsed as Record<string, unknown>;
    for (const suspectId of SUSPECT_IDS) {
      const messages = source[suspectId];
      if (Array.isArray(messages)) {
        restored[suspectId] = messages
          .filter(isChatMessage)
          .slice(-60);
      }
    }
  } catch {
    return restored;
  }

  return restored;
}

function createMessage(role: ChatMessage["role"], text: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    text,
  };
}

function suspectPalette(suspect: SuspectProfile): PaletteClasses {
  return PALETTE_CLASSES[suspect.palette];
}

export default function GameClient() {
  const [game, setGame] = useState<PublicGame | null>(null);
  const [selectedSuspectId, setSelectedSuspectId] = useState<SuspectId | null>(null);
  const [chatBySuspect, setChatBySuspect] = useState<
    Record<SuspectId, ChatMessage[]>
  >(emptyConversations);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingAccusation, setPendingAccusation] = useState<SuspectId | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const selectedSuspect = useMemo(
    () => game?.suspects.find((suspect) => suspect.id === selectedSuspectId) ?? null,
    [game?.suspects, selectedSuspectId],
  );
  const currentMessages = selectedSuspect
    ? chatBySuspect[selectedSuspect.id]
    : [];
  const currentQuestionCount = selectedSuspect && game
    ? game.questionsBySuspect[selectedSuspect.id]
    : 0;
  const interviewLimitReached = Boolean(
    game && selectedSuspect &&
      currentQuestionCount >= game.maxQuestionsPerSuspect,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadActiveGame() {
      try {
        const response = await fetch("/api/game", { cache: "no-store" });
        const payload = (await response.json()) as ApiPayload;
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load the case.");
        }
        if (cancelled) return;

        if (payload.game) {
          setGame(payload.game);
          setSelectedSuspectId(payload.game.suspects[0]?.id ?? null);
          setChatBySuspect(restoreConversations(payload.game.gameId));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load the case.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadActiveGame();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!game) return;
    try {
      window.sessionStorage.setItem(
        `murder-paradox:chat:${game.gameId}`,
        JSON.stringify(chatBySuspect),
      );
    } catch {
      // The case still works when browser storage is unavailable.
    }
  }, [chatBySuspect, game]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [currentMessages.length, busy, selectedSuspectId]);

  async function startNewCase() {
    setBusy(true);
    setError("");
    setPendingAccusation(null);

    try {
      const response = await fetch("/api/game", {
        method: "POST",
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.game) {
        throw new Error(payload.error ?? "The case could not be opened.");
      }

      setGame(payload.game);
      setSelectedSuspectId(payload.game.suspects[0]?.id ?? null);
      setChatBySuspect(emptyConversations());
      setDraft("");
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "The case could not be opened.",
      );
    } finally {
      setBusy(false);
    }
  }

  function appendMessage(suspectId: SuspectId, message: ChatMessage) {
    setChatBySuspect((current) => ({
      ...current,
      [suspectId]: [...current[suspectId], message],
    }));
  }

  async function sendQuestion(questionText: string) {
    const question = questionText.trim();
    const suspect = selectedSuspect;

    if (!game || !suspect || !question || busy || game.isOver) return;
    if (question.length > 500) {
      setError("Questions must be 500 characters or fewer.");
      return;
    }
    if (game.questionsRemaining <= 0 || interviewLimitReached) {
      setError("There are no questions left for this witness.");
      return;
    }

    setDraft("");
    setError("");
    appendMessage(suspect.id, createMessage("user", question));
    setBusy(true);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspectId: suspect.id, question }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.answer || !payload.game) {
        throw new Error(payload.error ?? "The witness could not be reached.");
      }

      appendMessage(suspect.id, createMessage("assistant", payload.answer));
      setGame(payload.game);
    } catch (askError) {
      setError(
        askError instanceof Error
          ? askError.message
          : "The witness could not be reached.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmAccusation() {
    if (!pendingAccusation || !game || game.isOver || busy) return;

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/accuse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspectId: pendingAccusation }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.game) {
        throw new Error(payload.error ?? "The verdict could not be submitted.");
      }

      setGame(payload.game);
      setSelectedSuspectId(pendingAccusation);
      setPendingAccusation(null);
    } catch (accusationError) {
      setError(
        accusationError instanceof Error
          ? accusationError.message
          : "The verdict could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleQuestionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(draft);
  }

  const pendingSuspect = pendingAccusation
    ? game?.suspects.find((suspect) => suspect.id === pendingAccusation) ?? null
    : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-secondary">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-72 h-96 w-96 rounded-full bg-primary/10 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-36 top-[42rem] h-96 w-96 rounded-full bg-accent/5 blur-[120px]"
      />

      <header className="relative z-10 border-b border-white/[0.07] bg-ink/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="#top" className="group flex items-center gap-3 rounded-xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25 transition group-hover:bg-primary/25">
              <Fingerprint size={23} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span>
              <span className="block font-heading text-lg font-bold tracking-tight text-white">
                MURDER<span className="text-primary">/</span>PARADOX
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Casework interface
              </span>
            </span>
          </a>

          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-panel/60 px-3 py-2 text-xs text-slate-400 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_12px_#10b981]" />
            Three witnesses <span className="text-slate-600">/</span> one case
          </div>

          {game ? (
            <button
              type="button"
              onClick={() => void startNewCase()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-primary/40 hover:bg-primary/10 disabled:opacity-50 sm:px-4"
            >
              <RotateCcw size={15} aria-hidden="true" />
              <span className="hidden sm:inline">New case</span>
            </button>
          ) : (
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Case generator
            </span>
          )}
        </div>
      </header>

      {error ? (
        <div className="relative z-10 mx-auto mt-5 flex max-w-7xl items-start gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex w-full items-start gap-3 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] px-4 py-3 text-sm text-rose-100">
            <AlertTriangle className="mt-0.5 shrink-0 text-rose-300" size={17} aria-hidden="true" />
            <p className="flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-md p-1 text-rose-200/70 hover:text-white"
              aria-label="Dismiss error"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      <main id="top" className="relative z-10">
        {loading ? (
          <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-4">
            <div className="flex items-center gap-3 text-slate-400">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
              Restoring case file…
            </div>
          </div>
        ) : game ? (
          <InvestigationRoom
            game={game}
            selectedSuspect={selectedSuspect}
            selectedSuspectId={selectedSuspectId}
            onSelectSuspect={setSelectedSuspectId}
            messages={currentMessages}
            busy={busy}
            draft={draft}
            setDraft={setDraft}
            onSubmit={handleQuestionSubmit}
            onAskSuggestion={(question) => void sendQuestion(question)}
            onAccuse={(suspectId) => setPendingAccusation(suspectId)}
            bottomRef={bottomRef}
            questionCount={currentQuestionCount}
            interviewLimitReached={interviewLimitReached}
            onStartNewCase={() => void startNewCase()}
          />
        ) : (
          <LandingPage onStart={() => void startNewCase()} busy={busy} />
        )}
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-8 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span>FICTIONAL CASE FILE · MURDER PARADOX</span>
        <span className="flex items-center gap-1.5">
          <LockKeyhole size={12} aria-hidden="true" />
          Hidden roles stay on the server until the verdict.
        </span>
      </footer>

      {pendingSuspect ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingAccusation(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="verdict-title"
            className="w-full max-w-md rounded-3xl border border-white/10 bg-panel p-6 shadow-2xl shadow-black/50 sm:p-8"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Shield size={22} aria-hidden="true" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
              Final decision
            </p>
            <h2 id="verdict-title" className="mt-2 font-heading text-2xl font-bold text-white">
              Accuse {pendingSuspect.name}?
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              This closes the case and reveals the culprit and the one false witness. You cannot change your verdict afterward.
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingAccusation(null)}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.05]"
              >
                Keep investigating
              </button>
              <button
                type="button"
                onClick={() => void confirmAccusation()}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
              >
                {busy ? "Submitting…" : "Lock in verdict"}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function LandingPage({ onStart, busy }: { onStart: () => void; busy: boolean }) {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
      <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            A closed-room investigation
          </div>
          <h1 className="mt-7 font-heading text-5xl font-bold leading-[1.04] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
            Three witnesses.
            <br />
            Two truths.
            <br />
            <span className="text-primary">One lie.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
            Open a newly generated investigation, interview its three suspects, compare evidence-backed accounts, catch the one false alibi, and identify the killer.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onStart}
              disabled={busy}
              className="inline-flex items-center justify-center gap-3 rounded-xl bg-primary px-6 py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? "Opening case file…" : "Open the case file"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <span className="flex items-center justify-center gap-2 text-xs text-slate-500 sm:justify-start">
              <LockKeyhole size={14} className="text-accent" aria-hidden="true" />
              The killer is randomized for every new case.
            </span>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/[0.07] pt-6 text-xs text-slate-500">
            <span className="flex items-center gap-2"><UserRound size={14} /> 3 suspects</span>
            <span className="flex items-center gap-2"><MessageCircle size={14} /> 6 questions each</span>
            <span className="flex items-center gap-2"><Shield size={14} /> 1 final accusation</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div aria-hidden="true" className="absolute -inset-5 rounded-[2rem] bg-primary/10 blur-3xl" />
          <article className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-panel/90 shadow-[0_28px_100px_rgba(2,6,23,0.55)]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-7">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                <BookOpen size={15} className="text-primary" aria-hidden="true" />
                Case dossier
              </div>
              <span className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
                Sealed
              </span>
            </div>
            <div className="p-5 sm:p-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">20 SCENARIO FRAMEWORKS · PROCEDURALLY REMIXED</p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">A new case file awaits</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Every investigation remixes a setting, victim, cast, motive, timeline, and clues. The killer and the one false-alibi witness are randomized independently.
              </p>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <DossierStat icon={<Clock3 size={16} />} label="Timeline" value="Remixed" />
                <DossierStat icon={<MapPin size={16} />} label="Scene" value="20 frameworks" />
                <DossierStat icon={<FlaskConical size={16} />} label="Cause" value="Case-specific" />
                <DossierStat icon={<Fingerprint size={16} />} label="Witnesses" value="2 true · 1 liar" />
              </div>

              <div className="mt-6 rounded-2xl border border-white/[0.07] bg-ink/60 p-4">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.17em] text-slate-500">
                  <span>Generated evidence</span>
                  <span className="text-accent">Cast of 3</span>
                </div>
                <div className="mt-3 flex items-center gap-2" aria-hidden="true">
                  <span className="h-1.5 flex-1 rounded-full bg-slate-700" />
                  <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_16px_#10b981]" />
                  <span className="h-1.5 flex-1 rounded-full bg-slate-700" />
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  <span className="h-1.5 flex-1 rounded-full bg-slate-700" />
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-slate-600">
                  <span>New victim</span><span>Evidence trail</span><span>New verdict</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-white/[0.07] bg-white/[0.02] px-5 py-4 text-xs text-slate-500 sm:px-7">
              <Sparkles size={15} className="shrink-0 text-primary" aria-hidden="true" />
              <span>Gemini directs each interview; the server locks every fact to the case file.</span>
            </div>
          </article>
        </div>
      </section>

      <section className="mt-16 grid gap-4 border-t border-white/[0.07] pt-8 sm:grid-cols-3">
        <FeatureCard number="01" title="Read the room" text="Each witness has a distinct voice, motive, and account of the night." />
        <FeatureCard number="02" title="Compare the stories" text="Exactly two witnesses tell the truth; one repeats the same false alibi." />
        <FeatureCard number="03" title="Make the call" text="Choose a suspect when you are ready. Your verdict reveals both hidden roles." />
      </section>
    </div>
  );
}

function InvestigationRoom({
  game,
  selectedSuspect,
  selectedSuspectId,
  onSelectSuspect,
  messages,
  busy,
  draft,
  setDraft,
  onSubmit,
  onAskSuggestion,
  onAccuse,
  bottomRef,
  questionCount,
  interviewLimitReached,
  onStartNewCase,
}: {
  game: PublicGame;
  selectedSuspect: SuspectProfile | null;
  selectedSuspectId: SuspectId | null;
  onSelectSuspect: (suspectId: SuspectId) => void;
  messages: ChatMessage[];
  busy: boolean;
  draft: string;
  setDraft: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAskSuggestion: (question: string) => void;
  onAccuse: (suspectId: SuspectId) => void;
  bottomRef: { current: HTMLDivElement | null };
  questionCount: number;
  interviewLimitReached: boolean;
  onStartNewCase: () => void;
}) {
  const palette = selectedSuspect ? suspectPalette(selectedSuspect) : null;
  const remainingForWitness = game.maxQuestionsPerSuspect - questionCount;
  const disabled =
    !selectedSuspect ||
    busy ||
    game.isOver ||
    game.questionsRemaining <= 0 ||
    interviewLimitReached;
  const culprit = game.result
    ? game.suspects.find((suspect) => suspect.id === game.result?.culpritId)
    : null;
  const liar = game.result
    ? game.suspects.find((suspect) => suspect.id === game.result?.liarId)
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-7 sm:px-6 sm:pt-10 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Active investigation
            <span className="text-slate-600">/</span>
            {game.caseFile.caseNumber}
          </div>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {game.caseFile.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Interview each witness. Their roles remain sealed until you submit your verdict.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-xl border border-white/10 bg-panel/70 px-3 py-2 text-xs text-slate-400 sm:self-auto">
          <MessageCircle size={14} className="text-primary" aria-hidden="true" />
          <span>{game.questionsRemaining} of {game.maxQuestions} questions remaining</span>
        </div>
      </div>

      {game.result && culprit && liar ? (
        <section className="mb-6 overflow-hidden rounded-3xl border border-accent/25 bg-accent/[0.07] p-5 sm:p-7" aria-live="polite">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <BadgeCheck size={24} aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
                  {game.result.correct ? "Case solved" : "Verdict recorded"}
                </p>
                <h2 className="mt-1 font-heading text-2xl font-bold text-white">
                  {game.result.correct ? "Your deduction was right." : "The evidence points elsewhere."}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  <span className="font-semibold text-white">{culprit.name}</span> killed {game.caseFile.victim}. {liar.name} was the one witness assigned to the false alibi.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onStartNewCase}
              disabled={busy}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-ink transition hover:bg-emerald-300 disabled:opacity-50"
            >
              Play another case <RotateCcw size={15} aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[350px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="rounded-3xl border border-white/[0.08] bg-panel/85 p-5 shadow-xl shadow-black/10 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                <BookOpen size={14} className="text-primary" aria-hidden="true" />
                Case dossier
              </div>
              <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {game.caseFile.caseNumber}
              </span>
            </div>
            <p className="mt-5 font-heading text-2xl font-bold text-white">{game.caseFile.title}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">{game.caseFile.summary}</p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <DossierStat icon={<Clock3 size={15} />} label="Time" value={game.caseFile.timeOfDeath} compact />
              <DossierStat icon={<MapPin size={15} />} label="Location" value={game.caseFile.location} compact />
              <DossierStat icon={<FlaskConical size={15} />} label="Cause" value={game.caseFile.cause} compact />
              <DossierStat icon={<UserRound size={15} />} label="Victim" value={game.caseFile.victim} compact />
            </div>

            <div className="mt-5 border-t border-white/[0.07] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Evidence on record</p>
              <ul className="mt-3 space-y-3">
                {game.caseFile.evidence.map((item) => (
                  <li key={item} className="flex gap-2.5 text-xs leading-5 text-slate-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-3xl border border-white/[0.08] bg-panel/85 p-5 shadow-xl shadow-black/10 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">People of interest</p>
                <h2 className="mt-1 font-heading text-lg font-bold text-white">Choose a witness</h2>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Fingerprint size={18} aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-2" role="group" aria-label="Select a suspect to interview">
              {game.suspects.map((suspect) => {
                const suspectPalette = suspectPaletteFor(suspect);
                const active = selectedSuspectId === suspect.id;
                const used = game.questionsBySuspect[suspect.id];

                return (
                  <button
                    key={suspect.id}
                    type="button"
                    onClick={() => onSelectSuspect(suspect.id)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${active ? suspectPalette.active : "border-white/[0.07] bg-ink/30 hover:border-white/15 hover:bg-white/[0.03]"}`}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-heading text-xs font-bold ring-1 ${suspectPalette.avatar}`}>
                      {suspect.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{suspect.name}</span>
                      <span className={`mt-0.5 block text-[10px] font-bold uppercase tracking-[0.14em] ${suspectPalette.label}`}>
                        {suspect.title}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-[10px] tabular-nums text-slate-500">{used}/{game.maxQuestionsPerSuspect}</span>
                      <ChevronRight size={15} className={active ? "text-primary" : "text-slate-600"} aria-hidden="true" />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/[0.06] p-3.5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-200">
                <LockKeyhole size={13} aria-hidden="true" />
                Roles sealed
              </div>
              <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
                The game has two truthful witnesses and one consistent liar. Neither role is sent to your browser before the verdict.
              </p>
            </div>
          </section>
        </aside>

        <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-panel/85 shadow-xl shadow-black/10">
          {selectedSuspect && palette ? (
            <>
              <div className="flex flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-heading text-sm font-bold ring-1 ${palette.avatar}`}>
                    {selectedSuspect.initials}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-heading text-lg font-bold text-white">{selectedSuspect.name}</h2>
                      <span className={`rounded-full bg-white/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.13em] ${palette.label}`}>
                        {selectedSuspect.title}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Interview transcript · {game.caseFile.caseNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start rounded-xl border border-white/[0.08] bg-ink/50 px-3 py-2 text-xs text-slate-400 sm:self-auto">
                  <MessageCircle size={14} className="text-primary" aria-hidden="true" />
                  {remainingForWitness} question{remainingForWitness === 1 ? "" : "s"} left
                </div>
              </div>

              <div className="flex items-center gap-3 border-b border-white/[0.05] bg-ink/25 px-4 py-3 sm:px-6">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles size={14} aria-hidden="true" />
                </div>
                <p className="text-[11px] leading-5 text-slate-400">
                  {selectedSuspect.summary}
                </p>
              </div>

              <div className="chat-scrollbar flex h-[min(52vh,500px)] min-h-[340px] flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6" aria-live="polite" aria-label={`${selectedSuspect.name} interview transcript`}>
                {messages.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                    <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl font-heading font-bold ring-1 ${palette.avatar}`}>
                      {selectedSuspect.initials}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Witness is ready</p>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">“{OPENING_LINES[selectedSuspect.id]}”</p>
                    <p className="mt-3 text-xs text-slate-600">Ask a question below to begin the interview.</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {message.role === "assistant" ? (
                        <div className={`mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[9px] font-bold ring-1 ${palette.avatar}`} aria-hidden="true">
                          {selectedSuspect.initials}
                        </div>
                      ) : null}
                      <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-primary text-white" : "rounded-tl-md border border-white/[0.07] bg-ink/65 text-slate-200"}`}>
                        {message.text}
                      </div>
                    </div>
                  ))
                )}
                {busy && game && !game.isOver ? (
                  <div className="flex items-center gap-2 pl-10 text-xs text-slate-500" role="status">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    {selectedSuspect.name.split(" ")[0]} is considering the question…
                  </div>
                ) : null}
                <div ref={bottomRef} />
              </div>

              {!game.isOver && !interviewLimitReached && game.questionsRemaining > 0 ? (
                <div className="border-t border-white/[0.06] px-4 pt-4 sm:px-6">
                  <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600">Suggested questions</p>
                  <div className="flex gap-2 overflow-x-auto pb-3">
                    {suggestedQuestions(game.caseFile).map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => onAskSuggestion(question)}
                        disabled={busy}
                        className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[11px] text-slate-400 transition hover:border-primary/30 hover:bg-primary/10 hover:text-indigo-100 disabled:opacity-40"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <form onSubmit={onSubmit} className="border-t border-white/[0.07] bg-ink/35 p-4 sm:p-5">
                <label htmlFor="interview-question" className="sr-only">Ask {selectedSuspect.name} a question</label>
                <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-ink px-2 py-2 transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
                  <textarea
                    id="interview-question"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        if (draft.trim() && !disabled) {
                          void onAskSuggestion(draft.trim());
                        }
                      }
                    }}
                    rows={1}
                    maxLength={500}
                    placeholder={game.isOver ? "This case is closed." : `Ask ${selectedSuspect.name.split(" ")[0]} about the case…`}
                    disabled={disabled}
                    className="max-h-32 min-h-11 flex-1 resize-y bg-transparent px-3 py-2.5 text-sm leading-5 text-white outline-none placeholder:text-slate-600 disabled:cursor-not-allowed"
                  />
                  <button
                    type="submit"
                    disabled={disabled || !draft.trim()}
                    aria-label="Send question"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary-dark disabled:bg-slate-700 disabled:text-slate-500"
                  >
                    <Send size={17} aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-2 flex justify-between gap-3 px-1 text-[10px] text-slate-600">
                  <span>Enter to send · Shift + Enter for a new line</span>
                  <span>{draft.length}/500</span>
                </div>
              </form>

              {!game.isOver ? (
                <div className="flex flex-col gap-3 border-t border-white/[0.06] bg-white/[0.015] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="text-xs text-slate-500">Ready to name the killer? Your verdict reveals both hidden roles.</p>
                  <button
                    type="button"
                    onClick={() => onAccuse(selectedSuspect.id)}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-bold text-indigo-100 transition hover:bg-primary/20 disabled:opacity-50"
                  >
                    Accuse {selectedSuspect.name.split(" ")[0]}
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="p-8 text-sm text-slate-400">Select a witness to open an interview.</div>
          )}
        </section>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span className="flex items-center gap-2"><Shield size={14} className="text-accent" aria-hidden="true" /> Private game state is encrypted in an HttpOnly cookie.</span>
        <span>{game.questionsUsed} / {game.maxQuestions} interviews used</span>
      </div>
    </div>
  );
}

function suspectPaletteFor(suspect: SuspectProfile): PaletteClasses {
  return PALETTE_CLASSES[suspect.palette];
}

function DossierStat({
  icon,
  label,
  value,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-ink/40 ${compact ? "p-2.5" : "p-3.5"}`}>
      <div className="flex items-center gap-1.5 text-primary" aria-hidden="true">{icon}<span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span></div>
      <p className={`mt-1.5 truncate font-semibold text-slate-200 ${compact ? "text-[11px]" : "text-sm"}`}>{value}</p>
    </div>
  );
}

function FeatureCard({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <article className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
      <p className="font-heading text-xs font-bold tracking-[0.18em] text-primary">{number}</p>
      <h2 className="mt-3 font-heading text-lg font-bold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </article>
  );
}
