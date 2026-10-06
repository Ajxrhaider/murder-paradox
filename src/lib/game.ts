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
export const SCENARIO_TEMPLATE_COUNT = 20;
export const ROLE_ARCHETYPE_COUNT = 24;

interface ScenarioTemplate {
  title: string;
  venue: string;
  scene: string;
  cause: string;
  handledItem: string;
  accessPoint: string;
  eventText: string;
  confession: string;
  findings: string[];
  traces: string[];
}

interface RoleArchetype {
  title: string;
  workArea: string;
  summary: string;
  motives: string[];
}

interface TimeWindow {
  start: string;
  event: string;
  end: string;
  death: string;
}

const STYLES: Record<SuspectId, { palette: SuspectProfile["palette"] }> = {
  mara: { palette: "emerald" },
  elias: { palette: "indigo" },
  celeste: { palette: "amber" },
};

const FIRST_NAMES = [
  "Avery", "Mara", "Elias", "Rowan", "Simone", "Jun", "Talia", "Devon",
  "Nia", "Soren", "Amara", "Felix", "Priya", "Theo", "Camille", "Idris",
  "Lena", "Rafael", "Nadia", "Gabriel", "Imani", "Kieran", "Sol", "Mina",
  "Dara", "Noor", "Owen", "Sasha", "Leonie", "Victor", "Anika", "Miles",
  "Yara", "Caleb", "Hana", "Julian", "Rhea", "Bastien", "Cleo", "Malik",
  "Freya", "Emmett", "Esme", "Tomas", "Zara", "Luca", "Asha", "Niko",
];

const LAST_NAMES = [
  "Quinn", "Ward", "Voss", "Vale", "Cross", "Mori", "Bennett", "Okafor",
  "Hale", "Sato", "Reed", "Mercer", "Ibrahim", "Frost", "Kade", "Lowe",
  "Navarro", "Park", "Ellis", "Sloan", "Wren", "Solberg", "Morrow", "Bell",
  "Adebayo", "Marin", "Chen", "Hughes", "Rossi", "Doyle", "Khan", "Byrne",
  "Petrov", "Clarke", "Mensah", "Rivers", "Shaw", "Bishop", "Tanaka", "North",
  "Okoye", "Linden", "Arden", "Moreau", "Sterling", "Ives", "Kovac", "Wells",
];

const VICTIM_TITLES = ["Dr.", "Professor", "Director", "Judge", "Captain", "Countess"];

