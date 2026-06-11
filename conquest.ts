
// ============================================================
// CONFIG
// ============================================================

const CONFIG = {
    TIME_LIMIT: 2700,
    STARTING_SCORE: 1500,
    CONQUEST_ASSAULT_TEAM_1_SCORE: 2000,
    CONQUEST_ASSAULT_TEAM_2_SCORE: 1500,
    FLAG_CAPTURE_TIME: 15,
    FLAG_NEUTRAL_TIME: 20,
    TICKET_BLEED_SPEED: 2,
    TOTAL_CONTROL_BONUS: 10,
    LOW_TICKET_MUSIC_THRESHOLD: 100,
    MAX_CUSTOM_AI: 36,
    INVISIBLE_WALL_TRIGGER_ID: 1500,
} as const;

const FLAGS = {
    ENABLE_CUSTOM_AI: true,
    ENABLE_TEAM_SWITCHING: true,
    ENABLE_HEADER_UI: true,
    LOSER_ONLY_TICKET_BLEED: true,
    TOTAL_CONTROL_TICKET_BLEED: true,
    PLAYER_DEATHS_BLEED: true,
    ENABLE_VO: true,
    ENABLE_SNOW: false,
    RANDOM_DAY_NIGHT: false,
    NIGHT_MODE: false,
    GIVE_PLAYERS_NVG: false,
    GIVE_PLAYERS_GAS_MASK: false,
    CONQUEST_ASSAULT: false,
    BF3_COLOUR_FILTER: false,
    BF4_COLOUR_FILTER: false,
    SNOW_COLOUR_FILTER: false,
} as const;

const ZERO_VECTOR = mod.CreateVector(0, 0, 0);

const SCORE_MESSAGE = mod.Message("Score");
const KILLS_MESSAGE = mod.Message("Kills");
const DEATHS_MESSAGE = mod.Message("Deaths");
const ASSISTS_MESSAGE = mod.Message("Assists");
const CAPTURES_MESSAGE = mod.Message("Captures");

// EVENT INFO TYPES
type PlayerEventInfo = { eventPlayer: mod.Player };
type PlayerCombatEventInfo = {
    eventPlayer: mod.Player;
    eventOtherPlayer: mod.Player;
    eventDeathType?: mod.DeathType;
    eventDamageType?: mod.DamageType;
    eventWeaponUnlock?: mod.WeaponUnlock;
};
type CapturePointEventInfo = { eventCapturePoint: mod.CapturePoint };
type PlayerCapturePointEventInfo = {
    eventPlayer: mod.Player;
    eventCapturePoint: mod.CapturePoint;
};

// Runtime Globals

let isGameOngoing = false;
let isFXResetting = false;
let capturePointFlash = 0;
let botNameIndex = 0;
let nightMode: boolean = FLAGS.NIGHT_MODE;
let endMusicIntensity = 0;
let drawnUICount = 0;
let nightWeaponPackage: mod.WeaponPackage | null = null;

let scorePositionLeft: mod.Vector;
let scorePositionRight: mod.Vector;
let friendlyTextColour: mod.Vector;
let friendlyBGColour: mod.Vector;
let enemyTextColour: mod.Vector;
let enemyBGColour: mod.Vector;

// Spawned Object References

const audio = {
    vo1: null as mod.VO | null,
    vo2: null as mod.VO | null,
    vo3: null as mod.VO | null,
    vo4: null as mod.VO | null,
    vo5: null as mod.VO | null,
    vo6: null as mod.VO | null,
    tickSoundTaking: null as mod.SFX | null,
    tickSoundLosing: null as mod.SFX | null,
    capturedSound: null as mod.SFX | null,
    neutraliseSound: null as mod.SFX | null,
    oobSound: null as mod.SFX | null,
};

let snowVolume: mod.SpatialObject | null = null;

// Static Arrays

const botNames: string[] = [
    "andy6170 (Bot)",
    "TheOzzy (Bot)",
    "Mancour (Bot)",
    "gala_vs (Bot)",
    "BattlefieldDad (Bot)",
    "Matavatar (Bot)",
    "ToughKarma (Bot)",
    "extermin8or_ (Bot)",
    "Draco25240 (Bot)",
    "CodeName_Deus (Bot)",
    "TonisGaming (Bot)",
    "SCKGaming (Bot)",
    "HybridBeard0 (Bot)",
    "ClaraTheRed (Bot)",
    "PrincessTeacup (Bot)",
    "Haze (Bot)",
    "Renette (Bot)",
    "BT Zero (Bot)",
    "Thirsty Wizard (Bot)",
    "SwarmFly (Bot)",
    "Sheer Iceman (Bot)",
    "Daniel VNZ (Bot)",
    "Languorian (Bot)",
    "zbmts (Bot)",
    "Joshua (Bot)",
    "Richard (Bot)",
    "Dirteebreaks (Bot)",
    "Mystfit (Bot)",
    "Shorty (Bot)",
    "tango (Bot)",
    "Beam (Bot)",
    "C¥pher (Bot)",
    "ThirdEyeAgent (Bot)",
    "floris12fs (Bot)",
    "oleole56 (Bot)",
    "LadyArsenic (Bot)",
    "Akira72 (Bot)",
    "KieranP (Bot)",
    "warcreator (Bot)",
    "Cytochrome2 (Bot)",
    "LT D.A.L.E. (Bot)",
    "Kale (Bot)",
    "OutlawSkot33 (Bot)",
    "F4rus (Bot)",
    "TabbedScamper (Bot)",
    "reni2 (Bot)",
    "AP_Atipoya (Bot)",
    "m1kedeluca_ (Bot)",
    "Ariistuujj (Bot)",
    "Marcus (DJsparco) (Bot)",
    "Hope (Bot)",
    "pompom (Bot)",
    "mindflexor (Bot)",
    "Robert5974 (Bot)",
    "Ricelletis (Bot)",
    "cczzcx (Bot)",
    "Fobia_BGa (Bot)",
    "Nodone (Bot)",
    "Crush (Bot)",
    "EIGuimaraes (Bot)",
    "Bennen (Bot)",
    "Mary (Bot)",
    "dzonzla_ (Bot)",
    "L0gan-M-Sc0tt (Bot)",
    "FaithWalker (Bot)",
    "SgtHamster (Bot)",
    "LoganTheBrawler (Bot)",
    "bowie knife99 (Bot)",
    "Atic (Bot)",
    "Deco (Bot)",
    "vixievpr (Bot)",
];

// Player State

class PlayerState {
    team: mod.Team;

    constructor(public player: mod.Player) {
        this.team = mod.GetTeam(player);
    }

    uniqueUiId = "";
    uiRoot: mod.UIWidget | null = null;
    score = 0;
    kills = 0;
    deaths = 0;
    assists = 0;
    captures = 0;
    revives = 0;

    currentCapturePoint: mod.CapturePoint | null = null;
    capturePointState = 0;
    flagOwner: mod.Team | null = null;
    captureProgressTick = 0;
    outOfBoundsCountdown = -1;
    captureSessionActive = false;

    isOutOfBounds = false;
    ignoreOOB = false;
    invisibleWallTriggered = false;

    isCustomAI = false;
    aiTarget: mod.Player | mod.CapturePoint | null = null;
    aiInAction = false;
    failMoveCount = 0;
    startPosition: mod.Vector | null = null;
    lastPosition: mod.Vector | null = null;
    lastMovement: mod.Vector | null = null;
    lastRotation = 0;
    pushBackDistance = 0;

    conditions = new Conditions(PlayerConditionSlot.Count);
}

// Team State

class TeamState {
    faction: "NATO" | "PAX" = "NATO";
    score = 0;
    startingScore = 0;
    flagsOwned = 0;

    constructor(
        public team: mod.Team,
        public otherTeam: mod.Team,
    ) {}
}

// Objective State

class ObjectiveTeamState {
    playersOnPoint = 0;
    capTextColour = mod.CreateVector(1, 1, 1);
    capBGColour = mod.CreateVector(0, 0, 0);
    capMessage = "";
    capProgressColour = mod.CreateVector(0, 0, 0);
}

class Objective {
    private capturePoint: mod.CapturePoint | null = null;
    private team1VehicleSpawner: mod.VehicleSpawner | null = null;
    private team2VehicleSpawner: mod.VehicleSpawner | null = null;

    readonly team1State = new ObjectiveTeamState();
    readonly team2State = new ObjectiveTeamState();
    readonly team1TextUI: string;
    readonly team2TextUI: string;
    readonly team1OutlineUI: string;
    readonly team2OutlineUI: string;

    private conditionStore: Conditions | null = null;

    progress = 0;
    lastOwnerTeamId = -999;
    uiSyncTick = 0;
    uiSize = mod.CreateVector(0, 7, 0);
    uiPosition = mod.CreateVector(-110, 200, 0);

    constructor(
        public readonly index: number,
        public readonly id: number,
        public readonly letter: string,
        public readonly voiceFlag: mod.VoiceOverFlags | null,
        private readonly team1VehicleSpawnerId: number | null,
        private readonly team2VehicleSpawnerId: number | null,
    ) {
        this.team1TextUI = letter + "1";
        this.team2TextUI = letter + "2";
        this.team1OutlineUI = letter + "3";
        this.team2OutlineUI = letter + "4";
    }

    setCapturePoint(capturePoint: mod.CapturePoint): void {
        this.capturePoint = capturePoint;
    }

    getCapturePoint(): mod.CapturePoint {
        if (!isDefined(this.capturePoint)) {
            this.capturePoint = mod.GetCapturePoint(this.id);
        }
        return this.capturePoint;
    }

    hasVehicleSpawners(): boolean {
        return this.team1VehicleSpawnerId !== null && this.team2VehicleSpawnerId !== null;
    }

    getTeam1VehicleSpawner(): mod.VehicleSpawner | null {
        if (this.team1VehicleSpawnerId === null) return null;
        if (!isDefined(this.team1VehicleSpawner)) {
            this.team1VehicleSpawner = mod.GetVehicleSpawner(this.team1VehicleSpawnerId);
        }
        return this.team1VehicleSpawner;
    }

    getTeam2VehicleSpawner(): mod.VehicleSpawner | null {
        if (this.team2VehicleSpawnerId === null) return null;
        if (!isDefined(this.team2VehicleSpawner)) {
            this.team2VehicleSpawner = mod.GetVehicleSpawner(this.team2VehicleSpawnerId);
        }
        return this.team2VehicleSpawner;
    }

    getVehicleSpawnerForTeam(team: mod.Team): mod.VehicleSpawner | null {
        if (sameTeam(team, TEAM_1)) return this.getTeam1VehicleSpawner();
        if (sameTeam(team, TEAM_2)) return this.getTeam2VehicleSpawner();
        return null;
    }

    getOtherVehicleSpawnerForTeam(team: mod.Team): mod.VehicleSpawner | null {
        if (sameTeam(team, TEAM_1)) return this.getTeam2VehicleSpawner();
        if (sameTeam(team, TEAM_2)) return this.getTeam1VehicleSpawner();
        return null;
    }

    get conditions(): Conditions {
        if (!isDefined(this.conditionStore)) {
            this.conditionStore = new Conditions(CapturePointConditionSlot.Count);
        }
        return this.conditionStore;
    }

    getTeamState(team: mod.Team): ObjectiveTeamState {
        return sameTeam(team, TEAM_2) ? this.team2State : this.team1State;
    }

    setPlayersOnPoint(team: mod.Team, count: number): void {
        this.getTeamState(team).playersOnPoint = count;
    }

    playersOnPoint(team: mod.Team): number {
        return this.getTeamState(team).playersOnPoint;
    }

    setProgressVisuals(progress: number): void {
        const width = mod.Floor(mod.Multiply(220, progress));
        this.uiSize = mod.CreateVector(width, 7, 0);
        this.uiPosition = mod.CreateVector(
            mod.Add(-110, mod.Floor(mod.Divide(width, 2))),
            200,
            0,
        );
    }
}

// Registries and Accessors

const playerStates = new Map<number, PlayerState>();
const teamStates = new Map<number, TeamState>();
const OBJECTIVE_ID_BASE = 200;
const objectives: Array<Objective | null> = [
    new Objective(0, 200, "A", mod.VoiceOverFlags.Alpha, 600, 601),
    new Objective(1, 201, "B", mod.VoiceOverFlags.Bravo, 610, 611),
    new Objective(2, 202, "C", mod.VoiceOverFlags.Charlie, 620, 621),
    new Objective(3, 203, "D", mod.VoiceOverFlags.Delta, 630, 631),
    new Objective(4, 204, "E", mod.VoiceOverFlags.Echo, 640, 641),
    new Objective(5, 205, "F", mod.VoiceOverFlags.Foxtrot, null, null),
    new Objective(6, 206, "G", mod.VoiceOverFlags.Golf, null, null),
    new Objective(7, 207, "H", mod.VoiceOverFlags.Hotel, null, null),
    new Objective(8, 208, "I", mod.VoiceOverFlags.India, null, null),
    new Objective(9, 209, "J", null, null, null),
    new Objective(10, 210, "K", null, null, null),
    new Objective(11, 211, "L", null, null, null),
    new Objective(12, 212, "M", null, null, null),
    new Objective(13, 213, "N", null, null, null),
    new Objective(14, 214, "O", null, null, null),
    new Objective(15, 215, "P", null, null, null),
    new Objective(16, 216, "Q", null, null, null),
    new Objective(17, 217, "R", null, null, null),
    new Objective(18, 218, "S", null, null, null),
    new Objective(19, 219, "T", null, null, null),
    new Objective(20, 220, "U", null, null, null),
    new Objective(21, 221, "V", null, null, null),
    new Objective(22, 222, "W", null, null, null),
    new Objective(23, 223, "X", null, null, null),
    new Objective(24, 224, "Y", null, null, null),
    new Objective(25, 225, "Z", null, null, null),
];
let activeObjectiveCount = 0;
let objectivesInitialized = false;

function getObjectiveById(objectiveId: number): Objective | null {
    const objectiveOffset = objectiveId - OBJECTIVE_ID_BASE;
    if (objectiveOffset < 0 || objectiveOffset >= objectives.length) return null;
    return objectives[objectiveOffset];
}

function getObjectiveByCapturePoint(capturePoint: mod.CapturePoint): Objective | null {
    return getObjectiveById(mod.GetObjId(capturePoint));
}

function getFirstObjective(): Objective | null {
    for (const objective of objectives) {
        if (objective) return objective;
    }
    return null;
}

function initObjectiveRegistry(allCapturePoints: mod.Array): boolean {
    const capturePointCount = mod.CountOf(allCapturePoints);
    if (capturePointCount === 0) return false;

    const activeOffsets = new Set<number>();

    for (let i = 0; i < capturePointCount; i++) {
        const capturePoint = mod.ValueInArray(allCapturePoints, i) as mod.CapturePoint;
        const objectiveId = mod.GetObjId(capturePoint);
        const objectiveOffset = objectiveId - OBJECTIVE_ID_BASE;
        const objective = objectives[objectiveOffset];
        if (objective) {
            objective.setCapturePoint(capturePoint);
            activeOffsets.add(objectiveOffset);
        }
    }

    activeObjectiveCount = 0;
    for (let i = 0; i < objectives.length; i++) {
        if (activeOffsets.has(i)) {
            activeObjectiveCount += 1;
        } else {
            objectives[i] = null;
        }
    }
    return true;
}

function getPlayerState(player: mod.Player): PlayerState {
    const id = mod.GetObjId(player);
    playerById.set(id, player);

    let state = playerStates.get(id);
    if (!state) {
        state = new PlayerState(player);
        playerStates.set(id, state);
    } else {
        // Handles can be fresh/opaque. Keep latest handle.
        state.player = player;
    }
    return state;
}

function updatePlayerTeam(player: mod.Player): PlayerState {
    const state = getPlayerState(player);
    const team = mod.GetTeam(player);
    if (tryGetTeamState(team)) {
        state.team = team;
    }
    return state;
}