const ROLE_ARCHETYPES: RoleArchetype[] = [
  {
    title: "Head Botanist",
    workArea: "the East Greenhouse",
    summary: "Knows which plants thrive in every corner of the estate.",
    motives: [
      "{victim} planned to close the rare-plant programme I had spent years building.",
      "{victim} intended to sell the collection I had promised to protect.",
    ],
  },
  {
    title: "Security Chief",
    workArea: "the Security Booth",
    summary: "Controlled the building's keys, cameras, and night access logs.",
    motives: [
      "{victim} was preparing to report the gap I concealed in the security audit.",
      "{victim} had discovered I copied a restricted access key.",
    ],
  },
  {
    title: "Art Conservator",
    workArea: "the Restoration Studio",
    summary: "Can identify a damaged varnish or pigment at a glance.",
    motives: [
      "{victim} planned to sell the portrait I had spent years restoring.",
      "{victim} intended to credit someone else for my restoration work.",
    ],
  },
  {
    title: "Executive Chef",
    workArea: "the Service Kitchen",
    summary: "Ran the kitchens and knew every dish served at the venue.",
    motives: [
      "{victim} planned to cancel the contract that kept my kitchen open.",
      "{victim} blamed me for a failed banquet and threatened my career.",
    ],
  },
  {
    title: "Chief Archivist",
    workArea: "the Map Archive",
    summary: "Could find a missing record in a room of locked cabinets.",
    motives: [
      "{victim} planned to discard the family records I had spent years cataloguing.",
      "{victim} was about to expose the document I had quietly removed.",
    ],
  },
  {
    title: "Master Electrician",
    workArea: "the Generator Room",
    summary: "Maintained the venue's lights, alarms, and power systems.",
    motives: [
      "{victim} was going to report the maintenance work I had falsified.",
      "{victim} refused to pay for the repairs that kept the venue running.",
    ],
  },
  {
    title: "Stage Manager",
    workArea: "the Backstage Office",
    summary: "Knew every rope, cue, and hidden passage behind the stage.",
    motives: [
      "{victim} had cancelled the production I had spent a year preparing.",
      "{victim} planned to replace me just before opening night.",
    ],
  },
  {
    title: "Gallery Curator",
    workArea: "the West Gallery",
    summary: "Selected the exhibits and knew the story behind each piece.",
    motives: [
      "{victim} intended to change the attribution on the work that made my career.",
      "{victim} planned to remove the exhibit I had fought to keep.",
    ],
  },
  {
    title: "Resident Physician",
    workArea: "the First-Aid Suite",
    summary: "Was responsible for the venue's clinic and emergency supplies.",
    motives: [
      "{victim} knew about the prescription record I had altered.",
      "{victim} threatened to tell the board I had ignored a safety report.",
    ],
  },
  {
    title: "Groundskeeper",
    workArea: "the Walled Garden",
    summary: "Knew the grounds, service paths, and gates better than anyone.",
    motives: [
      "{victim} planned to sell the land my family had tended for generations.",
      "{victim} was going to evict my family from the keeper's cottage.",
    ],
  },
  {
    title: "Flight Operations Chief",
    workArea: "the West Hangar",
    summary: "Managed the aircraft schedule and the hangar's inspection records.",
    motives: [
      "{victim} discovered the flight entry I had removed from the log.",
      "{victim} planned to ground the aircraft that supported my work.",
    ],
  },
  {
    title: "Locksmith",
    workArea: "the Key Workshop",
    summary: "Made and repaired the locks that protect the private rooms.",
    motives: [
      "{victim} had accused me of making an unauthorized copy of a master key.",
      "{victim} planned to cancel the contract that kept my workshop open.",
    ],
  },
  {
    title: "Cellar Master",
    workArea: "the Wine Cellar",
    summary: "Kept the cellar inventory and knew every bottle in the collection.",
    motives: [
      "{victim} intended to auction the collection I had built bottle by bottle.",
      "{victim} discovered the vintage I had quietly replaced.",
    ],
  },
  {
    title: "Aquarium Diver",
    workArea: "the Dive Locker",
    summary: "Maintained the tanks and checked the life-support equipment.",
    motives: [
      "{victim} had cut the project that I had spent years developing.",
      "{victim} planned to blame me for a breach in the tank-safety report.",
    ],
  },
  {
    title: "Clockmaker",
    workArea: "the Clock Workshop",
    summary: "Restored precision mechanisms and worked by sound as much as sight.",
    motives: [
      "{victim} claimed the design I had spent years perfecting as their own.",
      "{victim} planned to dismantle the clock I had promised to preserve.",
    ],
  },
  {
    title: "Laboratory Technician",
    workArea: "the Research Lab",
    summary: "Prepared samples and maintained the lab's controlled equipment.",
    motives: [
      "{victim} threatened to expose the results I had changed in the report.",
      "{victim} planned to end the research project that defined my career.",
    ],
  },
  {
    title: "Estate Caretaker",
    workArea: "the North Lodge",
    summary: "Looked after the building and knew which doors were rarely used.",
    motives: [
      "{victim} planned to dismiss me after decades of service.",
      "{victim} was going to sell the lodge I had been promised in the will.",
    ],
  },
  {
    title: "Surveyor",
    workArea: "the Survey Office",
    summary: "Measured the site and kept the plans for its hidden passages.",
    motives: [
      "{victim} discovered the boundary change I had made on the estate plan.",
      "{victim} planned to block the development that funded my firm.",
    ],
  },
  {
    title: "Museum Guide",
    workArea: "the Visitor Hall",
    summary: "Knew the public rooms, the tour route, and what visitors noticed.",
    motives: [
      "{victim} blamed me for the private tour that ended in scandal.",
      "{victim} planned to replace my tour with a script that erased my work.",
    ],
  },
  {
    title: "Mechanical Engineer",
    workArea: "the Machine Shop",
    summary: "Maintained the moving parts, lifts, and service machinery.",
    motives: [
      "{victim} was going to report the safety test I had skipped.",
      "{victim} claimed credit for the mechanism I designed.",
    ],
  },
  {
    title: "Composer in Residence",
    workArea: "the Music Room",
    summary: "Spent long hours composing and could recognize every sound in the building.",
    motives: [
      "{victim} had withdrawn the commission that kept my music alive.",
      "{victim} planned to publish my unfinished work under another name.",
    ],
  },
  {
    title: "Harbor Master",
    workArea: "the Harbor Office",
    summary: "Managed the moorings, keys, and arrival log at the waterfront.",
    motives: [
      "{victim} planned to close the harbor where my family had worked for years.",
      "{victim} discovered the vessel I had let leave without inspection.",
    ],
  },
  {
    title: "Conservatory Director",
    workArea: "the Rehearsal Room",
    summary: "Oversaw rehearsals and knew every performer and stage entrance.",
    motives: [
      "{victim} threatened to cancel the scholarship programme I had built.",
      "{victim} planned to replace the ensemble before its most important performance.",
    ],
  },
  {
    title: "Building Inspector",
    workArea: "the Inspection Office",
    summary: "Checked the venue's structural reports and signed off on repairs.",
    motives: [
      "{victim} had found the inspection certificate I signed without a visit.",
      "{victim} planned to expose the repair estimate I had inflated.",
    ],
  },
];