function getTeamState(team: mod.Team): TeamState {
    const state = tryGetTeamState(team);
    if (state) return state;

    // Neutral/non-gameplay teams should not have TeamState. Fix call sites to use
    // isNeutralTeam()/sameTeam() checks instead of asking for score state.
    mod.SendErrorReport(mod.Message("Missing gameplay TeamState for team {}", mod.GetObjId(team)));
    return teamStates.get(mod.GetObjId(TEAM_1))!;
}

function tryGetTeamState(team: mod.Team): TeamState | null {
    ensureStateInitialized();
    return teamStates.get(mod.GetObjId(team)) ?? null;
}

function sameTeam(a: mod.Team, b: mod.Team): boolean {
    return mod.GetObjId(a) === mod.GetObjId(b);
}

function isNeutralTeam(team: mod.Team): boolean {
    ensureStateInitialized();
    return sameTeam(team, TEAM_NEUTRAL);
}

function isAlivePlayer(player: mod.Player): boolean {
    return mod.IsPlayerValid(player) && mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive);
}

function isAISoldier(player: mod.Player): boolean {
    return mod.IsPlayerValid(player) && mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier);
}

function isPlayerInVehicle(player: mod.Player): boolean {
    return mod.IsPlayerValid(player) && mod.GetSoldierState(player, mod.SoldierStateBool.IsInVehicle);
}

function getObjectiveState(cp: mod.CapturePoint): Objective {
    const id = mod.GetObjId(cp);
    const objective = getObjectiveById(id);
    if (objective) {
        objective.setCapturePoint(cp);
        return objective;
    }

    mod.SendErrorReport(mod.Message("Missing objective state for capture point {}", id));
    return getFirstObjective()!;
}

// --- 1i. Cached Handles ---

let stateInitialized = false;
let stateInitializing = false;

let TEAM_NEUTRAL: mod.Team;
let TEAM_1: mod.Team;
let TEAM_2: mod.Team;

const teamById = new Map<number, mod.Team>();
const playerById = new Map<number, mod.Player>();

function ensureStateInitialized(): void {
    if ((stateInitialized && objectivesInitialized) || stateInitializing) return;
    stateInitializing = true;

    try {
        if (!stateInitialized) {
            TEAM_NEUTRAL = mod.GetTeam(0);
            TEAM_1 = mod.GetTeam(1);
            TEAM_2 = mod.GetTeam(2);

            teamById.set(mod.GetObjId(TEAM_NEUTRAL), TEAM_NEUTRAL);
            teamById.set(mod.GetObjId(TEAM_1), TEAM_1);
            teamById.set(mod.GetObjId(TEAM_2), TEAM_2);

            initRuntimeValues();
            initTeams();
            stateInitialized = true;
        }

        if (!objectivesInitialized) {
            tryInitializeObjectives();
        }
    } finally {
        stateInitializing = false;
    }
}

// --- 1j. Initialization Functions ---

function tryInitializeObjectives(): boolean {
    objectivesInitialized = initObjectiveRegistry(mod.AllCapturePoints());
    return objectivesInitialized;
}

async function waitForObjectiveRegistry(): Promise<void> {
    while (!objectivesInitialized && !tryInitializeObjectives()) {
        await mod.Wait(0.1)
    }
}

function initRuntimeValues(): void {
    isGameOngoing = false;
    isFXResetting = false;
    capturePointFlash = 0;
    botNameIndex = 0;
    nightMode = FLAGS.NIGHT_MODE;
    endMusicIntensity = 0;
    drawnUICount = 0;
    nightWeaponPackage = null;

    scorePositionLeft = mod.CreateVector(-315, 45, 0);
    scorePositionRight = mod.CreateVector(315, 45, 0);
    friendlyTextColour = mod.CreateVector(0, 0.8, 1);
    friendlyBGColour = mod.CreateVector(0, 0.2, 0.5);
    enemyTextColour = mod.CreateVector(1, 0.2, 0.2);
    enemyBGColour = mod.CreateVector(0.6, 0.1, 0.1);
}

function initTeams(): void {
    const team1 = new TeamState(TEAM_1, TEAM_2);
    const team2 = new TeamState(TEAM_2, TEAM_1);

    if (FLAGS.CONQUEST_ASSAULT) {
        team1.startingScore = CONFIG.CONQUEST_ASSAULT_TEAM_1_SCORE;
        team2.startingScore = CONFIG.CONQUEST_ASSAULT_TEAM_2_SCORE;
    } else {
        team1.startingScore = CONFIG.STARTING_SCORE;
        team2.startingScore = CONFIG.STARTING_SCORE;
    }

    team1.score = team1.startingScore;
    team2.score = team2.startingScore;

    teamStates.set(mod.GetObjId(TEAM_1), team1);
    teamStates.set(mod.GetObjId(TEAM_2), team2);
}

function initPlayerState(player: mod.Player): PlayerState {
    const state = getPlayerState(player);
    playerById.set(mod.GetObjId(player), player);

    state.team = mod.GetTeam(player);
    state.captureProgressTick = 0;
    state.outOfBoundsCountdown = -1;
    state.captureSessionActive = false;
    state.isOutOfBounds = false;
    state.ignoreOOB = false;
    state.invisibleWallTriggered = false;
    state.isCustomAI = false;
    state.aiInAction = false;
    state.failMoveCount = 0;
    state.lastPosition = null;
    state.lastMovement = null;
    state.lastRotation = 0;
    state.pushBackDistance = 0;

    return state;
}

function playerRootWidgetName(playerId: number): string {
    return "PlayerRoot_" + playerId;
}

function getPlayerRootWidget(player: mod.Player): mod.UIWidget {
    const state = getPlayerState(player);
    if (!isDefined(state.uiRoot)) {
        state.uiRoot = mod.FindUIWidgetWithName(state.uniqueUiId) as mod.UIWidget;
    }
    return state.uiRoot;
}

function removePlayerStateById(playerId: number): void {
    const state = playerStates.get(playerId);
    if (state) {
        state.uiRoot = null;
        playerStates.delete(playerId);
    }
    playerById.delete(playerId);
}

// ============================================================
// END STATE FOUNDATION
// ============================================================

// ============================================================
// MODLIB REPLACEMENT HELPERS (Phase 3)
// ============================================================

// --- Condition State ---

class ConditionState {
    lastState = false;

    update(newState: boolean): boolean {
        if (!newState) {
            this.lastState = false;
            return false;
        }
        if (this.lastState) return false;
        this.lastState = true;
        return true;
    }
}

class Conditions {
    conditionStates: ConditionState[] = [];

    constructor(slotCount: number) {
        for (let i = 0; i < slotCount; i++) {
            this.conditionStates.push(new ConditionState());
        }
    }

    getConditionState(n: number): ConditionState {
        return this.conditionStates[n];
    }
}

enum GlobalConditionSlot {
    InitGameSettings = 0,
    UpdateScoreTime = 1,
    UpdateScoreTimeSecondaryTick = 2,
    TrackScore = 3,
    PlayNearEndMusic = 4,
    EndGame = 5,
    PlayVOLowTime = 6,
    PlayVOWinning = 7,
    PlayVOTeam2Winning = 8,
    PlayVOLowTickets = 9,
    PlayVOTeam2LowTickets = 10,
    SetupMap = 11,
    Count = 12,
}

enum PlayerConditionSlot {
    ProcessKill = 0,
    AITargetOnKill = 1,
    ProcessAssist = 2,
    AITargetOnKillAssist = 3,
    ProcessRevive = 4,
    UpdatePlayerCountOnRevive = 5,
    HandlePlayerDeath = 6,
    UpdatePlayerCountOnDeath = 7,
    AddEquipment = 8,
    UndeployIfSpawnedOOB = 9,
    AIScoutOnSpawnerSpawned = 10,
    AIReadyForAttack = 11,
    HandlePlayerJoin = 12,
    UpdateDeathOnUndeploy = 13,
    ShowCaptureUI = 14,
    AIFindNewObjective = 15,
    HideCaptureUI = 16,
    HandleTeamSwitchAndRepel = 17,
    EnterAreaTrigger = 18,
    EnterInvisibleWallTrigger = 19,
    ExitAreaTrigger = 20,
    AITargetDamager = 21,
    AIExitVehicle = 22,
    AIEnterVehicle = 23,
    AIRetryMove = 24,
    AIMoveSucceeded = 25,
    Count = 26,
}

enum CapturePointConditionSlot {
    HandleCaptured = 0,
    HandleLost = 1,
    RunProgressLoop = 2,
    Count = 3,
}

let globalConditions = new Conditions(GlobalConditionSlot.Count);

function getGlobalCondition(n: number): ConditionState {
    return globalConditions.getConditionState(n);
}

function getPlayerCondition(player: mod.Player, n: number): ConditionState {
    return getPlayerState(player).conditions.getConditionState(n);
}

function getCapturePointCondition(cp: mod.CapturePoint, n: number): ConditionState {
    return getObjectiveState(cp).conditions.getConditionState(n);
}

function isDefined<T>(value: T | null | undefined): value is T {
    return value !== undefined && value !== null;
}

// --- Array Helpers ---

function modArrayToNative<T>(array: mod.Array): T[] {
    const result: T[] = [];
    const count = mod.CountOf(array);
    for (let i = 0; i < count; i++) {
        result.push(mod.ValueInArray(array, i) as T);
    }
    return result;
}

function filterModArray(array: mod.Array, predicate: (value: any) => boolean): mod.Array {
    let result = mod.EmptyArray();
    const count = mod.CountOf(array);
    for (let i = 0; i < count; i++) {
        const value = mod.ValueInArray(array, i);
        if (predicate(value)) result = mod.AppendToArray(result, value);
    }
    return result;
}

function randomArrayValue<T>(values: T[]): T | undefined {
    if (values.length === 0) return undefined;
    const index = Math.min(values.length - 1, Math.floor(mod.RandomReal(0, values.length)));
    return values[index];
}

async function waitUntil(duration: number, condition: () => boolean, pollInterval = 0.05): Promise<void> {
    let elapsed = 0;
    while (elapsed < duration && !condition()) {
        const waitTime = Math.min(pollInterval, duration - elapsed);
        await mod.Wait(waitTime)
        elapsed += waitTime;
    }
}

function isTrueForAll(array: mod.Array, predicate: (value: any) => boolean): boolean {
    const count = mod.CountOf(array);
    for (let i = 0; i < count; i++) {
        if (!predicate(mod.ValueInArray(array, i))) return false;
    }
    return true;
}

function isTrueForAny(array: mod.Array, predicate: (value: any) => boolean): boolean {
    const count = mod.CountOf(array);
    for (let i = 0; i < count; i++) {
        if (predicate(mod.ValueInArray(array, i))) return true;
    }
    return false;
}

// ============================================================
// END MODLIB REPLACEMENT HELPERS
// ============================================================

// ============================================================
// MANAGER SHELLS (Phase 10)
// ============================================================

class UIController {
    updatePlayerScoreboard(player: mod.Player): void {
        mod.SetScoreboardPlayerValues(player, getPlayerState(player).score, getPlayerState(player).kills, getPlayerState(player).deaths, getPlayerState(player).assists, getPlayerState(player).captures)
    }

    updateObjectiveUI(label: string, eventInfo: PlayerCapturePointEventInfo): void {
        const player = eventInfo.eventPlayer;
        const playerState = getPlayerState(player);
        const playerRoot = getPlayerRootWidget(player);
        const objText = mod.FindUIWidgetWithName("ObjText", playerRoot);
        const objCounter = mod.FindUIWidgetWithName("ObjCounter", playerRoot);
        const objective = getObjectiveState(eventInfo.eventCapturePoint);
        const teamState = getTeamState(playerState.team);
        const teamPlayersOnPoint = objective.playersOnPoint(playerState.team);
        const enemyPlayersOnPoint = objective.playersOnPoint(teamState.otherTeam);

        mod.SetUITextLabel(objText, mod.Message(label))
        mod.SetUITextLabel(objCounter, mod.Message("{} - {}", teamPlayersOnPoint, enemyPlayersOnPoint))
        mod.SetUITextColor(objCounter, teamPlayersOnPoint === 0 || teamPlayersOnPoint > enemyPlayersOnPoint ? mod.CreateVector(1, 1, 1) : enemyTextColour)
    }

    setupMainUI(): void {
        mod.AddUIContainer("container", mod.CreateVector(0, 0, 0), mod.CreateVector(2000, 2000, 0), mod.UIAnchor.TopCenter)
        if (!FLAGS.ENABLE_HEADER_UI) {
            mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("container"), false)
        }
        mod.SetUIWidgetBgFill(mod.FindUIWidgetWithName("container"), mod.UIBgFill.None)
        mod.SetUIWidgetDepth(mod.FindUIWidgetWithName("container"), mod.UIDepth.AboveGameUI)
        mod.AddUIText("Timer", mod.CreateVector(0, 50, 0), mod.CreateVector(85, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Blur, mod.Message("{} : {}{}", mod.Floor(mod.Divide(
            mod.GetMatchTimeRemaining(),
            60)), mod.Floor(mod.Divide(
                mod.Modulo(
                    mod.GetMatchTimeRemaining(),
                    60),
                10)), mod.Floor(mod.Modulo(
                    mod.GetMatchTimeRemaining(),
                    10))), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI)
        mod.AddUIText("LeftBarBG", mod.CreateVector(-160, 60, 0), mod.CreateVector(200, 10, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, friendlyBGColour, 0.8, mod.UIBgFill.Blur, mod.Message(""), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI)
        mod.AddUIText("RightBarBG", mod.CreateVector(160, 60, 0), mod.CreateVector(200, 10, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, enemyBGColour, 0.8, mod.UIBgFill.Blur, mod.Message(""), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI)
        this.setupScoreUI("Team1ScoreLeft", "Team1ScoreRight", "Team1LeftBar", "Team1RightBar", mod.GetTeam(1))
        this.setupScoreUI("Team2ScoreLeft", "Team2ScoreRight", "Team2LeftBar", "Team2RightBar", mod.GetTeam(2))
        let objectiveDisplayIndex = 0;
        for (const objective of objectives) {
            if (!objective) continue;

            const objectivePosition = mod.CreateVector((objectiveDisplayIndex - (activeObjectiveCount - 1) / 2) * 50, 90, 0);
            mod.AddUIText(objective.team1TextUI, objectivePosition, mod.CreateVector(30, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Blur, mod.Message(objective.letter), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(1))
            mod.AddUIText(objective.team1OutlineUI, objectivePosition, mod.CreateVector(30, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.OutlineThin, mod.Message(""), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(1))
            mod.AddUIText(objective.team2TextUI, objectivePosition, mod.CreateVector(30, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Blur, mod.Message(objective.letter), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(2))
            mod.AddUIText(objective.team2OutlineUI, objectivePosition, mod.CreateVector(30, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.OutlineThin, mod.Message(""), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(2))
            objectiveDisplayIndex += 1;
        }
        mod.AddUIText("LeftFlash1", scorePositionLeft, mod.CreateVector(80, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, friendlyTextColour, 0, mod.UIBgFill.Solid, mod.Message(""), 32, friendlyTextColour, 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(1))
        mod.AddUIText("RightFlash1", scorePositionRight, mod.CreateVector(80, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, enemyTextColour, 0, mod.UIBgFill.Solid, mod.Message(""), 32, enemyTextColour, 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(1))
        mod.AddUIText("LeftFlash2", scorePositionLeft, mod.CreateVector(80, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, friendlyTextColour, 0, mod.UIBgFill.Solid, mod.Message(""), 32, friendlyTextColour, 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(2))
        mod.AddUIText("RightFlash2", scorePositionRight, mod.CreateVector(80, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, enemyTextColour, 0, mod.UIBgFill.Solid, mod.Message(""), 32, enemyTextColour, 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(2))
    }

    setupScoreUI(leftScore: string, rightScore: string, leftBar: string, rightBar: string, team: mod.Team): void {
        mod.AddUIText(leftScore, scorePositionLeft, mod.CreateVector(80, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, friendlyBGColour, 0.8, mod.UIBgFill.Blur, mod.Message("{}", getTeamState(team).score), 32, friendlyTextColour, 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, team)
        mod.AddUIText(rightScore, scorePositionRight, mod.CreateVector(80, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, enemyBGColour, 0.8, mod.UIBgFill.Blur, mod.Message("{}", getTeamState(getTeamState(team).otherTeam).score), 32, enemyTextColour, 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, team)
        mod.AddUIText(leftBar, mod.CreateVector(mod.Add(
            -260,
            mod.Divide(
                mod.Multiply(200, mod.Divide(
                    getTeamState(team).score,
                    getTeamState(team).startingScore)),
                2)), 60, 0), mod.CreateVector(mod.Multiply(200, mod.Divide(
                    getTeamState(team).score,
                    getTeamState(team).startingScore)), 10, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, friendlyTextColour, 1, mod.UIBgFill.Solid, mod.Message(""), 32, friendlyTextColour, 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, team)
        mod.AddUIText(rightBar, mod.CreateVector(mod.Subtract(
            260,
            mod.Divide(
                mod.Multiply(200, mod.Divide(
                    getTeamState(getTeamState(team).otherTeam).score,
                    getTeamState(getTeamState(team).otherTeam).startingScore)),
                2)), 60, 0), mod.CreateVector(mod.Multiply(200, mod.Divide(
                    getTeamState(getTeamState(team).otherTeam).score,
                    getTeamState(getTeamState(team).otherTeam).startingScore)), 10, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, enemyTextColour, 1, mod.UIBgFill.Solid, mod.Message(""), 32, enemyTextColour, 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, team)
    }

    showEndGameUI(widgetName: string, position: mod.Vector): void {
        mod.SetUIWidgetSize(mod.FindUIWidgetWithName(widgetName), mod.CreateVector(160, 70, 0))
        mod.SetUITextSize(mod.FindUIWidgetWithName(widgetName), 64)
        mod.SetUIWidgetPosition(mod.FindUIWidgetWithName(widgetName), position)
    }

    manageCapturePointUI(flag: mod.CapturePoint, oldProgress: number, eventInfo: CapturePointEventInfo): void {
        const objective = getObjectiveState(flag);
        const team1ObjectiveState = objective.team1State;
        const team2ObjectiveState = objective.team2State;
        const ownerTeam = mod.GetCurrentOwnerTeam(flag);
        const ownerProgressTeam = mod.GetOwnerProgressTeam(eventInfo.eventCapturePoint);
        const captureProgress = mod.GetCaptureProgress(eventInfo.eventCapturePoint);

        if (sameTeam(ownerTeam, TEAM_1)) {
            team1ObjectiveState.capTextColour = friendlyTextColour;
            team1ObjectiveState.capBGColour = friendlyBGColour;
            team2ObjectiveState.capTextColour = enemyTextColour;
            team2ObjectiveState.capBGColour = enemyBGColour;
        } else if (sameTeam(ownerTeam, TEAM_2)) {
            team2ObjectiveState.capTextColour = friendlyTextColour;
            team2ObjectiveState.capBGColour = friendlyBGColour;
            team1ObjectiveState.capTextColour = enemyTextColour;
            team1ObjectiveState.capBGColour = enemyBGColour;
        } else {
            team1ObjectiveState.capTextColour = mod.CreateVector(1, 1, 1);
            team1ObjectiveState.capBGColour = mod.CreateVector(0, 0, 0);
            team2ObjectiveState.capTextColour = mod.CreateVector(1, 1, 1);
            team2ObjectiveState.capBGColour = mod.CreateVector(0, 0, 0);
        }

        if (captureProgress < 1) {
            if (objective.playersOnPoint(TEAM_1) > objective.playersOnPoint(TEAM_2)) {
                team1ObjectiveState.capMessage = "CAPTURING";
                team2ObjectiveState.capMessage = "LOSING";
            } else if (objective.playersOnPoint(TEAM_2) > objective.playersOnPoint(TEAM_1)) {
                team1ObjectiveState.capMessage = "LOSING";
                team2ObjectiveState.capMessage = "CAPTURING";
            } else {
                team1ObjectiveState.capMessage = "CONTESTED";
                team2ObjectiveState.capMessage = "CONTESTED";
            }
        } else if (sameTeam(ownerTeam, TEAM_1)) {
            team1ObjectiveState.capMessage = "SECURED";
            team2ObjectiveState.capMessage = "CONTESTED";
        } else {
            team1ObjectiveState.capMessage = "CONTESTED";
            team2ObjectiveState.capMessage = "SECURED";
        }
    }

    setupPlayerUI(player: mod.Player): void {
        const playerId = mod.GetObjId(player);
        const rootName = playerRootWidgetName(playerId);
        const playerState = getPlayerState(player);
        playerState.uniqueUiId = rootName;

        if (isDefined(playerState.uiRoot)) {
            mod.DeleteUIWidget(playerState.uiRoot);
            playerState.uiRoot = null;
        }
        mod.AddUIContainer(rootName, mod.CreateVector(0, 0, 0), mod.CreateVector(10000, 10000, 0), mod.UIAnchor.TopCenter, player)
        playerState.uiRoot = mod.FindUIWidgetWithName(rootName) as mod.UIWidget;
        const playerRoot = playerState.uiRoot;
        mod.SetUIWidgetBgFill(playerRoot, mod.UIBgFill.None)
        mod.SetUIWidgetDepth(playerRoot, mod.UIDepth.AboveGameUI)
        mod.AddUIText("ObjText", mod.CreateVector(0, 150, 0), mod.CreateVector(220, 40, 0), mod.UIAnchor.TopCenter, playerRoot, false, 1, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Blur, mod.Message(""), 36, mod.CreateVector(0, 0, 0), 1, mod.UIAnchor.Center, player)
        mod.AddUIText("ObjCounter", mod.CreateVector(0, 210, 0), mod.CreateVector(220, 40, 0), mod.UIAnchor.TopCenter, playerRoot, false, 1, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.None, mod.Message(""), 28, mod.CreateVector(0, 0, 0), 1, mod.UIAnchor.Center, player)
        mod.AddUIContainer("ObjProgressBG", mod.CreateVector(0, 200, 0), mod.CreateVector(220, 7, 0), mod.UIAnchor.TopCenter, playerRoot, false, 1, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Blur, player)
        mod.AddUIContainer("ObjProgress", mod.CreateVector(0, 200, 0), mod.CreateVector(220, 7, 0), mod.UIAnchor.TopCenter, playerRoot, false, 1, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.Solid, player)
        mod.AddUIText("OOBBackground", mod.CreateVector(0, 0, 0), mod.CreateVector(10000, 10000, 0), mod.UIAnchor.TopCenter, playerRoot, false, 1, mod.CreateVector(0, 0, 0), 0.9, mod.UIBgFill.Blur, mod.Message(""), 24, mod.CreateVector(0, 0, 0), 1, mod.UIAnchor.Center, player)
        mod.AddUIText("OOBText", mod.CreateVector(0, 470, 0), mod.CreateVector(450, 150, 0), mod.UIAnchor.TopCenter, playerRoot, false, 1, enemyBGColour, 0.8, mod.UIBgFill.Blur, mod.Message("RETURN TO COMBAT"), 56, enemyTextColour, 1, mod.UIAnchor.TopCenter, player)
        mod.AddUIText("OOBCounter", mod.CreateVector(0, 470, 0), mod.CreateVector(450, 150, 0), mod.UIAnchor.TopCenter, playerRoot, false, 1, mod.CreateVector(0, 0, 0), 0, mod.UIBgFill.None, mod.Message("{}", playerState.outOfBoundsCountdown), 72, enemyTextColour, 1, mod.UIAnchor.BottomCenter, player)
    }

    togglePlayerCaptureUI(enabled: boolean, eventInfo: PlayerCapturePointEventInfo): void {
        const playerRoot = getPlayerRootWidget(eventInfo.eventPlayer);
        const captureWidgets = ["ObjText", "ObjCounter", "ObjProgress", "ObjProgressBG"];

        for (const widgetName of captureWidgets) {
            mod.SetUIWidgetVisible(mod.FindUIWidgetWithName(widgetName, playerRoot), enabled)
        }
    }

    togglePlayerOOBUI(enabled: boolean, eventInfo: PlayerEventInfo): void {
        const playerRoot = getPlayerRootWidget(eventInfo.eventPlayer);
        const oobWidgets = ["OOBBackground", "OOBText", "OOBCounter"];

        for (const widgetName of oobWidgets) {
            mod.SetUIWidgetVisible(mod.FindUIWidgetWithName(widgetName, playerRoot), enabled)
        }
    }

    updateFlagIcons(): void {
        for (const objective of objectives) {
            if (!objective) continue;

            const team1Text = mod.FindUIWidgetWithName(objective.team1TextUI);
            const team2Text = mod.FindUIWidgetWithName(objective.team2TextUI);
            const team1Outline = mod.FindUIWidgetWithName(objective.team1OutlineUI);
            const team2Outline = mod.FindUIWidgetWithName(objective.team2OutlineUI);
            const ownerTeam = mod.GetCurrentOwnerTeam(objective.getCapturePoint());

            if (sameTeam(ownerTeam, TEAM_1)) {
                mod.SetUITextColor(team1Text, friendlyTextColour)
                mod.SetUIWidgetBgColor(team1Text, friendlyBGColour)
                mod.SetUITextColor(team2Text, enemyTextColour)
                mod.SetUIWidgetBgColor(team2Text, enemyBGColour)
                mod.SetUIWidgetBgColor(team1Outline, friendlyTextColour)
                mod.SetUIWidgetBgColor(team2Outline, enemyTextColour)
            } else if (sameTeam(ownerTeam, TEAM_2)) {
                mod.SetUITextColor(team1Text, enemyTextColour)
                mod.SetUIWidgetBgColor(team1Text, enemyBGColour)
                mod.SetUITextColor(team2Text, friendlyTextColour)
                mod.SetUIWidgetBgColor(team2Text, friendlyBGColour)
                mod.SetUIWidgetBgColor(team1Outline, enemyTextColour)
                mod.SetUIWidgetBgColor(team2Outline, friendlyTextColour)
            } else {
                const neutralTextColour = mod.CreateVector(0.9, 0.9, 0.9);
                const neutralBGColour = mod.CreateVector(0, 0, 0);
                mod.SetUITextColor(team1Text, neutralTextColour)
                mod.SetUIWidgetBgColor(team1Text, neutralBGColour)
                mod.SetUITextColor(team2Text, neutralTextColour)
                mod.SetUIWidgetBgColor(team2Text, neutralBGColour)
                mod.SetUIWidgetBgColor(team1Outline, neutralTextColour)
                mod.SetUIWidgetBgColor(team2Outline, neutralTextColour)
            }
        }
    }

    updatePlayerCaptureUI(eventInfo: PlayerCapturePointEventInfo): void {
        const player = eventInfo.eventPlayer;
        const capturePoint = eventInfo.eventCapturePoint;
        const playerState = getPlayerState(player);
        const objective = getObjectiveState(capturePoint);
        const objectiveTeamState = objective.getTeamState(playerState.team);
        const captureProgress = mod.GetCaptureProgress(capturePoint);
        const ownerProgressTeam = mod.GetOwnerProgressTeam(capturePoint);
        const playerRoot = getPlayerRootWidget(player);
        const objText = mod.FindUIWidgetWithName("ObjText", playerRoot);
        const objProgress = mod.FindUIWidgetWithName("ObjProgress", playerRoot);
        const objProgressBG = mod.FindUIWidgetWithName("ObjProgressBG", playerRoot);

        mod.SetUIWidgetPosition(objProgress, objective.uiPosition)
        mod.SetUIWidgetSize(objProgress, objective.uiSize)
        mod.SetUITextColor(objText, objectiveTeamState.capTextColour)
        mod.SetUIWidgetBgColor(objText, objectiveTeamState.capBGColour)
        mod.SetUIWidgetBgColor(objProgressBG, objectiveTeamState.capProgressColour)
        mod.SetUIWidgetBgColor(objProgress, sameTeam(playerState.team, ownerProgressTeam) ? friendlyTextColour : enemyTextColour)
        this.updateObjectiveUI(objectiveTeamState.capMessage, eventInfo)

        if (playerState.capturePointState !== captureProgress) {
            playerState.captureProgressTick += 1;
            if (playerState.captureProgressTick % 7 === 0) {
                const progressIncreasing = captureProgress > playerState.capturePointState;
                const playerIsProgressOwner = sameTeam(playerState.team, ownerProgressTeam);
                const tickSound = progressIncreasing === playerIsProgressOwner ? audio.tickSoundTaking! : audio.tickSoundLosing!;
                mod.PlaySound(tickSound, 0.5, player)
            }
        } else {
            playerState.captureProgressTick = 0;
        }
    }

    showVersion(): void {
        mod.AddUIText("ver", mod.CreateVector(10, 2, 0), mod.CreateVector(300, 30, 0), mod.UIAnchor.BottomLeft, mod.GetUIRoot(), true, 0, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.None, mod.Message("ViperStudiosAndy | andy6170 | Conquest Template V11"), 12, mod.CreateVector(1, 1, 1), 0.5, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI)
    }

    flashCaptureProgressUI(capturePoint: mod.CapturePoint, flashAlpha: number): void {
        const objective = getObjectiveByCapturePoint(capturePoint);
        if (!objective) return;

        const team1Text = mod.FindUIWidgetWithName(objective.team1TextUI);
        const team2Text = mod.FindUIWidgetWithName(objective.team2TextUI);
        const team1Outline = mod.FindUIWidgetWithName(objective.team1OutlineUI);
        const team2Outline = mod.FindUIWidgetWithName(objective.team2OutlineUI);
        const captureProgress = mod.GetCaptureProgress(capturePoint);

        if (captureProgress > 0 && captureProgress < 1) {
            mod.SetUITextAlpha(team1Text, flashAlpha)
            mod.SetUITextAlpha(team2Text, flashAlpha)
            mod.SetUIWidgetBgAlpha(team1Outline, flashAlpha)
            mod.SetUIWidgetBgAlpha(team2Outline, flashAlpha)
            mod.SetUIWidgetBgAlpha(team1Text, flashAlpha)
            mod.SetUIWidgetBgAlpha(team2Text, flashAlpha)
        } else {
            mod.SetUITextAlpha(team1Text, 1)
            mod.SetUITextAlpha(team2Text, 1)
            mod.SetUIWidgetBgAlpha(team1Outline, 1)
            mod.SetUIWidgetBgAlpha(team2Outline, 1)
            mod.SetUIWidgetBgAlpha(team1Text, 0.8)
            mod.SetUIWidgetBgAlpha(team2Text, 0.8)
        }
    }

    updateOOBUI(player: mod.Player, tick: number): void {
        const playerRoot = getPlayerRootWidget(player);
        const counterWidget = mod.FindUIWidgetWithName("OOBCounter", playerRoot);
        mod.SetUITextLabel(counterWidget, mod.Message("{}", tick))
    }

    teardownScoreUI(): void {
        const timerWidget = mod.FindUIWidgetWithName("Timer");
        mod.SetUIWidgetSize(timerWidget, mod.CreateVector(190, 60, 0))
        mod.SetUITextSize(timerWidget, 48)
        mod.SetUIWidgetPosition(timerWidget, mod.CreateVector(0, 390, 0))

        const scoreWidgets = [
            "Team1LeftBar",
            "Team1RightBar",
            "Team2LeftBar",
            "Team2RightBar",
            "LeftBarBG",
            "RightBarBG",
            "LeftFlash1",
            "RightFlash1",
            "LeftFlash2",
            "RightFlash2",
        ];
        for (const widgetName of scoreWidgets) {
            mod.DeleteUIWidget(mod.FindUIWidgetWithName(widgetName))
        }
        for (const objective of objectives) {
            if (!objective) continue;

            mod.DeleteUIWidget(mod.FindUIWidgetWithName(objective.team1TextUI))
            mod.DeleteUIWidget(mod.FindUIWidgetWithName(objective.team2TextUI))
            mod.DeleteUIWidget(mod.FindUIWidgetWithName(objective.team1OutlineUI))
            mod.DeleteUIWidget(mod.FindUIWidgetWithName(objective.team2OutlineUI))
        }
    }

    setupColourFilter(): void {
        const containerName = "container2";
        mod.AddUIContainer(containerName, ZERO_VECTOR, mod.CreateVector(20000, 20000, 0), mod.UIAnchor.TopCenter)

        const container = mod.FindUIWidgetWithName(containerName);
        let filterColour: mod.Vector | null = null;
        if (FLAGS.BF3_COLOUR_FILTER) {
            filterColour = mod.CreateVector(0, 0.8, 1);
        } else if (FLAGS.BF4_COLOUR_FILTER) {
            filterColour = mod.CreateVector(1, 0.5, 0);
        } else if (FLAGS.SNOW_COLOUR_FILTER) {
            filterColour = mod.CreateVector(0, 0.4, 0.7);
        }

        if (isDefined(filterColour)) {
            mod.SetUIWidgetBgColor(container, filterColour)
            mod.SetUIWidgetBgAlpha(container, 0.2)
            mod.SetUIWidgetBgFill(container, mod.UIBgFill.Blur)
        } else {
            mod.SetUIWidgetBgFill(container, mod.UIBgFill.None)
        }
    }

    async animateUIFlash(team1WidgetName: string, team2WidgetName: string): Promise<void> {
        const team1Widget = mod.FindUIWidgetWithName(team1WidgetName);
        const team2Widget = mod.FindUIWidgetWithName(team2WidgetName);

        mod.SetUIWidgetBgAlpha(team1Widget, 1)
        mod.SetUIWidgetBgAlpha(team2Widget, 1)
        for (let i = 10; i < 100; i += 10) {
            const alpha = 1 - i / 100;
            mod.SetUIWidgetBgAlpha(team1Widget, alpha)
            mod.SetUIWidgetBgAlpha(team2Widget, alpha)
            await mod.Wait(0.033)
        }
        mod.SetUIWidgetBgAlpha(team1Widget, 0)
        mod.SetUIWidgetBgAlpha(team2Widget, 0)
    }

    updateScoreboard(): void {
        // Current team state used for scoreboard text and ticket-bar ratios.
        const team1State = getTeamState(TEAM_1);
        const team2State = getTeamState(TEAM_2);

        // Ticket bars are 200px wide at full starting score.
        const team1BarWidth = Math.floor(200 * (team1State.score / team1State.startingScore));
        const team2BarWidth = Math.floor(200 * (team2State.score / team2State.startingScore));

        // Left bars grow right from -260; right bars grow left from 260.
        const team1LeftBarX = Math.floor(-260 + team1BarWidth / 2);
        const team1RightBarX = Math.floor(260 - team2BarWidth / 2);
        const team2LeftBarX = Math.floor(-260 + team2BarWidth / 2);
        const team2RightBarX = Math.floor(260 - team1BarWidth / 2);

        // Timer uses split digits to preserve the original "M : SS" formatting.
        const timeRemaining = mod.GetMatchTimeRemaining();
        const minutes = Math.floor(timeRemaining / 60);
        const secondsTens = Math.floor((timeRemaining % 60) / 10);
        const secondsOnes = Math.floor(timeRemaining % 10);

        mod.SetScoreboardType(mod.ScoreboardType.CustomTwoTeams)
        mod.SetScoreboardColumnNames(SCORE_MESSAGE, KILLS_MESSAGE, DEATHS_MESSAGE, ASSISTS_MESSAGE, CAPTURES_MESSAGE)
        mod.SetScoreboardHeader(mod.Message("{}: {}", team1State.faction, team1State.score), mod.Message("{}: {}", team2State.faction, team2State.score))
        mod.SetUITextLabel(mod.FindUIWidgetWithName("Team1ScoreLeft"), mod.Message("{}", team1State.score))
        mod.SetUITextLabel(mod.FindUIWidgetWithName("Team1ScoreRight"), mod.Message("{}", team2State.score))
        mod.SetUITextLabel(mod.FindUIWidgetWithName("Team2ScoreLeft"), mod.Message("{}", team2State.score))
        mod.SetUITextLabel(mod.FindUIWidgetWithName("Team2ScoreRight"), mod.Message("{}", team1State.score))
        mod.SetUITextLabel(mod.FindUIWidgetWithName("Timer"), mod.Message("{} : {}{}", minutes, secondsTens, secondsOnes))

        mod.SetUIWidgetSize(mod.FindUIWidgetWithName("Team1LeftBar"), mod.CreateVector(team1BarWidth, 10, 0))
        mod.SetUIWidgetSize(mod.FindUIWidgetWithName("Team2LeftBar"), mod.CreateVector(team2BarWidth, 10, 0))
        mod.SetUIWidgetSize(mod.FindUIWidgetWithName("Team1RightBar"), mod.CreateVector(team2BarWidth, 10, 0))
        mod.SetUIWidgetSize(mod.FindUIWidgetWithName("Team2RightBar"), mod.CreateVector(team1BarWidth, 10, 0))
        mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("Team1LeftBar"), mod.CreateVector(team1LeftBarX, 60, 0))
        mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("Team1RightBar"), mod.CreateVector(team1RightBarX, 60, 0))
        mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("Team2LeftBar"), mod.CreateVector(team2LeftBarX, 60, 0))
        mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("Team2RightBar"), mod.CreateVector(team2RightBarX, 60, 0))

        const lowestScore = Math.min(team1State.score, team2State.score);
        if (lowestScore < CONFIG.LOW_TICKET_MUSIC_THRESHOLD) {
            endMusicIntensity = Math.min((lowestScore / CONFIG.LOW_TICKET_MUSIC_THRESHOLD) * 4, 4);
        } else {
            endMusicIntensity = 0;
        }
    }
}

class PlayerController {
    shouldProcessKill(eventInfo: PlayerCombatEventInfo): boolean {
        return !sameTeam(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer));
    }

    processKill(eventInfo: PlayerCombatEventInfo): void {
        const player = eventInfo.eventPlayer;
        const playerState = getPlayerState(player);

        playerState.score += 100;
        if (playerState.captureSessionActive) {
            playerState.score += 50;
        }
        if (eventInfo.eventDeathType !== undefined && mod.EventDeathTypeCompare(eventInfo.eventDeathType, mod.PlayerDeathTypes.Headshot)) {
            playerState.score += 10;
        }
        playerState.kills += 1;
        uiController.updatePlayerScoreboard(player)
    }

    shouldProcessAssist(eventInfo: PlayerCombatEventInfo): boolean {
        return !sameTeam(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer));
    }

    processAssist(eventInfo: PlayerCombatEventInfo): void {
        const player = eventInfo.eventPlayer;
        const playerState = getPlayerState(player);

        playerState.score += 50;
        playerState.assists += 1;
        uiController.updatePlayerScoreboard(player)
    }

    processRevive(eventInfo: PlayerCombatEventInfo): void {
        const revivedPlayer = eventInfo.eventOtherPlayer;
        const revivedPlayerState = getPlayerState(revivedPlayer);

        revivedPlayerState.score += 100;
        revivedPlayerState.revives += 1;
        uiController.updatePlayerScoreboard(revivedPlayer)
    }

    onUndeploy(eventInfo: PlayerEventInfo): void {
        const player = eventInfo.eventPlayer;
        const playerState = getPlayerState(player);
        const teamState = tryGetTeamState(playerState.team);

        if (playerState.captureSessionActive && isDefined(playerState.currentCapturePoint)) {
            capturePointController.updatePlayerCountOnDeath(eventInfo);
            capturePointController.refreshCaptureUIForPlayerObjective(player);
        }
        if (!playerState.isCustomAI) {
            if (FLAGS.PLAYER_DEATHS_BLEED && teamState) {
                teamState.score -= 1;
            }
            playerState.deaths += 1;
            uiController.updatePlayerScoreboard(player)
            uiController.updateScoreboard()
        }
        playerState.captureSessionActive = false;
    }

    shouldUndeploy(_eventInfo: PlayerEventInfo): boolean {
        return isGameOngoing;
    }

    shouldEnterAreaTrigger(eventInfo: { eventPlayer: mod.Player; eventAreaTrigger: mod.AreaTrigger }): boolean {
        return this.isOutOfBoundsAreaTrigger(eventInfo.eventAreaTrigger, mod.GetTeam(eventInfo.eventPlayer));
    }

    shouldExitAreaTrigger(eventInfo: { eventPlayer: mod.Player; eventAreaTrigger: mod.AreaTrigger }): boolean {
        const player = eventInfo.eventPlayer;
        const triggerId = mod.GetObjId(eventInfo.eventAreaTrigger);
        return triggerId === CONFIG.INVISIBLE_WALL_TRIGGER_ID ||
            this.isOutOfBoundsAreaTrigger(eventInfo.eventAreaTrigger, mod.GetTeam(player)) ||
            !isAlivePlayer(player);
    }

    private isOutOfBoundsAreaTrigger(areaTrigger: mod.AreaTrigger, playerTeam: mod.Team): boolean {
        const triggerId = mod.GetObjId(areaTrigger);
        if (triggerId === CONFIG.INVISIBLE_WALL_TRIGGER_ID) return false;
        const isTeam2RestrictedArea = triggerId >= 1100 && triggerId < 1200 && mod.Equals(playerTeam, mod.GetTeam(2));
        const isTeam1RestrictedArea = triggerId >= 1200 && triggerId < 1300 && mod.Equals(playerTeam, mod.GetTeam(1));
        const isSharedRestrictedArea = triggerId >= 1300 && triggerId < 1400;

        return isTeam2RestrictedArea || isTeam1RestrictedArea || isSharedRestrictedArea;
    }

    enterAreaTrigger(eventInfo: { eventPlayer: mod.Player; eventAreaTrigger: mod.AreaTrigger }): void {
        if (!getPlayerState(eventInfo.eventPlayer).isOutOfBounds) {
            this.handleOutOfBounds(eventInfo)
        }
    }

    shouldEnterInvisibleWallTrigger(eventInfo: { eventPlayer: mod.Player; eventAreaTrigger: mod.AreaTrigger }): boolean {
        return mod.GetObjId(eventInfo.eventAreaTrigger) === CONFIG.INVISIBLE_WALL_TRIGGER_ID;
    }

    async enterInvisibleWallTrigger(eventInfo: { eventPlayer: mod.Player; eventAreaTrigger: mod.AreaTrigger }): Promise<void> {
        const player = eventInfo.eventPlayer;
        const playerState = getPlayerState(player);
        playerState.invisibleWallTriggered = true;
        playerState.lastPosition = mod.GetObjectPosition(player);
        const velocity = mod.GetSoldierState(player, mod.SoldierStateVector.GetLinearVelocity);
        playerState.lastMovement = mod.CreateVector(mod.XComponentOf(velocity), 0, mod.ZComponentOf(velocity));
        const rotation = mod.GetObjectRotation(player);
        playerState.lastRotation = mod.RoundToInteger(mod.XComponentOf(rotation)) === 0
            ? mod.Add(mod.XComponentOf(rotation), mod.YComponentOf(rotation))
            : mod.Subtract(mod.XComponentOf(rotation), mod.YComponentOf(rotation));

        if (mod.GetSoldierState(player, mod.SoldierStateBool.IsVaulting)) {
            await mod.Wait(0.35)
        }
        playerState.pushBackDistance = isPlayerInVehicle(player) ? -5 : -0.6;
        const movementDirection = mod.DistanceBetween(playerState.lastMovement, ZERO_VECTOR) > 0
            ? mod.Normalize(playerState.lastMovement)
            : mod.ForwardVector();
        mod.Teleport(
            player,
            mod.Add(playerState.lastPosition, mod.Multiply(movementDirection, playerState.pushBackDistance)),
            playerState.lastRotation)
    }

    exitAreaTrigger(eventInfo: { eventPlayer: mod.Player; eventAreaTrigger: mod.AreaTrigger }): void {
        const playerState = getPlayerState(eventInfo.eventPlayer);
        if (mod.GetObjId(eventInfo.eventAreaTrigger) === CONFIG.INVISIBLE_WALL_TRIGGER_ID) {
            playerState.invisibleWallTriggered = false;
            return;
        }
        this.disableOutOfBounds(eventInfo)
    }

    async applyRepelForce(time: number, eventInfo: { eventPlayer: mod.Player; eventInteractPoint: mod.InteractPoint }): Promise<void> {
        const player = eventInfo.eventPlayer;
        const repelObject = mod.GetSpatialObject(mod.GetObjId(eventInfo.eventInteractPoint) + 50);
        if (!isDefined(repelObject)) return;

        const playerPosition = mod.GetObjectPosition(player);
        const repelPosition = mod.GetObjectPosition(repelObject);
        const playerRotationY = mod.YComponentOf(mod.GetObjectRotation(player));
        const targetRotation = mod.CreateVector(0, playerRotationY, 0);

        if (mod.YComponentOf(repelPosition) > mod.YComponentOf(playerPosition)) {
            const targetPosition = mod.Add(
                mod.CreateVector(
                    mod.XComponentOf(playerPosition),
                    mod.YComponentOf(repelPosition),
                    mod.ZComponentOf(playerPosition)),
                mod.UpVector());
            mod.SetObjectTransformOverTime(player, mod.CreateTransform(targetPosition, targetRotation), time, false, false)
        } else {
            const targetPosition = mod.CreateVector(
                mod.XComponentOf(repelPosition),
                mod.YComponentOf(playerPosition),
                mod.ZComponentOf(repelPosition));
            mod.Teleport(player, targetPosition, playerRotationY)
            await mod.Wait(0.1)
            const finalPosition = mod.Add(repelPosition, mod.Multiply(mod.UpVector(), 3));
            const finalTransform = mod.CreateTransform(finalPosition, targetRotation);
            mod.SetObjectTransformOverTime(player, finalTransform, time, false, false)
        }
        await mod.Wait(time + 0.1)
        mod.Teleport(player, repelPosition, playerRotationY)
    }

    async handleTeamSwitchAndRepel(eventInfo: { eventPlayer: mod.Player; eventInteractPoint: mod.InteractPoint }): Promise<void> {
        const player = eventInfo.eventPlayer;
        const interactPoint = eventInfo.eventInteractPoint;
        const interactPointId = mod.GetObjId(interactPoint);
        const playerState = getPlayerState(player);

        if (FLAGS.ENABLE_TEAM_SWITCHING &&
            (mod.Equals(mod.GetInteractPoint(998), interactPoint) || mod.Equals(mod.GetInteractPoint(999), interactPoint))) {
            const oldTeamState = getTeamState(playerState.team);
            playerState.ignoreOOB = true;
            mod.UndeployPlayer(player)
            mod.SetTeam(player, oldTeamState.otherTeam)
            updatePlayerTeam(player);
            getTeamState(playerState.team).score += 1;
            playerState.deaths -= 1;
            uiController.updatePlayerScoreboard(player)
            await mod.Wait(2)
            playerState.ignoreOOB = false;
        }

        if (interactPointId >= 700 && interactPointId < 750) {
            const repelOrigin = mod.GetSpatialObject(interactPointId + 50);
            const repelForce = mod.DistanceBetween(
                mod.GetObjectPosition(player),
                mod.GetObjectPosition(repelOrigin)) / 8;
            await this.applyRepelForce(repelForce, eventInfo)
        }
    }

    async handleOutOfBounds(eventInfo: PlayerEventInfo): Promise<void> {
        const player = eventInfo.eventPlayer;
        const playerState = getPlayerState(player);

        if (playerState.ignoreOOB || playerState.isOutOfBounds || !isAlivePlayer(player)) return;

        playerState.isOutOfBounds = true;
        mod.SkipManDown(player, true)

        if (isAISoldier(player)) {
            for (let countdown = 10; countdown >= 0; countdown -= 1) {
                playerState.outOfBoundsCountdown = countdown;
                await waitUntil(1, () => !playerState.isOutOfBounds)
                if (!playerState.isOutOfBounds) {
                    break
                }
            }
            if (playerState.isOutOfBounds && mod.IsPlayerValid(player)) {
                mod.DealDamage(player, 10000, player)
            }
            playerState.outOfBoundsCountdown = -1;
            return;
        }

        uiController.togglePlayerOOBUI(true, eventInfo)
        for (let countdown = 10; countdown >= 0; countdown -= 1) {
            playerState.outOfBoundsCountdown = countdown;
            uiController.updateOOBUI(player, playerState.outOfBoundsCountdown)
            mod.PlaySound(audio.oobSound!, 0.7, player)
            await waitUntil(1, () => !playerState.isOutOfBounds)
            if (!playerState.isOutOfBounds) {
                break
            }
        }
        if (playerState.isOutOfBounds && mod.IsPlayerValid(player)) {
            mod.DealDamage(player, 10000, player)
        }
        uiController.togglePlayerOOBUI(false, eventInfo)
        playerState.outOfBoundsCountdown = -1;
    }

    async undeployIfSpawnedOutOfBounds(eventInfo: PlayerEventInfo): Promise<void> {
        await mod.Wait(0.1)
        const player = eventInfo.eventPlayer;
        if (!mod.IsPlayerValid(player)) return;

        const playerState = getPlayerState(player);
        if (!playerState.isOutOfBounds && !playerState.invisibleWallTriggered) return;

        playerState.deaths -= 1;
        await mod.Wait(0.6)
        if (!mod.IsPlayerValid(player)) return;

        playerState.ignoreOOB = true;
        playerState.invisibleWallTriggered = false;
        mod.UndeployPlayer(player)
        mod.DisplayNotificationMessage(mod.Message("Spawn Out of Bounds"), player)
        await mod.Wait(2)
        playerState.ignoreOOB = false;
    }

    addEquipment(player: mod.Player): void {
        if (FLAGS.GIVE_PLAYERS_NVG) {
            mod.AddEquipment(player, mod.Gadgets.Mask_NVG)
        } else if (FLAGS.GIVE_PLAYERS_GAS_MASK) {
            mod.AddEquipment(player, mod.Gadgets.Mask_Gas)
        }

        if (!nightMode) return;
        mod.EnableScreenEffect(player, mod.ScreenEffects.Night, true)
        if (!isAISoldier(player) || !isDefined(nightWeaponPackage)) return;

        if (mod.IsSoldierClass(player, mod.SoldierClass.Assault)) {
            mod.AddEquipment(player, mod.Weapons.AssaultRifle_M433, nightWeaponPackage)
        } else if (mod.IsSoldierClass(player, mod.SoldierClass.Engineer)) {
            mod.AddEquipment(player, mod.Weapons.Carbine_M4A1, nightWeaponPackage)
        } else if (mod.IsSoldierClass(player, mod.SoldierClass.Support)) {
            mod.AddEquipment(player, mod.Weapons.LMG_M123K, nightWeaponPackage)
        }
    }

    disableOutOfBounds(eventInfo: PlayerEventInfo): void {
        if (getPlayerState(eventInfo.eventPlayer).isOutOfBounds) {
            getPlayerState(eventInfo.eventPlayer).isOutOfBounds = false;
            mod.SkipManDown(eventInfo.eventPlayer, false)
        }
    }

    async onJoin(player: mod.Player): Promise<void> {
        initPlayerState(player);
        await mod.Wait(1)

        if (!mod.IsPlayerValid(player)) return;

        uiController.updatePlayerScoreboard(player)
        if (isAISoldier(player)) return;

        uiController.setupPlayerUI(player)
        await mod.Wait(5)
        if (isGameOngoing) {
            await mod.Wait(0.1)
            conquestGame.resetFX({ eventPlayer: player })
        }
    }

    onLeave(playerId: number): void {
        removePlayerStateById(playerId);
    }

    async handleDeath(eventInfo: PlayerCombatEventInfo): Promise<void> {
        const player = eventInfo.eventPlayer;

        await mod.Wait(0.1)
        const playerState = getPlayerState(player);
        if (playerState.isOutOfBounds) {
            this.disableOutOfBounds(eventInfo)
        }
        if (!playerState.isCustomAI) return;

        if (isGameOngoing && FLAGS.PLAYER_DEATHS_BLEED && mod.NotEqualTo(player, eventInfo.eventOtherPlayer)) {
            getTeamState(playerState.team).score -= 1;
            uiController.updateScoreboard()
        }
        playerState.deaths += 1;
        uiController.updatePlayerScoreboard(player)

        const playerPosition = mod.GetObjectPosition(player);
        const closestTeammate = mod.ClosestPlayerTo(playerPosition, playerState.team);
        if (mod.IsPlayerValid(closestTeammate) &&
            mod.DistanceBetween(playerPosition, mod.GetObjectPosition(closestTeammate)) > 20) {
            await mod.Wait(3)
            if (mod.IsPlayerValid(player)) {
                mod.UndeployPlayer(player)
            }
        } else {
            await mod.Wait(14)
            if (mod.IsPlayerValid(player) && mod.GetSoldierState(player, mod.SoldierStateBool.IsManDown)) {
                mod.UndeployPlayer(player)
            }
        }
    }
}

class CapturePointController {
    setupCapturePoint(cp: mod.CapturePoint): void {
        mod.SetCapturePointCapturingTime(cp, CONFIG.FLAG_CAPTURE_TIME)
        mod.SetCapturePointNeutralizationTime(cp, CONFIG.FLAG_NEUTRAL_TIME)
        mod.EnableGameModeObjective(cp, true)
        mod.SetMaxCaptureMultiplier(cp, 3)
    }

    processObjectivePlayerData(player: mod.Player, captured: boolean): void {
        getPlayerState(player).captures += 1;
        getPlayerState(player).score += 200;
        uiController.updatePlayerScoreboard(player)
        const sound = captured ? audio.capturedSound : audio.neutraliseSound;
        if (isDefined(sound)) {
            mod.PlaySound(sound, 0.7, player)
        }
    }

    async onCaptured(eventInfo: CapturePointEventInfo): Promise<void> {
        await mod.Wait(0.2)
        this.refreshObjectiveState(eventInfo.eventCapturePoint, true)
        uiController.updateScoreboard()
        const playersOnObjective = filterModArray(
            mod.GetPlayersOnPoint(eventInfo.eventCapturePoint),
            (currentArrayElement: any) => mod.Equals(
                mod.GetTeam(currentArrayElement),
                mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint)));
        for (let i = 0; i < mod.CountOf(playersOnObjective); i++) {
            const player = mod.ValueInArray(playersOnObjective, i) as mod.Player;
            this.processObjectivePlayerData(player, true)
            if (getPlayerState(player).isCustomAI) {
                aiController.startScouting(player)
            }
        }
        this.spawnObjectiveVehicles(eventInfo)
        if (FLAGS.ENABLE_VO) {
            const objective = getObjectiveByCapturePoint(eventInfo.eventCapturePoint);
            if (objective?.voiceFlag !== null && objective?.voiceFlag !== undefined) {
                mod.PlayVO(audio.vo1!, mod.VoiceOverEvents2D.ObjectiveCaptured, objective.voiceFlag, mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint))
                mod.PlayVO(audio.vo2!, mod.VoiceOverEvents2D.ObjectiveCapturedEnemy, objective.voiceFlag, getTeamState(mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint)).otherTeam)
            }
        }
    }

    async runProgressLoop(eventInfo: CapturePointEventInfo): Promise<void> {
        while (!isGameOngoing) { await waitUntil(999, () => isGameOngoing, 1) }
        if (FLAGS.CONQUEST_ASSAULT) {
            mod.SetCapturePointOwner(eventInfo.eventCapturePoint, mod.GetTeam(2))
        }
        await mod.Wait(mod.RandomReal(0, 1))
        const cpState = getObjectiveState(eventInfo.eventCapturePoint);
        if (!cpState) return;

        cpState.progress = mod.GetCaptureProgress(eventInfo.eventCapturePoint);
        cpState.lastOwnerTeamId = mod.GetObjId(mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint));
        cpState.setProgressVisuals(cpState.progress);
        this.refreshObjectiveState(eventInfo.eventCapturePoint, true)
        while (true) {
            const currentProgress = mod.GetCaptureProgress(eventInfo.eventCapturePoint);
            const currentOwnerTeamId = mod.GetObjId(mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint));
            cpState.uiSyncTick += 1;
            const progressChanged = mod.NotEqualTo(cpState.progress, currentProgress);
            const ownerChanged = cpState.lastOwnerTeamId !== currentOwnerTeamId;
            const periodicSync = cpState.uiSyncTick >= 3;

            uiController.flashCaptureProgressUI(eventInfo.eventCapturePoint, capturePointFlash)
            if (progressChanged || ownerChanged || periodicSync) {
                this.refreshObjectiveState(eventInfo.eventCapturePoint, ownerChanged)
                if (periodicSync) {
                    cpState.uiSyncTick = 0;
                }
            }
            cpState.progress = currentProgress;
            cpState.lastOwnerTeamId = currentOwnerTeamId;
            await mod.Wait(0.1)
        }
    }

    async onLostNeutralised(eventInfo: CapturePointEventInfo): Promise<void> {
        uiController.updateFlagIcons()
        await mod.Wait(0.2)
        this.refreshObjectiveState(eventInfo.eventCapturePoint, true)
        uiController.updateScoreboard()

        const neutralisingTeam = mod.GetOwnerProgressTeam(eventInfo.eventCapturePoint);
        const playersOnObjective = filterModArray(
            mod.GetPlayersOnPoint(eventInfo.eventCapturePoint),
            (currentArrayElement: any) => mod.Equals(mod.GetTeam(currentArrayElement), neutralisingTeam));
        for (let i = 0; i < mod.CountOf(playersOnObjective); i++) {
            this.processObjectivePlayerData(mod.ValueInArray(playersOnObjective, i) as mod.Player, false)
        }

        const objective = getObjectiveByCapturePoint(eventInfo.eventCapturePoint);
        const voiceFlag = objective?.voiceFlag;
        if (voiceFlag === null || voiceFlag === undefined) return;

        if (mod.NotEqualTo(mod.GetPreviousOwnerTeam(eventInfo.eventCapturePoint), mod.GetTeam(0))) {
            mod.PlayVO(audio.vo3!, mod.VoiceOverEvents2D.ObjectiveNeutralised, voiceFlag, neutralisingTeam)
            mod.PlayVO(audio.vo4!, mod.VoiceOverEvents2D.ObjectiveLost, voiceFlag, mod.GetPreviousOwnerTeam(eventInfo.eventCapturePoint))
        } else {
            mod.PlayVO(audio.vo3!, mod.VoiceOverEvents2D.ObjectiveCapturing, voiceFlag, neutralisingTeam)
        }
    }

    spawnObjectiveVehicles(eventInfo: CapturePointEventInfo): void {
        const objective = getObjectiveByCapturePoint(eventInfo.eventCapturePoint);
        if (!objective || !objective.hasVehicleSpawners()) return;

        const ownerTeam = mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint);
        const activeSpawner = objective.getVehicleSpawnerForTeam(ownerTeam);
        const inactiveSpawner = objective.getOtherVehicleSpawnerForTeam(ownerTeam);
        if (!isDefined(activeSpawner) || !isDefined(inactiveSpawner)) return;

        mod.SetVehicleSpawnerAutoSpawn(activeSpawner, true)
        mod.SetVehicleSpawnerAutoSpawn(inactiveSpawner, false)
    }

    shouldShowCaptureUI(eventInfo: PlayerCapturePointEventInfo): boolean {
        return !getPlayerState(eventInfo.eventPlayer).captureSessionActive;
    }

    shouldHideCaptureUI(eventInfo: PlayerCapturePointEventInfo): boolean {
        return getPlayerState(eventInfo.eventPlayer).captureSessionActive;
    }

    shouldUpdatePlayerCountOnDeath(eventInfo: PlayerEventInfo): boolean {
        return getPlayerState(eventInfo.eventPlayer).captureSessionActive;
    }

    shouldUpdatePlayerCountOnRevive(eventInfo: PlayerEventInfo): boolean {
        return getPlayerState(eventInfo.eventPlayer).captureSessionActive;
    }

    private updatePlayersOnPointCounts(capturePoint: mod.CapturePoint, playerTeam: mod.Team): void {
        const teamState = getTeamState(playerTeam);
        const playersOnPoint = mod.GetPlayersOnPoint(capturePoint);

        this.updatePlayersOnPointForTeam(capturePoint, playerTeam, playersOnPoint);
        this.updatePlayersOnPointForTeam(capturePoint, teamState.otherTeam, playersOnPoint);
    }

    private updateAllPlayersOnPointCounts(capturePoint: mod.CapturePoint): void {
        const playersOnPoint = mod.GetPlayersOnPoint(capturePoint);
        this.updatePlayersOnPointForTeam(capturePoint, TEAM_1, playersOnPoint);
        this.updatePlayersOnPointForTeam(capturePoint, TEAM_2, playersOnPoint);
    }

    private refreshObjectiveState(capturePoint: mod.CapturePoint, forceFlagIconUpdate = false): void {
        const objective = getObjectiveState(capturePoint);
        const oldProgress = objective.progress;
        const currentProgress = mod.GetCaptureProgress(capturePoint);
        const ownerTeamId = mod.GetObjId(mod.GetCurrentOwnerTeam(capturePoint));

        this.updateAllPlayersOnPointCounts(capturePoint);
        objective.setProgressVisuals(currentProgress);
        uiController.manageCapturePointUI(capturePoint, oldProgress, { eventCapturePoint: capturePoint })

        if (forceFlagIconUpdate || objective.lastOwnerTeamId !== ownerTeamId) {
            uiController.updateFlagIcons()
        }
        objective.progress = currentProgress;
        objective.lastOwnerTeamId = ownerTeamId;
    }

    private updatePlayersOnPointForTeam(capturePoint: mod.CapturePoint, team: mod.Team, playersOnPoint = mod.GetPlayersOnPoint(capturePoint)): void {
        getObjectiveState(capturePoint).setPlayersOnPoint(team, this.countAlivePlayersOnPointForTeam(playersOnPoint, team))
    }

    private countAlivePlayersOnPointForTeam(playersOnPoint: mod.Array, team: mod.Team): number {
        return mod.CountOf(filterModArray(playersOnPoint, (player: any) => this.isValidAlivePlayerOnTeam(player, team)))
    }

    private isValidAlivePlayerOnTeam(player: mod.Player, team: mod.Team): boolean {
        return isAlivePlayer(player) && mod.Equals(mod.GetTeam(player), team);
    }

    async showCaptureUI(eventInfo: PlayerCapturePointEventInfo): Promise<void> {
        const player = eventInfo.eventPlayer;
        const capturePoint = eventInfo.eventCapturePoint;
        const playerState = getPlayerState(player);

        playerState.currentCapturePoint = capturePoint;
        playerState.capturePointState = mod.GetCaptureProgress(capturePoint);
        playerState.flagOwner = mod.GetTeam(3);

        drawnUICount += 1;

        await mod.Wait(0.05)
        this.refreshObjectiveState(capturePoint)
        playerState.captureSessionActive = true;
        getPlayerCondition(player, PlayerConditionSlot.ShowCaptureUI).update(false);

        if (!isAISoldier(player)) {
            playerState.captureProgressTick = 9;
            while (playerState.captureSessionActive && isGameOngoing) {
                if (!mod.IsPlayerValid(player)) {
                    break
                }
                if (isAlivePlayer(player)) {
                    uiController.togglePlayerCaptureUI(true, eventInfo)
                    uiController.updatePlayerCaptureUI(eventInfo)
                } else {
                    uiController.togglePlayerCaptureUI(false, eventInfo)
                }
                playerState.capturePointState = mod.GetCaptureProgress(capturePoint);
                playerState.flagOwner = mod.GetCurrentOwnerTeam(capturePoint);
                await waitUntil(0.15, () => !playerState.captureSessionActive)
            }
            playerState.captureSessionActive = false;
            getPlayerCondition(player, PlayerConditionSlot.HideCaptureUI).update(false);
            playerState.captureProgressTick = 0;
            uiController.togglePlayerCaptureUI(false, eventInfo)
        }
    }

    hideCaptureUI(eventInfo: PlayerCapturePointEventInfo): void {
        const playerState = getPlayerState(eventInfo.eventPlayer);
        this.refreshObjectiveState(eventInfo.eventCapturePoint)
        this.refreshCaptureUIForPlayerObjective(eventInfo.eventPlayer);
        playerState.captureSessionActive = false;
        getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.HideCaptureUI).update(false);
    }

    refreshCaptureUIForPlayerObjective(player: mod.Player): void {
        const playerState = getPlayerState(player);
        if (!isDefined(playerState.currentCapturePoint)) return;
        uiController.manageCapturePointUI(
            playerState.currentCapturePoint,
            playerState.capturePointState,
            { eventCapturePoint: playerState.currentCapturePoint })
    }

    updatePlayerCountOnDeath(eventInfo: PlayerEventInfo): void {
        const playerState = getPlayerState(eventInfo.eventPlayer);
        if (!isDefined(playerState.currentCapturePoint)) return;
        this.refreshObjectiveState(playerState.currentCapturePoint)
        this.refreshCaptureUIForPlayerObjective(eventInfo.eventPlayer);
    }

    updatePlayerCountOnRevive(eventInfo: PlayerEventInfo): void {
        const playerState = getPlayerState(eventInfo.eventPlayer);
        if (!isDefined(playerState.currentCapturePoint)) return;
        this.refreshObjectiveState(playerState.currentCapturePoint)
        this.refreshCaptureUIForPlayerObjective(eventInfo.eventPlayer);
    }
}
class AIController {
    shouldRetryMove(eventInfo: PlayerEventInfo): boolean {
        return getPlayerState(eventInfo.eventPlayer).isCustomAI;
    }