const CASE_SCENARIOS: ScenarioTemplate[] = [
  {
    title: "The Glasshouse at Midnight",
    venue: "Bellwether Museum",
    scene: "the Glasshouse",
    cause: "aconite poisoning in spiced tea",
    handledItem: "the silver tea tray",
    accessPoint: "north service door",
    eventText: "carried the tea tray through the north service door",
    confession: "I mixed aconite into {victim}’s tea and delivered the cup to the Glasshouse.",
    findings: ["Toxicology found aconite in the remaining tea.", "The last cup served to the victim contained aconite."],
    traces: ["A pale blue pollen smear marked the saucer.", "A silver polish trace was found on the cup handle."],
  },
  {
    title: "The Bell Tower Fall",
    venue: "Harrowgate Hotel",
    scene: "the Bell Tower",
    cause: "a fatal fall after the tower rail was loosened",
    handledItem: "the brass wrench",
    accessPoint: "west stairwell",
    eventText: "carried a brass wrench up the west stairwell",
    confession: "I loosened the tower rail with the brass wrench before {victim} reached the landing.",
    findings: ["Fresh tool marks showed that the rail had been loosened recently.", "The rail's fasteners were missing from the tower landing."],
    traces: ["Brass filings were found on the landing.", "A short thread of dark wool caught on the railing."],
  },
  {
    title: "The Deep Tank Incident",
    venue: "Northstar Aquarium",
    scene: "the Deep Tank",
    cause: "life-support failure after a backup air-line was cut",
    handledItem: "the backup air-line panel",
    accessPoint: "south catwalk",
    eventText: "opened the air-line panel by the south catwalk",
    confession: "I cut the backup air line before {victim} entered the Deep Tank.",
    findings: ["The tank's backup air line had a clean cut through its outer braid.", "The tank alarm had been silenced just before the incident."],
    traces: ["A strip of orange maintenance tape lay beside the panel.", "A damp work-glove print marked the access hatch."],
  },
  {
    title: "Last Light at the Observatory",
    venue: "Meridian Observatory",
    scene: "the Observatory Dome",
    cause: "carbon-monoxide poisoning after the heater vent was blocked",
    handledItem: "the heater maintenance key",
    accessPoint: "east dome vestibule",
    eventText: "carried a heater key through the east dome vestibule",
    confession: "I blocked the heater vent and disabled its alarm before {victim} arrived at the dome.",
    findings: ["The observatory monitor recorded a dangerous rise in carbon monoxide.", "The heater alarm had been disabled before the dome was sealed."],
    traces: ["A strip of blue insulation was caught in the vent.", "A warm brass key was found near the control panel."],
  },
  {
    title: "The Restoration Room",
    venue: "Palatine Art Museum",
    scene: "the Restoration Studio",
    cause: "toxic-solvent exposure after the ventilation tray was contaminated",
    handledItem: "the solvent canister",
    accessPoint: "east loading entrance",
    eventText: "carried a solvent canister past the east loading entrance",
    confession: "I poured a toxic solvent into the studio's ventilation tray before {victim} began work.",
    findings: ["The studio ventilation tray contained a solvent not used in the restoration.", "A chemical analysis identified a toxic solvent in the work area."],
    traces: ["A green paint fleck marked the canister lid.", "A narrow boot print crossed the dust by the vent."],
  },
  {
    title: "The Winter Banquet",
    venue: "Frostmere Hall",
    scene: "the Winter Banquet Hall",
    cause: "poisoning after a dessert was deliberately tainted",
    handledItem: "the dessert platter",
    accessPoint: "servants' gallery door",
    eventText: "carried the dessert platter through the servants' gallery door",
    confession: "I added a fatal plant extract to {victim}’s dessert and served it at the banquet.",
    findings: ["A plant toxin was found in the victim's untouched dessert garnish.", "Only one serving on the dessert platter contained the toxin."],
    traces: ["A sugared violet petal lay beneath the serving dish.", "A small streak of red icing marked the gallery latch."],
  },
  {
    title: "The Last Run on Track Seven",
    venue: "Crownline Railway Museum",
    scene: "the Rail-Car Workshop",
    cause: "a fatal collision after a maintenance trolley brake was sabotaged",
    handledItem: "the trolley brake lever",
    accessPoint: "track-seven service gate",
    eventText: "released the trolley brake beside the track-seven service gate",
    confession: "I disabled the maintenance trolley brake and sent it toward {victim} on the service track.",
    findings: ["The trolley brake linkage had been deliberately pinned open.", "A test showed the trolley could not have rolled without the brake release."],
    traces: ["A clipped copper wire was found under the brake lever.", "A fresh grease smear crossed the service-gate latch."],
  },
  {
    title: "The Harbor Bell",
    venue: "Greyhaven Boathouse",
    scene: "the Boathouse Slipway",
    cause: "drowning after the victim's launch was set adrift",
    handledItem: "the mooring knife",
    accessPoint: "harbor-side winch gate",
    eventText: "carried a mooring knife through the harbor-side winch gate",
    confession: "I cut {victim}’s launch free from its mooring and watched it drift beyond the harbor lights.",
    findings: ["The launch's mooring line had been cut with a sharp blade.", "The harbor log showed no authorized launch at that hour."],
    traces: ["A blue cord fiber was caught on the winch.", "A wet crescent-shaped print marked the slipway steps."],
  },
  {
    title: "The Glass Bridge",
    venue: "Asterion Sky Gallery",
    scene: "the Glass Bridge",
    cause: "a fatal fall after two bridge fasteners were removed",
    handledItem: "the bridge maintenance key",
    accessPoint: "north bridge landing",
    eventText: "carried a maintenance key onto the north bridge landing",
    confession: "I removed two safety fasteners from the bridge before {victim} crossed it.",
    findings: ["Two structural fasteners were missing from the bridge rail.", "The break edges were too clean to have failed naturally."],
    traces: ["A crescent of yellow sealing wax was found beside a bolt.", "Fine glass dust marked the nearby maintenance case."],
  },
  {
    title: "The Clinic After Hours",
    venue: "St. Orla's Private Clinic",
    scene: "the First-Aid Suite",
    cause: "a fatal medication error after a labeled vial was switched",
    handledItem: "the medication case",
    accessPoint: "west clinic entrance",
    eventText: "carried a medication case through the west clinic entrance",
    confession: "I switched {victim}’s labeled vial with the stronger medication in the clinic case.",
    findings: ["The vial label did not match the medicine inside.", "The medication record showed an unauthorized change."],
    traces: ["A strip of lilac label paper was found under the cabinet.", "A small smear of sealing adhesive marked the vial."],
  },
  {
    title: "The Snow Lodge",
    venue: "Whitecap Mountain Lodge",
    scene: "the Snow Lodge Study",
    cause: "carbon-monoxide poisoning after the chimney flue was blocked",
    handledItem: "the iron hearth tool",
    accessPoint: "rear snow porch",
    eventText: "carried an iron hearth tool through the rear snow porch",
    confession: "I blocked the study's chimney flue while {victim} was inside and left the room sealed.",
    findings: ["The study's carbon-monoxide alarm had been covered.", "The chimney flue was blocked from the inside of the service passage."],
    traces: ["Soot on the hearth tool was disturbed recently.", "A snow print with a split heel crossed the porch."],
  },
  {
    title: "The Theatre Counterweight",
    venue: "Larkspur Grand Theatre",
    scene: "the Main Stage",
    cause: "a fatal stage accident after the counterweight rig was released",
    handledItem: "the counterweight release pin",
    accessPoint: "backstage fly-gallery stairs",
    eventText: "pulled the counterweight release backstage",
    confession: "I pulled the counterweight release while {victim} stood beneath the stage rig.",
    findings: ["The release pin showed fresh tool marks.", "The stage rig had been checked and secured earlier that evening."],
    traces: ["A black costume thread caught on the fly-gallery rail.", "A chalk handprint marked the release housing."],
  },
  {
    title: "The Sealed Laboratory",
    venue: "Helix Research Institute",
    scene: "the Clean Laboratory",
    cause: "toxic exposure after a sealed reagent was introduced into the air system",
    handledItem: "the reagent flask",
    accessPoint: "east laboratory airlock",
    eventText: "carried a sealed reagent flask through the east laboratory airlock",
    confession: "I introduced the toxic reagent into the lab's air system before {victim} entered.",
    findings: ["A volatile reagent was detected in the lab ventilation filter.", "The airlock's seal had been opened during the restricted period."],
    traces: ["A torn strip of silver lab tape lay by the airlock.", "A glass chip matched a flask from the reagent cabinet."],
  },
  {
    title: "The Archive Vault",
    venue: "The Old Meridian Library",
    scene: "the Archive Vault",
    cause: "a fatal loss of air after the vault vent was sealed",
    handledItem: "the vault ventilation key",
    accessPoint: "lower archive passage",
    eventText: "carried a ventilation key through the lower archive passage",
    confession: "I sealed the vault's air vent while {victim} was cataloguing inside.",
    findings: ["The vault ventilation grille had been sealed from the service passage.", "The emergency-release lever was held in place by a small metal wedge."],
    traces: ["A fragment of red book cloth was caught in the grille.", "A wedge of polished brass lay beneath the vent."],
  },
  {
    title: "The Clockmaker's Gallery",
    venue: "Ardenhorst Clock Museum",
    scene: "the Clockmaker's Gallery",
    cause: "a fatal strike after the master mechanism was released",
    handledItem: "the master winding key",
    accessPoint: "east mechanism stair",
    eventText: "wound the master spring in the east mechanism stair",
    confession: "I released the master mechanism while {victim} was beneath the display clock.",
    findings: ["The master mechanism had been wound past its marked safety point.", "A safety catch had been removed from the display clock."],
    traces: ["A brass shaving lay beside the mechanism housing.", "A dab of dark machine oil marked the stair rail."],
  },
  {
    title: "The Lighthouse Stair",
    venue: "Cape Rowan Light Station",
    scene: "the Lighthouse Lantern Room",
    cause: "a fatal fall after the lantern-room stair latch was removed",
    handledItem: "the stair-latch screwdriver",
    accessPoint: "seaward stair entrance",
    eventText: "carried a screwdriver through the seaward stair entrance",
    confession: "I removed the lantern stair latch before {victim} climbed to the light.",
    findings: ["The lantern-room latch was missing its retaining screw.", "The stair door could not have opened without the latch being removed."],
    traces: ["A smear of white lighthouse paint marked the screwdriver.", "A short length of signal-cord was found near the latch."],
  },
  {
    title: "The Winter Garden Tincture",
    venue: "Morrowglass Conservatory",
    scene: "the Winter Garden",
    cause: "poisoning after a botanical tincture was added to a cordial",
    handledItem: "the tincture bottle",
    accessPoint: "glasshouse potting entrance",
    eventText: "carried a tincture bottle through the potting entrance",
    confession: "I added a poisonous tincture to {victim}’s cordial and returned the bottle to the potting room.",
    findings: ["A rare plant toxin was detected in the cordial glass.", "The tincture bottle's seal had been broken that evening."],
    traces: ["A crushed white blossom lay beside the cordial tray.", "A smear of damp soil marked the bottle's label."],
  },
  {
    title: "The Thermal Suite",
    venue: "Blueglass Spa and Baths",
    scene: "the Thermal Suite",
    cause: "a fatal steam-room incident after the safety timer was disabled",
    handledItem: "the timer override key",
    accessPoint: "service corridor C",
    eventText: "carried a timer override key down service corridor C",
    confession: "I disabled the thermal suite's safety timer while {victim} was inside.",
    findings: ["The suite timer had been held past its automatic shutoff point.", "The emergency release had been manually disabled."],
    traces: ["A strip of blue towel fiber was caught in the override panel.", "A damp key print marked the service-corridor handle."],
  },
  {
    title: "The Suspension Bridge",
    venue: "Rookery Gorge Reserve",
    scene: "the Old Suspension Bridge",
    cause: "a fatal fall after a support cable was deliberately weakened",
    handledItem: "the cable hook",
    accessPoint: "west ravine footpath",
    eventText: "carried a cable hook along the west ravine footpath",
    confession: "I weakened the bridge's support cable before {victim} crossed the gorge.",
    findings: ["A support cable showed deliberate scoring beneath its outer wrap.", "The bridge inspection record had been altered that afternoon."],
    traces: ["A strand of crimson rope was caught on the west post.", "Fresh metal filings lay on the footpath."],
  },
  {
    title: "The Mountain Weather Station",
    venue: "Kestrel Peak Research Station",
    scene: "the Weather Station Lab",
    cause: "a fatal gas exposure after the sensor alarm was disconnected",
    handledItem: "the sensor bypass lead",
    accessPoint: "north lab vestibule",
    eventText: "carried a sensor bypass lead through the north lab vestibule",
    confession: "I disconnected the gas sensor alarm before {victim} began the overnight readings.",
    findings: ["The gas sensor had been bypassed before the lab was locked.", "The concentration log stopped updating just before the incident."],
    traces: ["A clipped blue wire lay beneath the console.", "A frost mark covered one side of the vestibule latch."],
  },
];