    retryMove(eventInfo: PlayerEventInfo): void {
        this.handleMoveFailOrReached(eventInfo);
    }

    shouldMoveSucceeded(eventInfo: PlayerEventInfo): boolean {
        return getPlayerState(eventInfo.eventPlayer).isCustomAI;
    }

    moveSucceeded(eventInfo: PlayerEventInfo): void {
        this.handleMoveFailOrReached(eventInfo);
    }

    shouldExitVehicle(eventInfo: { eventPlayer: mod.Player; eventVehicle: mod.Vehicle }): boolean {
        return getPlayerState(eventInfo.eventPlayer).isCustomAI;
    }

    exitVehicle(eventInfo: { eventPlayer: mod.Player; eventVehicle: mod.Vehicle }): void {
        this.startScouting(eventInfo.eventPlayer);
    }

    shouldTargetOnKill(eventInfo: PlayerCombatEventInfo): boolean {
        return getPlayerState(eventInfo.eventPlayer).isCustomAI && !isPlayerInVehicle(eventInfo.eventPlayer);
    }

    targetOnKill(eventInfo: PlayerCombatEventInfo): void {
        this.startScouting(eventInfo.eventPlayer)
        getPlayerState(eventInfo.eventPlayer).aiInAction = false;
    }

    shouldTargetOnKillAssist(eventInfo: PlayerCombatEventInfo): boolean {
        return getPlayerState(eventInfo.eventPlayer).isCustomAI &&
            mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer)) &&
            !isPlayerInVehicle(eventInfo.eventPlayer);
    }

    targetOnKillAssist(eventInfo: PlayerCombatEventInfo): void {
        this.startScouting(eventInfo.eventPlayer)
        getPlayerState(eventInfo.eventPlayer).aiInAction = false;
    }

    shouldScoutOnDeploy(eventInfo: PlayerEventInfo): boolean {
        return getPlayerState(eventInfo.eventPlayer).isCustomAI;
    }

    async deployScout(eventInfo: PlayerEventInfo): Promise<void> {
        getPlayerState(eventInfo.eventPlayer).isCustomAI = true;
        await mod.Wait(0.5)
        if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
            mod.SetPlayerIncomingDamageFactor(eventInfo.eventPlayer, 0.5)
            await this.deploy(eventInfo)
        }
    }

    shouldFindNewObjective(eventInfo: PlayerCapturePointEventInfo): boolean {
        return getPlayerState(eventInfo.eventPlayer).isCustomAI && !isPlayerInVehicle(eventInfo.eventPlayer);
    }

    async findNewObjective(eventInfo: PlayerCapturePointEventInfo): Promise<void> {
        if (mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint))) {
            await mod.Wait(1.5)
            const playerState = getPlayerState(eventInfo.eventPlayer);
            if (isDefined(playerState.aiTarget) && mod.IsType(playerState.aiTarget, mod.Types.CapturePoint)) {
                if (mod.Equals(eventInfo.eventCapturePoint, playerState.aiTarget)) {
                    if (isAlivePlayer(eventInfo.eventPlayer)) {
                        mod.AIDefendPositionBehavior(eventInfo.eventPlayer, mod.GetObjectPosition(playerState.aiTarget), 0, 20)
                    }
                }
            }
        } else {
            this.startScouting(eventInfo.eventPlayer)
        }
    }

    shouldReadyForAttack(eventInfo: PlayerEventInfo): boolean {
        return getPlayerState(eventInfo.eventPlayer).isCustomAI && mod.LessThanEqualTo(CONFIG.MAX_CUSTOM_AI, 70);
    }

    async readyForAttack(eventInfo: PlayerEventInfo): Promise<void> {
        const player = eventInfo.eventPlayer;
        const playerState = getPlayerState(player);
        const enemyTeam = getTeamState(playerState.team).otherTeam;

        const canEngageNearbyEnemy = () => isAlivePlayer(player) && !isPlayerInVehicle(player);

        const attackNearbyEnemy = (enemy: mod.Player) => {
            mod.AIDefendPositionBehavior(player, mod.GetObjectPosition(enemy), 10, 25)
            mod.AISetTarget(player, enemy)
            mod.AISetMoveSpeed(player, mod.MoveSpeed.InvestigateRun)
        };

        await mod.Wait(mod.RandomReal(2, 3))
        while (mod.IsPlayerValid(player)) {
            if (canEngageNearbyEnemy()) {
                const playerPosition = mod.GetObjectPosition(player);
                const closestEnemy = mod.ClosestPlayerTo(playerPosition, enemyTeam);
                if (mod.IsPlayerValid(closestEnemy) &&
                    mod.DistanceBetween(mod.GetObjectPosition(closestEnemy), playerPosition) < 25) {
                    attackNearbyEnemy(closestEnemy);
                    await mod.Wait(15)
                    if (!playerState.aiInAction) {
                        this.startScouting(player)
                    }
                }
            }
            await mod.Wait(1)
        }
    }

    shouldTargetDamager(eventInfo: PlayerCombatEventInfo): boolean {
        return getPlayerState(eventInfo.eventPlayer).isCustomAI &&
            !getPlayerState(eventInfo.eventPlayer).aiInAction &&
            mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer)) &&
            !isPlayerInVehicle(eventInfo.eventPlayer);
    }

    async targetDamager(eventInfo: PlayerCombatEventInfo): Promise<void> {
        getPlayerState(eventInfo.eventPlayer).aiInAction = true;
        mod.AIDefendPositionBehavior(eventInfo.eventPlayer, mod.GetObjectPosition(eventInfo.eventPlayer), 0, 15)
        mod.AISetMoveSpeed(eventInfo.eventPlayer, mod.MoveSpeed.InvestigateRun)
        mod.AISetTarget(eventInfo.eventPlayer, eventInfo.eventOtherPlayer)
        await mod.Wait(10)
        if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
            if (getPlayerState(eventInfo.eventPlayer).aiInAction) {
                this.startScouting(eventInfo.eventPlayer)
                getPlayerState(eventInfo.eventPlayer).aiInAction = false;
            }
        }
    }

    shouldEnterVehicle(eventInfo: { eventPlayer: mod.Player; eventVehicle: mod.Vehicle }): boolean {
        return getPlayerState(eventInfo.eventPlayer).isCustomAI;
    }

    async enterVehicle(eventInfo: { eventPlayer: mod.Player; eventVehicle: mod.Vehicle }): Promise<void> {
        await mod.Wait(1)
        if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
            getPlayerState(eventInfo.eventPlayer).startPosition = mod.GetObjectPosition(eventInfo.eventPlayer);
        }
        await mod.Wait(15)
        if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
            if (isPlayerInVehicle(eventInfo.eventPlayer)) {
                if (mod.LessThan(
                    mod.DistanceBetween(
                        mod.GetObjectPosition(eventInfo.eventPlayer),
                        getPlayerState(eventInfo.eventPlayer).startPosition!),
                    3)) {
                    mod.ForcePlayerExitVehicle(eventInfo.eventPlayer, mod.GetVehicleFromPlayer(eventInfo.eventPlayer))
                }
            }
        }
    }

    async handleMoveFailOrReached(eventInfo: PlayerEventInfo): Promise<void> {
        const player = eventInfo.eventPlayer;
        const playerState = getPlayerState(player);
        if (playerState.failMoveCount < 2) {
            mod.AIDefendPositionBehavior(player, mod.GetObjectPosition(player), 5, 20)
            playerState.failMoveCount += 1;
            await mod.Wait(5)
            if (mod.IsPlayerValid(player) && !playerState.aiInAction) {
                this.startScouting(player)
            }
        } else if (mod.IsPlayerValid(player)) {
            mod.UndeployPlayer(player)
        }
    }

    spawnAIObjectives(eventInfo: PlayerEventInfo): void {
        const player = eventInfo.eventPlayer;
        const playerState = getPlayerState(player);
        const playerTeam = playerState.team;
        const enemyTeam = getTeamState(playerTeam).otherTeam;
        const isConquestAssaultAttacker = FLAGS.CONQUEST_ASSAULT && mod.Equals(mod.GetTeam(2), playerTeam);

        const safeSpawnPoints: mod.CapturePoint[] = [];
        const teleportToSpawnObjectiveAndTryVehicle = () => {
            const spawnPoint = randomArrayValue(safeSpawnPoints);
            if (!isDefined(spawnPoint)) return;

            mod.Teleport(player, mod.GetObjectPosition(spawnPoint), 1)
            this.tryDeployNearbyAIVehicle(60, eventInfo)
        };

        if (!isPlayerInVehicle(player)) {
            for (const objective of objectives) {
                if (!objective) continue;

                const capturePoint = objective.getCapturePoint();
                const capturePointPosition = mod.GetObjectPosition(capturePoint);
                const closestEnemy = mod.ClosestPlayerTo(capturePointPosition, enemyTeam);
                if (mod.Equals(playerTeam, mod.GetCurrentOwnerTeam(capturePoint)) &&
                    (!mod.IsPlayerValid(closestEnemy) ||
                        mod.DistanceBetween(mod.GetObjectPosition(closestEnemy), capturePointPosition) > 40)) {
                    safeSpawnPoints.push(capturePoint);
                }
            }

            if (safeSpawnPoints.length > 0) {
                if (isConquestAssaultAttacker) {
                    teleportToSpawnObjectiveAndTryVehicle();
                } else if (mod.RoundToInteger(mod.RandomReal(0, 5)) < 5) {
                    teleportToSpawnObjectiveAndTryVehicle();
                } else {
                    this.tryDeployNearbyAIVehicle(150, eventInfo)
                }
            } else if (isConquestAssaultAttacker) {
                mod.UndeployPlayer(player)
            } else {
                this.tryDeployNearbyAIVehicle(150, eventInfo)
            }
        }
    }

    async tryDeployNearbyAIVehicle(distance: number, eventInfo: PlayerEventInfo): Promise<void> {
        const player = eventInfo.eventPlayer;
        if (!mod.IsPlayerValid(player) || isPlayerInVehicle(player)) return;
        if (mod.RoundToInteger(mod.RandomReal(0, 1)) !== 1) return;

        await mod.Wait(0.2)
        if (!mod.IsPlayerValid(player) || isPlayerInVehicle(player)) return;

        const playerPosition = mod.GetObjectPosition(player);
        const nearbyOpenVehicles = filterModArray(
            mod.AllVehicles(),
            (vehicle: any) => mod.CountOf(mod.GetAllPlayersInVehicle(vehicle)) < 2 &&
                mod.DistanceBetween(
                    mod.GetVehicleState(vehicle, mod.VehicleStateVector.VehiclePosition),
                    playerPosition) < distance);
        this.deployAIVehicle(mod.RandomValueInArray(nearbyOpenVehicles) as mod.Vehicle | undefined, distance, eventInfo)
    }

    deployAIVehicle(vehicle: mod.Vehicle | null | undefined, distance: number, eventInfo: PlayerEventInfo): void {
        if (!isDefined(vehicle)) return;

        const player = eventInfo.eventPlayer;
        if (mod.IsPlayerValid(player) && !isPlayerInVehicle(player)) {
            const vehiclePosition = mod.GetVehicleState(vehicle, mod.VehicleStateVector.VehiclePosition);
            const playerPosition = mod.GetObjectPosition(player);
            if (isDefined(vehiclePosition) &&
                isDefined(playerPosition) &&
                mod.DistanceBetween(vehiclePosition, playerPosition) < distance) {
                mod.AIBattlefieldBehavior(player)
                mod.ForcePlayerToSeat(player, vehicle, -1)
            }
        }
    }

    async deploy(eventInfo: PlayerEventInfo): Promise<void> {
        const player = eventInfo.eventPlayer;

        this.spawnAIObjectives(eventInfo)
        await mod.Wait(1)
        this.startScouting(player)
    }

    addAI(): void {
        if (!FLAGS.ENABLE_CUSTOM_AI || mod.CountOf(mod.AllPlayers()) >= CONFIG.MAX_CUSTOM_AI) return;

        const botNameCount = botNames.length;
        if (botNameCount <= 0) return;

        const players = mod.AllPlayers();
        const team1 = mod.GetTeam(1);
        const team2 = mod.GetTeam(2);
        const team1PlayerCount = mod.CountOf(filterModArray(
            players,
            (player: any) => mod.Equals(mod.GetTeam(player), team1)));
        const team2PlayerCount = mod.CountOf(filterModArray(
            players,
            (player: any) => mod.Equals(mod.GetTeam(player), team2)));

        if (team1PlayerCount > team2PlayerCount) {
            mod.SpawnAIFromAISpawner(mod.GetSpawner(902), mod.Message(botNames[botNameIndex]), team2)
        } else {
            mod.SpawnAIFromAISpawner(mod.GetSpawner(901), mod.Message(botNames[botNameIndex]), team1)
        }
        botNameIndex = (botNameIndex + 1) % botNameCount;
    }

    startScouting(player: mod.Player): void {
        if (!isAlivePlayer(player) || isPlayerInVehicle(player)) return;

        const playerState = getPlayerState(player);
        const playerTeam = playerState.team;
        const ownedCapturePoints: mod.CapturePoint[] = [];
        const enemyOwnedCapturePoints: mod.CapturePoint[] = [];

        for (const objective of objectives) {
            if (!objective) continue;

            const capturePoint = objective.getCapturePoint();
            if (mod.DistanceBetween(mod.GetObjectPosition(player), mod.GetObjectPosition(capturePoint)) >= 500) continue;

            if (sameTeam(playerTeam, mod.GetCurrentOwnerTeam(capturePoint))) {
                ownedCapturePoints.push(capturePoint);
            } else {
                enemyOwnedCapturePoints.push(capturePoint);
            }
        }

        if (enemyOwnedCapturePoints.length === 0) {
            const target = randomArrayValue(ownedCapturePoints);
            if (!isDefined(target)) {
                mod.UndeployPlayer(player)
                return;
            }
            playerState.aiTarget = target;
            mod.AIDefendPositionBehavior(player, mod.GetObjectPosition(target), 0, 30)
        } else {
            const target = randomArrayValue(enemyOwnedCapturePoints);
            if (!isDefined(target)) {
                mod.UndeployPlayer(player)
                return;
            }
            playerState.aiTarget = target;
            mod.AIMoveToBehavior(player, mod.GetObjectPosition(target))
        }

        const playerPosition = mod.GetObjectPosition(player);
        const closestEnemy = mod.ClosestPlayerTo(playerPosition, getTeamState(playerTeam).otherTeam);
        if (!mod.IsPlayerValid(closestEnemy)) {
            mod.AISetMoveSpeed(player, mod.MoveSpeed.Sprint)
            return;
        }

        const closestEnemyDistance = mod.DistanceBetween(mod.GetObjectPosition(closestEnemy), playerPosition);
        if (closestEnemyDistance > 30) {
            mod.AISetMoveSpeed(player, mod.MoveSpeed.Sprint)
        } else {
            mod.AISetMoveSpeed(player, mod.MoveSpeed.InvestigateRun)
        }
    }
}
class ConquestGame {
    shouldUpdateScoreTime(): boolean {
        return isGameOngoing && mod.RoundToInteger(mod.GetMatchTimeElapsed()) % 2 === 0;
    }

    shouldUpdateScoreTimeOddTick(): boolean {
        return isGameOngoing && mod.RoundToInteger(mod.GetMatchTimeElapsed()) % 2 === 1;
    }

    shouldTrackScore(): boolean {
        return isGameOngoing && mod.RoundToInteger(mod.GetMatchTimeElapsed()) % CONFIG.TICKET_BLEED_SPEED === 0;
    }

    shouldPlayNearEndMusic(): boolean {
        return isGameOngoing && (mod.GetMatchTimeRemaining() <= 60 || endMusicIntensity > 0);
    }

    shouldEndGame(): boolean {
        return isGameOngoing && (mod.GetMatchTimeRemaining() <= 1 ||
            getTeamState(TEAM_1).score <= 0 ||
            getTeamState(TEAM_2).score <= 0);
    }

    async updateScoreTimeAndAI(): Promise<void> {
        uiController.updateScoreboard()
        this.checkConquestAssaultWin()
        aiController.addAI()
        await mod.Wait(0.1)
        aiController.addAI()
        this.updateNearEndMusic()
    }

    async updateScoreTimeAndAISecondaryTick(): Promise<void> {
        uiController.updateScoreboard()
        aiController.addAI()
        await mod.Wait(0.1)
        aiController.addAI()
        this.updateNearEndMusic()
    }