const TIME_WINDOWS: TimeWindow[] = [
  { start: "7:40 PM", event: "7:47 PM", end: "7:54 PM", death: "8:00 PM" },
  { start: "8:05 PM", event: "8:12 PM", end: "8:19 PM", death: "8:25 PM" },
  { start: "8:20 PM", event: "8:27 PM", end: "8:34 PM", death: "8:40 PM" },
  { start: "8:35 PM", event: "8:42 PM", end: "8:49 PM", death: "8:55 PM" },
  { start: "8:50 PM", event: "8:57 PM", end: "9:04 PM", death: "9:10 PM" },
  { start: "9:05 PM", event: "9:12 PM", end: "9:19 PM", death: "9:25 PM" },
  { start: "9:20 PM", event: "9:27 PM", end: "9:34 PM", death: "9:40 PM" },
  { start: "9:35 PM", event: "9:42 PM", end: "9:49 PM", death: "9:55 PM" },
  { start: "9:50 PM", event: "9:57 PM", end: "10:04 PM", death: "10:10 PM" },
  { start: "10:05 PM", event: "10:12 PM", end: "10:19 PM", death: "10:25 PM" },
  { start: "10:20 PM", event: "10:27 PM", end: "10:34 PM", death: "10:40 PM" },
  { start: "10:35 PM", event: "10:42 PM", end: "10:49 PM", death: "10:55 PM" },
];