    updateOwnedFlagCounts(): void {
        const team1State = getTeamState(TEAM_1);
        const team2State = getTeamState(TEAM_2);
        team1State.flagsOwned = 0;
        team2State.flagsOwned = 0;

        for (const objective of objectives) {
            if (!objective) continue;

            const ownerTeam = mod.GetCurrentOwnerTeam(objective.getCapturePoint());
            if (sameTeam(ownerTeam, TEAM_1)) {
                team1State.flagsOwned += 1;
            } else if (sameTeam(ownerTeam, TEAM_2)) {
                team2State.flagsOwned += 1;
            }
        }
    }

    trackScoreAndBleed(): void {
        const team1State = getTeamState(TEAM_1);
        const team2State = getTeamState(TEAM_2);
        this.updateOwnedFlagCounts();
        const team1OwnedCount = team1State.flagsOwned;
        const team2OwnedCount = team2State.flagsOwned;

        if (FLAGS.TOTAL_CONTROL_TICKET_BLEED) {
            const capturePointCount = activeObjectiveCount;
            if (team1OwnedCount === capturePointCount) {
                team2State.score -= CONFIG.TOTAL_CONTROL_BONUS;
            } else if (team2OwnedCount === capturePointCount) {
                team1State.score -= CONFIG.TOTAL_CONTROL_BONUS;
            }
        }

        if (FLAGS.LOSER_ONLY_TICKET_BLEED) {
            if (team2OwnedCount > team1OwnedCount) {
                team1State.score -= team2OwnedCount - team1OwnedCount;
                uiController.updateScoreboard()
                uiController.animateUIFlash("LeftFlash1", "RightFlash2")
            }
            if (team1OwnedCount > team2OwnedCount) {
                team2State.score -= team1OwnedCount - team2OwnedCount;
                uiController.updateScoreboard()
                uiController.animateUIFlash("RightFlash1", "LeftFlash2")
            }
        } else {
            team1State.score -= team2OwnedCount;
            team2State.score -= team1OwnedCount;
        }
    }

    playNearEndMusic(): void {
        mod.PlayMusic(mod.MusicEvents.Core_Overtime_Loop)
    }

    updateNearEndMusic(): void {
        if (!this.shouldPlayNearEndMusic()) return;

        if (mod.GreaterThan(
            mod.Multiply(mod.Divide(60, mod.GetMatchTimeRemaining()), 4),
            endMusicIntensity)) {
            mod.SetMusicParam(
                mod.MusicParams.Core_Urgency,
                mod.Subtract(4, mod.Multiply(mod.Divide(mod.GetMatchTimeRemaining(), 60), 4)))
        } else {
            mod.SetMusicParam(mod.MusicParams.Core_Urgency, mod.Subtract(4, endMusicIntensity))
        }
    }

    initGameSettings(): void {
        isGameOngoing = false;
        getTeamState(TEAM_1).startingScore = 2000;
        getTeamState(TEAM_2).startingScore = 1500;
        if (mod.Not(FLAGS.CONQUEST_ASSAULT)) {
            getTeamState(TEAM_1).startingScore = CONFIG.STARTING_SCORE;
            getTeamState(TEAM_2).startingScore = CONFIG.STARTING_SCORE;
        }
        getTeamState(TEAM_1).score = getTeamState(TEAM_1).startingScore;
        getTeamState(TEAM_2).score = getTeamState(TEAM_2).startingScore;
        getTeamState(TEAM_1).otherTeam = mod.GetTeam(2);
        getTeamState(TEAM_2).otherTeam = mod.GetTeam(1);
        scorePositionLeft = mod.CreateVector(-315, 45, 0);
        scorePositionRight = mod.CreateVector(315, 45, 0);
        friendlyTextColour = mod.CreateVector(0, 0.8, 1);
        friendlyBGColour = mod.CreateVector(0, 0.2, 0.5);
        enemyTextColour = mod.CreateVector(1, 0.2, 0.2);
        enemyBGColour = mod.CreateVector(0.6, 0.1, 0.1);
        isFXResetting = false;
    }

    setupNightWeaponPackage(): void {
        nightWeaponPackage = mod.CreateNewWeaponPackage();
        mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Bottom_Flashlight, nightWeaponPackage)
        mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Left_Flashlight, nightWeaponPackage)
        mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Right_Flashlight, nightWeaponPackage)
    }

    async setupMap(): Promise<void> {
        await waitForObjectiveRegistry()

        const spawnAudio = (asset: mod.RuntimeSpawn_Common) => mod.SpawnObject(asset, ZERO_VECTOR, ZERO_VECTOR, ZERO_VECTOR);
        const firstObjective = getFirstObjective();

        mod.SetGameModeTimeLimit(CONFIG.TIME_LIMIT)
        mod.SetGameModeTargetScore(1)
        mod.SetVehicleCategoryAllowedInSurroundingArea(mod.VehicleCategories.Air_All, true)

        getTeamState(TEAM_1).faction = mod.IsFaction(TEAM_1, mod.Factions.NATO) ? "NATO" : "PAX";
        getTeamState(TEAM_2).faction = mod.IsFaction(TEAM_2, mod.Factions.NATO) ? "NATO" : "PAX";

        uiController.setupMainUI()
        uiController.updateScoreboard()
        uiController.updateFlagIcons()
        if (FLAGS.ENABLE_SNOW && firstObjective) {
            snowVolume = mod.SpawnObject(
                mod.RuntimeSpawn_Common.EnvironmentDecalVolume_Winter_Event,
                mod.GetObjectPosition(firstObjective.getCapturePoint()),
                ZERO_VECTOR,
                mod.CreateVector(10000, 10000, 10000));
        }
        uiController.setupColourFilter()
        for (const objective of objectives) {
            if (!objective) continue;

            capturePointController.setupCapturePoint(objective.getCapturePoint())
        }
        mod.SetUnspawnDelayInSeconds(mod.GetSpawner(901), 300)
        mod.SetUnspawnDelayInSeconds(mod.GetSpawner(902), 300)
        uiController.showVersion()
        this.setupNightWeaponPackage()
        if (FLAGS.RANDOM_DAY_NIGHT && mod.RoundToInteger(mod.RandomReal(0, 1)) === 1) {
            nightMode = true;
        }

        audio.vo1 = spawnAudio(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D);
        audio.vo2 = spawnAudio(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D);
        audio.vo3 = spawnAudio(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D);
        audio.vo4 = spawnAudio(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D);
        audio.vo5 = spawnAudio(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D);
        audio.vo6 = spawnAudio(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D);
        audio.tickSoundTaking = spawnAudio(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_CapturingTickIcon_IsFriendly_OneShot2D);
        audio.tickSoundLosing = spawnAudio(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_CapturingTickEnemy_OneShot2D);
        audio.capturedSound = spawnAudio(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_OnCapturedByFriendly_OneShot2D);
        audio.neutraliseSound = spawnAudio(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Circuit_TerminalFriendlyCapturing_OneShot2D);
        audio.oobSound = spawnAudio(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_OutOfBounds_Countdown_OneShot2D);

        mod.LoadMusic(mod.MusicPackages.Core)
        await mod.Wait(2)
        mod.PlayMusic(mod.MusicEvents.Core_LastPhaseBegin)
        isGameOngoing = true;
        if (FLAGS.CONQUEST_ASSAULT) {
            mod.EnableHQ(mod.GetHQ(2), false)
        }
        for (let i = 2000; i < 2999; i++) {
            mod.EnableVFX(mod.GetVFX(i), true)
        }
        while (isGameOngoing) {
            for (let i = 10; i > 0; i -= 2) {
                capturePointFlash = i / 10;
                await mod.Wait(0.1)
            }
            for (let i = 0; i < 10; i += 2) {
                capturePointFlash = i / 10;
                await mod.Wait(0.1)
            }
        }
    }

    shouldPlayVOLowTime(): boolean {
        return isGameOngoing && FLAGS.ENABLE_VO && mod.LessThanEqualTo(mod.GetMatchTimeRemaining(), 300);
    }

    playVOLowTime(): void {
        mod.PlayVO(audio.vo5!, mod.VoiceOverEvents2D.TimeLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
        mod.PlayVO(audio.vo6!, mod.VoiceOverEvents2D.TimeLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
    }

    shouldPlayVOWinning(): boolean {
        return isGameOngoing && FLAGS.ENABLE_VO && mod.GreaterThan(
            getTeamState(TEAM_1).score,
            getTeamState(TEAM_2).score);
    }

    playVOWinning(): void {
        mod.PlayVO(audio.vo5!, mod.VoiceOverEvents2D.ProgressMidWinning, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
        mod.PlayVO(audio.vo6!, mod.VoiceOverEvents2D.ProgressMidLosing, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
    }

    shouldPlayVOTeam2Winning(): boolean {
        return isGameOngoing && FLAGS.ENABLE_VO && mod.GreaterThan(
            getTeamState(TEAM_2).score,
            getTeamState(TEAM_1).score);
    }

    playVOTeam2Winning(): void {
        mod.PlayVO(audio.vo5!, mod.VoiceOverEvents2D.ProgressMidWinning, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
        mod.PlayVO(audio.vo6!, mod.VoiceOverEvents2D.ProgressMidLosing, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
    }

    shouldPlayVOLowTickets(): boolean {
        return isGameOngoing && FLAGS.ENABLE_VO && mod.LessThanEqualTo(getTeamState(TEAM_1).score, CONFIG.LOW_TICKET_MUSIC_THRESHOLD);
    }

    playVOLowTickets(): void {
        mod.PlayVO(audio.vo5!, mod.VoiceOverEvents2D.PlayerCountFriendlyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
        mod.PlayVO(audio.vo6!, mod.VoiceOverEvents2D.PlayerCountEnemyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
    }

    shouldPlayVOTeam2LowTickets(): boolean {
        return isGameOngoing && FLAGS.ENABLE_VO && mod.LessThanEqualTo(getTeamState(TEAM_2).score, CONFIG.LOW_TICKET_MUSIC_THRESHOLD);
    }

    playVOTeam2LowTickets(): void {
        mod.PlayVO(audio.vo5!, mod.VoiceOverEvents2D.PlayerCountFriendlyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
        mod.PlayVO(audio.vo6!, mod.VoiceOverEvents2D.PlayerCountEnemyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
    }

    checkConquestAssaultWin(): void {
        if (!FLAGS.CONQUEST_ASSAULT || mod.GetMatchTimeElapsed() <= 120) return;

        this.updateOwnedFlagCounts();
        const team2AlivePlayerCount = mod.CountOf(filterModArray(
            mod.AllPlayers(),
            (currentArrayElement: any) => sameTeam(TEAM_2, mod.GetTeam(currentArrayElement)) && isAlivePlayer(currentArrayElement)));

        if (getTeamState(TEAM_2).flagsOwned === 0 && team2AlivePlayerCount === 0) {
            getTeamState(TEAM_2).score = 0;
        }
    }

    async resetFX(eventInfo: PlayerEventInfo): Promise<void> {
        while (isFXResetting) {
            await mod.Wait(1)
        }
        isFXResetting = true;
        for (let i = 2000; i < 2999; i++) {
            mod.EnableVFX(mod.GetVFX(i), false)
            mod.EnableVFX(mod.GetVFX(i), true)
            if (mod.Equals(
                mod.RoundToInteger(mod.Modulo(
                    i,
                    5)),
                0)) {
                await mod.Wait(0.066)
            }
        }
        isFXResetting = false;
    }

    async endGame(): Promise<void> {
        isGameOngoing = false;
        mod.PauseGameModeTime(true)
        if (mod.LessThan(
            getTeamState(TEAM_1).score,
            0)) {
            getTeamState(TEAM_1).score = 0;
        }
        if (mod.LessThan(
            getTeamState(TEAM_2).score,
            0)) {
            getTeamState(TEAM_2).score = 0;
        }
        if (mod.GreaterThan(
            getTeamState(TEAM_1).score,
            getTeamState(TEAM_2).score)) {
            mod.SetMusicParam(mod.MusicParams.Core_IsWinning, 1, mod.GetTeam(1))
        } else if (mod.GreaterThan(
            getTeamState(TEAM_2).score,
            getTeamState(TEAM_1).score)) {
            mod.SetMusicParam(mod.MusicParams.Core_IsWinning, 1, mod.GetTeam(2))
        } else {
        }
        scorePositionLeft = mod.CreateVector(-300, 385, 0);
        scorePositionRight = mod.CreateVector(300, 385, 0);
        uiController.updateScoreboard()
        uiController.teardownScoreUI()
        uiController.showEndGameUI("Team1ScoreLeft", scorePositionLeft)
        uiController.showEndGameUI("Team1ScoreRight", scorePositionRight)
        uiController.showEndGameUI("Team2ScoreLeft", scorePositionLeft)
        uiController.showEndGameUI("Team2ScoreRight", scorePositionRight)
        mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName("container2"), mod.CreateVector(0, 0, 0))
        mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName("container2"), 0.5)
        mod.SetUIWidgetBgFill(mod.FindUIWidgetWithName("container2"), mod.UIBgFill.Solid)
        mod.PlayMusic(mod.MusicEvents.Core_EndOfRound_Loop)
        await mod.Wait(4)
        if (mod.GreaterThan(
            getTeamState(TEAM_1).score,
            getTeamState(TEAM_2).score)) {
            mod.EndGameMode(mod.GetTeam(1))
        } else if (mod.GreaterThan(
            getTeamState(TEAM_2).score,
            getTeamState(TEAM_1).score)) {
            mod.EndGameMode(mod.GetTeam(2))
        } else {
            mod.EndGameMode(mod.GetTeam(0))
        }
        await mod.Wait(1.8)
        mod.SetCameraTypeForAll(mod.Cameras.Fixed, 950)
    }
}

const uiController = new UIController();
const playerController = new PlayerController();
const capturePointController = new CapturePointController();
const aiController = new AIController();
const conquestGame = new ConquestGame();

// ============================================================

function initGameSettingsRule() {
    const condition = getGlobalCondition(GlobalConditionSlot.InitGameSettings);
    const state = true;
    if (condition.update(state)) {
        conquestGame.initGameSettings();
    }
}

function setupMapRule() {
    const condition = getGlobalCondition(GlobalConditionSlot.SetupMap);
    const state = true;
    if (condition.update(state)) {
        conquestGame.setupMap();
    }
}

function updateScoreTimeRule() {
    const condition = getGlobalCondition(GlobalConditionSlot.UpdateScoreTime);
    const state = conquestGame.shouldUpdateScoreTime();
    if (condition.update(state)) {
        conquestGame.updateScoreTimeAndAI();
    }
}

function updateScoreTimeSecondaryTickRule() {
    const condition = getGlobalCondition(GlobalConditionSlot.UpdateScoreTimeSecondaryTick);
    const state = conquestGame.shouldUpdateScoreTimeOddTick();
    if (condition.update(state)) {
        conquestGame.updateScoreTimeAndAISecondaryTick();
    }
}

function trackScoreRule() {
    const condition = getGlobalCondition(GlobalConditionSlot.TrackScore);
    const state = conquestGame.shouldTrackScore();
    if (condition.update(state)) {
        conquestGame.trackScoreAndBleed();
    }
}

function processKillRule(eventInfo: PlayerCombatEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.ProcessKill);
    const state = playerController.shouldProcessKill(eventInfo);
    if (condition.update(state)) {
        playerController.processKill(eventInfo);
    }
}

function processAssistRule(eventInfo: PlayerCombatEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.ProcessAssist);
    const state = playerController.shouldProcessAssist(eventInfo);
    if (condition.update(state)) {
        playerController.processAssist(eventInfo);
    }
}

function processReviveRule(eventInfo: PlayerCombatEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.ProcessRevive);
    const state = true;
    if (condition.update(state)) {
        playerController.processRevive(eventInfo);
    }
}

function handlePlayerDeathRule(eventInfo: PlayerCombatEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.HandlePlayerDeath);
    const state = true;
    if (condition.update(state)) {
        playerController.handleDeath(eventInfo);
    }
}

function addEquipmentRule(eventInfo: PlayerEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.AddEquipment);
    const state = true;
    if (condition.update(state)) {
        playerController.addEquipment(eventInfo.eventPlayer);
    }
}

function undeployIfSpawnedOOBRule(eventInfo: PlayerEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.UndeployIfSpawnedOOB);
    const state = true;
    if (condition.update(state)) {
        playerController.undeployIfSpawnedOutOfBounds(eventInfo);
    }
}

function handlePlayerJoinRule(eventInfo: PlayerEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.HandlePlayerJoin);
    const state = true;
    if (condition.update(state)) {
        playerController.onJoin(eventInfo.eventPlayer);
    }
}