const FALSE_ALIBI_LOCATIONS = [
  "the West Arcade",
  "the Map Archive",
  "the Staff Kitchen",
  "the Music Gallery",
  "the Loading Court",
  "the South Cloister",
  "the Old Ticket Office",
  "the River Walk",
  "the North Gallery",
  "the Glass Passage",
  "the Coach Yard",
  "the Lantern Room",
  "the Lower Workshop",
  "the East Foyer",
  "the Courtyard",
  "the Reading Room",
  "the Laundry Passage",
  "the Garden Gate",
];

const STAGE_DIRECTIONS: Record<SuspectId, Record<WitnessTone, string>> = {
  mara: {
    composed: "brushes a fleck of dust from their sleeve",
    guarded: "watches you over folded arms",
    nervous: "rubs their palms against their coat",
    sharp: "answers in a clipped, precise voice",
  },
  elias: {
    composed: "gives a measured nod",
    guarded: "keeps their expression carefully blank",
    nervous: "glances toward the silent monitor",
    sharp: "answers with firm precision",
  },
  celeste: {
    composed: "squares the edge of their case notes",
    guarded: "studies you without blinking",
    nervous: "steadies a hand on the table",
    sharp: "answers with cool precision",
  },
};

function pick<T>(items: readonly T[]): T {
  if (items.length === 0) throw new Error("Cannot choose from an empty list.");
  return items[randomInt(items.length)];
}