function updateDeathOnUndeployRule(eventInfo: PlayerEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.UpdateDeathOnUndeploy);
    const state = playerController.shouldUndeploy(eventInfo);
    if (condition.update(state)) {
        playerController.onUndeploy(eventInfo);
    }
}

function handleCapturePointCapturedRule(eventInfo: CapturePointEventInfo) {
    const condition = getCapturePointCondition(eventInfo.eventCapturePoint, CapturePointConditionSlot.HandleCaptured);
    const state = true;
    if (condition.update(state)) {
        capturePointController.onCaptured(eventInfo);
    }
}

function capturePointLostRule(eventInfo: CapturePointEventInfo) {
    const condition = getCapturePointCondition(eventInfo.eventCapturePoint, CapturePointConditionSlot.HandleLost);
    const state = true;
    if (condition.update(state)) {
        capturePointController.onLostNeutralised(eventInfo);
    }
}

function playNearEndMusicRule() {
    const condition = getGlobalCondition(GlobalConditionSlot.PlayNearEndMusic);
    const state = conquestGame.shouldPlayNearEndMusic();
    if (condition.update(state)) {
        conquestGame.playNearEndMusic();
    }
}

function endGameRule() {
    const condition = getGlobalCondition(GlobalConditionSlot.EndGame);
    const state = conquestGame.shouldEndGame();
    if (condition.update(state)) {
        conquestGame.endGame();
    }
}

function showCaptureUIRule(eventInfo: PlayerCapturePointEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.ShowCaptureUI);
    const state = capturePointController.shouldShowCaptureUI(eventInfo);
    if (condition.update(state)) {
        capturePointController.showCaptureUI(eventInfo);
    }
}

function hideCaptureUIRule(eventInfo: PlayerCapturePointEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.HideCaptureUI);
    const state = capturePointController.shouldHideCaptureUI(eventInfo);
    if (condition.update(state)) {
        capturePointController.hideCaptureUI(eventInfo);
    }
}

function updatePlayerCountOnDeathRule(eventInfo: PlayerEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.UpdatePlayerCountOnDeath);
    const state = capturePointController.shouldUpdatePlayerCountOnDeath(eventInfo);
    if (condition.update(state)) {
        capturePointController.updatePlayerCountOnDeath(eventInfo);
    }
}

function updatePlayerCountOnReviveRule(eventInfo: PlayerEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.UpdatePlayerCountOnRevive);
    const state = capturePointController.shouldUpdatePlayerCountOnRevive(eventInfo);
    if (condition.update(state)) {
        capturePointController.updatePlayerCountOnRevive(eventInfo);
    }
}

function handleTeamSwitchAndRepelRule(eventInfo: { eventPlayer: mod.Player; eventInteractPoint: mod.InteractPoint }) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.HandleTeamSwitchAndRepel);
    const state = true;
    if (condition.update(state)) {
        playerController.handleTeamSwitchAndRepel(eventInfo);
    }
}

function enterAreaTriggerRule(eventInfo: { eventPlayer: mod.Player; eventAreaTrigger: mod.AreaTrigger }) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.EnterAreaTrigger);
    const state = playerController.shouldEnterAreaTrigger(eventInfo);
    if (condition.update(state)) {
        playerController.enterAreaTrigger(eventInfo);
    }
}

function enterInvisibleWallTriggerRule(eventInfo: { eventPlayer: mod.Player; eventAreaTrigger: mod.AreaTrigger }) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.EnterInvisibleWallTrigger);
    const state = playerController.shouldEnterInvisibleWallTrigger(eventInfo);
    if (condition.update(state)) {
        playerController.enterInvisibleWallTrigger(eventInfo);
    }
}

function exitAreaTriggerRule(eventInfo: { eventPlayer: mod.Player; eventAreaTrigger: mod.AreaTrigger }) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.ExitAreaTrigger);
    const state = playerController.shouldExitAreaTrigger(eventInfo);
    if (condition.update(state)) {
        playerController.exitAreaTrigger(eventInfo);
    }
}

function playVOLowTimeRule() {
    const condition = getGlobalCondition(GlobalConditionSlot.PlayVOLowTime);
    const state = conquestGame.shouldPlayVOLowTime();
    if (condition.update(state)) {
        conquestGame.playVOLowTime();
    }
}

function playVOWinningRule() {
    const condition = getGlobalCondition(GlobalConditionSlot.PlayVOWinning);
    const state = conquestGame.shouldPlayVOWinning();
    if (condition.update(state)) {
        conquestGame.playVOWinning();
    }
}

function playVOTeam2WinningRule() {
    const condition = getGlobalCondition(GlobalConditionSlot.PlayVOTeam2Winning);
    const state = conquestGame.shouldPlayVOTeam2Winning();
    if (condition.update(state)) {
        conquestGame.playVOTeam2Winning();
    }
}

function playVOLowTicketsRule() {
    const condition = getGlobalCondition(GlobalConditionSlot.PlayVOLowTickets);
    const state = conquestGame.shouldPlayVOLowTickets();
    if (condition.update(state)) {
        conquestGame.playVOLowTickets();
    }
}

function playVOTeam2LowTicketsRule() {
    const condition = getGlobalCondition(GlobalConditionSlot.PlayVOTeam2LowTickets);
    const state = conquestGame.shouldPlayVOTeam2LowTickets();
    if (condition.update(state)) {
        conquestGame.playVOTeam2LowTickets();
    }
}

function runCaptureProgressRule(eventInfo: CapturePointEventInfo) {
    const condition = getCapturePointCondition(eventInfo.eventCapturePoint, CapturePointConditionSlot.RunProgressLoop);
    const state = true;
    if (condition.update(state)) {
        capturePointController.runProgressLoop(eventInfo);
    }
}

function aiScoutOnSpawnerSpawnedRule(eventInfo: PlayerEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.AIScoutOnSpawnerSpawned);
    const state = true;
    if (condition.update(state)) {
        aiController.deployScout(eventInfo);
    }
}

function aiFindNewObjectiveRule(eventInfo: PlayerCapturePointEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.AIFindNewObjective);
    const state = aiController.shouldFindNewObjective(eventInfo);
    if (condition.update(state)) {
        aiController.findNewObjective(eventInfo);
    }
}

function aiReadyForAttackRule(eventInfo: PlayerEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.AIReadyForAttack);
    const state = aiController.shouldReadyForAttack(eventInfo);
    if (condition.update(state)) {
        aiController.readyForAttack(eventInfo);
    }
}

function aiTargetDamagerRule(eventInfo: PlayerCombatEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.AITargetDamager);
    const state = aiController.shouldTargetDamager(eventInfo);
    if (condition.update(state)) {
        aiController.targetDamager(eventInfo);
    }
}

function aiExitVehicleRule(eventInfo: { eventPlayer: mod.Player; eventVehicle: mod.Vehicle }) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.AIExitVehicle);
    const state = aiController.shouldExitVehicle(eventInfo);
    if (condition.update(state)) {
        aiController.exitVehicle(eventInfo);
    }
}

function aiEnterVehicleRule(eventInfo: { eventPlayer: mod.Player; eventVehicle: mod.Vehicle }) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.AIEnterVehicle);
    const state = aiController.shouldEnterVehicle(eventInfo);
    if (condition.update(state)) {
        aiController.enterVehicle(eventInfo);
    }
}

function aiRetryMoveRule(eventInfo: PlayerEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.AIRetryMove);
    const state = aiController.shouldRetryMove(eventInfo);
    if (condition.update(state)) {
        aiController.retryMove(eventInfo);
    }
}

function aiMoveSucceededRule(eventInfo: PlayerEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.AIMoveSucceeded);
    const state = aiController.shouldMoveSucceeded(eventInfo);
    if (condition.update(state)) {
        aiController.moveSucceeded(eventInfo);
    }
}

function aiTargetOnKillRule(eventInfo: PlayerCombatEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.AITargetOnKill);
    const state = aiController.shouldTargetOnKill(eventInfo);
    if (condition.update(state)) {
        aiController.targetOnKill(eventInfo);
    }
}

function aiTargetOnKillAssistRule(eventInfo: PlayerCombatEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.AITargetOnKillAssist);
    const state = aiController.shouldTargetOnKillAssist(eventInfo);
    if (condition.update(state)) {
        aiController.targetOnKillAssist(eventInfo);
    }
}

export function OngoingGlobal() {
    ensureStateInitialized();
    initGameSettingsRule();
    updateScoreTimeRule();
    updateScoreTimeSecondaryTickRule();
    trackScoreRule();
    playNearEndMusicRule();
    endGameRule();
    playVOLowTimeRule();
    playVOWinningRule();
    playVOTeam2WinningRule();
    playVOLowTicketsRule();
    playVOTeam2LowTicketsRule();
}

export function OnGameModeStarted() {
    ensureStateInitialized();
    setupMapRule();
}

export function OnPlayerEarnedKill(eventPlayer: mod.Player, eventOtherPlayer: mod.Player, eventDeathType: mod.DeathType, eventWeaponUnlock: mod.WeaponUnlock) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventOtherPlayer, eventDeathType, eventWeaponUnlock };
    processKillRule(eventInfo);
    aiTargetOnKillRule(eventInfo);
}

export function OnPlayerEarnedKillAssist(eventPlayer: mod.Player, eventOtherPlayer: mod.Player) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventOtherPlayer };
    processAssistRule(eventInfo);
    aiTargetOnKillAssistRule(eventInfo);
}

export function OnRevived(eventPlayer: mod.Player, eventOtherPlayer: mod.Player) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventOtherPlayer };
    processReviveRule(eventInfo);
    updatePlayerCountOnReviveRule(eventInfo);
}

export function OnPlayerDied(eventPlayer: mod.Player, eventOtherPlayer: mod.Player, eventDeathType: mod.DeathType, eventWeaponUnlock: mod.WeaponUnlock) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventOtherPlayer, eventDeathType, eventWeaponUnlock };
    handlePlayerDeathRule(eventInfo);
    updatePlayerCountOnDeathRule(eventInfo);
}

export function OnPlayerDeployed(eventPlayer: mod.Player) {
    ensureStateInitialized();
    updatePlayerTeam(eventPlayer);
    const eventInfo = { eventPlayer };
    addEquipmentRule(eventInfo);
    undeployIfSpawnedOOBRule(eventInfo);
}

export function OnPlayerJoinGame(eventPlayer: mod.Player) {
    ensureStateInitialized();
    updatePlayerTeam(eventPlayer);
    const eventInfo = { eventPlayer };
    handlePlayerJoinRule(eventInfo);
}

export function OnPlayerUndeploy(eventPlayer: mod.Player) {
    ensureStateInitialized();
    updatePlayerTeam(eventPlayer);
    const eventInfo = { eventPlayer };
    updateDeathOnUndeployRule(eventInfo);
}

export function OnCapturePointCaptured(eventCapturePoint: mod.CapturePoint) {
    ensureStateInitialized();
    const eventInfo = { eventCapturePoint };
    handleCapturePointCapturedRule(eventInfo);
}

export function OnCapturePointLost(eventCapturePoint: mod.CapturePoint) {
    ensureStateInitialized();
    const eventInfo = { eventCapturePoint };
    capturePointLostRule(eventInfo);
}

export function OnPlayerEnterCapturePoint(eventPlayer: mod.Player, eventCapturePoint: mod.CapturePoint) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventCapturePoint };
    showCaptureUIRule(eventInfo);
    aiFindNewObjectiveRule(eventInfo);
}

export function OnPlayerExitCapturePoint(eventPlayer: mod.Player, eventCapturePoint: mod.CapturePoint) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventCapturePoint };
    hideCaptureUIRule(eventInfo);
}

export function OnPlayerInteract(eventPlayer: mod.Player, eventInteractPoint: mod.InteractPoint) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventInteractPoint };
    handleTeamSwitchAndRepelRule(eventInfo);
}

export function OnPlayerEnterAreaTrigger(eventPlayer: mod.Player, eventAreaTrigger: mod.AreaTrigger) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventAreaTrigger };
    enterAreaTriggerRule(eventInfo);
    enterInvisibleWallTriggerRule(eventInfo);
}

export function OnPlayerExitAreaTrigger(eventPlayer: mod.Player, eventAreaTrigger: mod.AreaTrigger) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventAreaTrigger };
    exitAreaTriggerRule(eventInfo);
}

export function OngoingCapturePoint(eventCapturePoint: mod.CapturePoint) {
    ensureStateInitialized();
    const eventInfo = { eventCapturePoint: eventCapturePoint };
    runCaptureProgressRule(eventInfo);
}

export function OnSpawnerSpawned(eventPlayer: mod.Player, eventSpawner: mod.Spawner) {
    ensureStateInitialized();
    updatePlayerTeam(eventPlayer);
    const eventInfo = { eventPlayer };
    aiScoutOnSpawnerSpawnedRule(eventInfo);
    aiReadyForAttackRule(eventInfo);
}

export function OnPlayerDamaged(eventPlayer: mod.Player, eventOtherPlayer: mod.Player, eventDamageType: mod.DamageType, eventWeaponUnlock: mod.WeaponUnlock) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventOtherPlayer, eventDamageType, eventWeaponUnlock };
    aiTargetDamagerRule(eventInfo);
}

export function OnPlayerExitVehicle(eventPlayer: mod.Player, eventVehicle: mod.Vehicle) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventVehicle };
    aiExitVehicleRule(eventInfo);
}

export function OnPlayerEnterVehicle(eventPlayer: mod.Player, eventVehicle: mod.Vehicle) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventVehicle };
    aiEnterVehicleRule(eventInfo);
}

export function OnAIMoveToFailed(eventPlayer: mod.Player) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer };
    aiRetryMoveRule(eventInfo);
}

export function OnAIMoveToSucceeded(eventPlayer: mod.Player) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer };
    aiMoveSucceededRule(eventInfo);
}

export function OnPlayerLeaveGame(eventNumber: number) {
    ensureStateInitialized();
    playerController.onLeave(eventNumber);
}