function pickUnique<T>(items: readonly T[], count: number): T[] {
  if (count > items.length) throw new Error("Not enough unique choices.");
  const pool = [...items];
  const chosen: T[] = [];

  while (chosen.length < count) {
    chosen.push(pool.splice(randomInt(pool.length), 1)[0]);
  }

  return chosen;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function uniquePersonName(used: Set<string>): string {
  for (let attempt = 0; attempt < FIRST_NAMES.length * LAST_NAMES.length; attempt += 1) {
    const fullName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    if (!used.has(fullName)) {
      used.add(fullName);
      return fullName;
    }
  }

  throw new Error("Name pool exhausted.");
}

function makeSuspects(usedNames: Set<string>): SuspectProfile[] {
  const roles = pickUnique(ROLE_ARCHETYPES, SUSPECT_IDS.length);

  return SUSPECT_IDS.map((id, index) => {
    const role = roles[index];
    const name = uniquePersonName(usedNames);

    return {
      id,
      name,
      title: role.title,
      initials: initials(name),
      palette: STYLES[id].palette,
      workArea: role.workArea,
      summary: role.summary,
    };
  });
}

function expandVictim(template: string, victim: string): string {
  return template.replaceAll("{victim}", victim);
}

function makeTruthfulClaims(
  suspect: SuspectProfile,
  role: RoleArchetype,
  isKiller: boolean,
  killerName: string,
  victim: string,
  scenario: ScenarioTemplate,
  time: TimeWindow,
): WitnessClaim[] {
  const timeline = isKiller
    ? `I was at ${scenario.scene}, ${scenario.venue}, at ${time.event}.`
    : `I was in ${suspect.workArea} from ${time.start} to ${time.end}.`;

  const action = isKiller
    ? expandVictim(scenario.confession, victim)
    : `I did not enter ${scenario.scene} from ${time.start} to ${time.end} or handle ${scenario.handledItem}.`;

  const motive = expandVictim(pick(role.motives), victim);
  const observation = isKiller
    ? `I ${scenario.eventText} at ${time.event}.`
    : `I saw ${killerName} ${scenario.eventText} at ${time.event}.`;

  return [
    { id: "timeline", topic: "timeline", text: timeline },
    { id: "motive", topic: "motive", text: motive },
    { id: "action", topic: "action", text: action },
    { id: "observation", topic: "observation", text: observation },
  ];
}

function makeFalseClaim(
  actualLocation: string,
  suspects: SuspectProfile[],
  scene: string,
  time: TimeWindow,
): WitnessClaim[] {
  const possibleLocations = [
    ...suspects.map((suspect) => suspect.workArea),
    ...FALSE_ALIBI_LOCATIONS,
  ];
  const alternatives = [...new Set(possibleLocations)].filter(
    (location) => location !== actualLocation && location !== scene,
  );
  const falseLocation = pick(alternatives);

  return [
    {
      id: "timeline",
      topic: "timeline",
      text: `I was in ${falseLocation} from ${time.start} to ${time.end}.`,
    },
  ];
}

export function isSuspectId(value: unknown): value is SuspectId {
  return typeof value === "string" && SUSPECT_IDS.some((id) => id === value);
}

export function createGame(): GameState {
  if (
    CASE_SCENARIOS.length !== SCENARIO_TEMPLATE_COUNT ||
    ROLE_ARCHETYPES.length !== ROLE_ARCHETYPE_COUNT
  ) {
    throw new Error("Generator pool count does not match its declared size.");
  }

  const id = randomUUID();
  const createdAt = Date.now();
  const killerId = pick(SUSPECT_IDS);
  const liarId = pick(SUSPECT_IDS);
  const scenario = pick(CASE_SCENARIOS);
  const time = pick(TIME_WINDOWS);
  const usedNames = new Set<string>();
  const victimName = uniquePersonName(usedNames);
  const victim = `${pick(VICTIM_TITLES)} ${victimName}`;
  const suspects = makeSuspects(usedNames);
  const killer = suspects.find((suspect) => suspect.id === killerId);

  if (!killer) throw new Error("Generated case has no killer profile.");

  const evidence = [
    pick(scenario.findings),
    `A sensor recorded movement at the ${scenario.accessPoint} at ${time.event}, but did not capture a name.`,
    pick(scenario.traces),
  ];

  const caseFile: CaseFile = {
    caseNumber: `CASE-${id.slice(0, 8).toUpperCase()}`,
    title: scenario.title,
    victim,
    location: `${scenario.scene} · ${scenario.venue}`,
    timeOfDeath: time.death,
    cause: scenario.cause,
    summary: `${victim} was found at ${time.death} in ${scenario.scene}, ${scenario.venue}. The preliminary report points to ${scenario.cause}; investigators logged movement near ${scenario.accessPoint} shortly beforehand.`,
    evidence,
  };

  const witnesses = {} as Record<SuspectId, HiddenWitness>;

  for (const suspect of suspects) {
    const isKiller = suspect.id === killerId;
    const actualLocation = isKiller ? scenario.scene : suspect.workArea;
    const truthStatus = suspect.id === liarId ? "liar" : "truthful";
    const role = ROLE_ARCHETYPES.find((candidate) => candidate.title === suspect.title);

    if (!role) throw new Error("Generated suspect has no role profile.");

    const claims =
      truthStatus === "liar"
        ? makeFalseClaim(actualLocation, suspects, scenario.scene, time)
        : makeTruthfulClaims(
            suspect,
            role,
            isKiller,
            killer.name,
            victim,
            scenario,
            time,
          );

    witnesses[suspect.id] = {
      id: suspect.id,
      name: suspect.name,
      truthStatus,
      claims,
    };
  }

  const generatedWitnesses = Object.values(witnesses);
  const truthfulCount = generatedWitnesses.filter(
    (witness) => witness.truthStatus === "truthful",
  ).length;
  const liars = generatedWitnesses.filter(
    (witness) => witness.truthStatus === "liar",
  );

  if (truthfulCount !== 2 || liars.length !== 1) {
    throw new Error("Game invariant failed: each case must have two truthful witnesses and one liar.");
  }
  if (liars[0].claims.length !== 1 || liars[0].claims[0]?.topic !== "timeline") {
    throw new Error("Game invariant failed: the liar must have exactly one fixed false alibi.");
  }
  if (generatedWitnesses.length !== SUSPECT_IDS.length || new Set(suspects.map((suspect) => suspect.name)).size !== SUSPECT_IDS.length) {
    throw new Error("Game invariant failed: every suspect must have a unique witness profile and name.");
  }

  return {
    id,
    createdAt,
    expiresAt: createdAt + GAME_LIFETIME_MS,
    killerId,
    liarId,
    caseFile,
    suspects,
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
    caseFile: state.caseFile,
    suspects: state.suspects,
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
  const stageDirection = `${witness.name} ${STAGE_DIRECTIONS[witness.id][selection.tone]}.`;

  if (selectedClaims.length === 0) {
    return `${stageDirection} “I can only speak to what I know about that evening. Ask me about the timeline, the evidence, or my connection to the victim.”`;
  }

  return `${stageDirection} “${selectedClaims.map((claim) => claim.text).join(" ")}"`;
}
