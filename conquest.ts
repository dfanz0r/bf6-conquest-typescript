
// ============================================================
// STATE FOUNDATION (Phase 1)
// ============================================================

// --- 1a. Config and Flags ---

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
} as const;

const FLAGS = {
    ENABLE_CUSTOM_AI: true,
    ENABLE_TEAM_SWITCHING: true,
    LOSER_ONLY_TICKET_BLEED: true,
    TOTAL_CONTROL_TICKET_BLEED: true,
    PLAYER_DEATHS_BLEED: true,
    ENABLE_VO: true,
    ENABLE_SNOW: false,
    GIVE_PLAYERS_NVG: false,
    CONQUEST_ASSAULT: false,
    BF3_COLOUR_FILTER: false,
    BF4_COLOUR_FILTER: false,
    SNOW_COLOUR_FILTER: false,
} as const;

// --- 1b. Runtime Globals ---

let isGameOngoing = false;
let isFXResetting = false;
let capturePointFlash = 0;
let botNameIndex = 0;

let scorePositionLeft: mod.Vector;
let scorePositionRight: mod.Vector;
let friendlyTextColour: mod.Vector;
let friendlyBGColour: mod.Vector;
let enemyTextColour: mod.Vector;
let enemyBGColour: mod.Vector;

// --- 1c. Spawned Object References ---

const audio = {
    vo1: null as mod.SpatialObject | null,
    vo2: null as mod.SpatialObject | null,
    vo3: null as mod.SpatialObject | null,
    vo4: null as mod.SpatialObject | null,
    vo5: null as mod.SpatialObject | null,
    vo6: null as mod.SpatialObject | null,
    tickSoundTaking: null as mod.SpatialObject | null,
    tickSoundLosing: null as mod.SpatialObject | null,
    capturedSound: null as mod.SpatialObject | null,
    oobSound: null as mod.SpatialObject | null,
};

let snowVolume: mod.SpatialObject | null = null;

// --- 1d. Static Native Arrays ---

const flagAnnounce: mod.VoiceOverFlags[] = [];
const flagLetters: string[] = [];
const botNames: string[] = [];
const uiIdPool: string[] = [];
const activeUiIds = new Set<string>();
const objectiveTrackingUI: string[] = [];

// --- 1e. Player State ---

class PlayerState {
    constructor(public player: mod.Player) {}

    uniqueUiId = "";
    score = 0;
    kills = 0;
    deaths = 0;
    assists = 0;
    captures = 0;
    revives = 0;

    currentCapturePoint: mod.CapturePoint | null = null;
    capturePointState = 0;
    flagOwner: mod.Team | null = null;
    captureTick = -1;
    isOnPoint = false;

    isOutOfBounds = false;
    ignoreOOB = false;

    aiTarget: mod.Player | mod.CapturePoint | null = null;
    aiInAction = false;
    aiSpawnPoints: mod.CapturePoint[] = [];
    startPosition: mod.Vector | null = null;
}

// --- 1f. Team State ---

class TeamState {
    faction: "NATO" | "PAX" = "NATO";
    score = 0;
    startingScore = 0;

    playersOnPoints = new Map<number, number>();
    capTextColours = new Map<number, mod.Vector>();
    capBGColours = new Map<number, mod.Vector>();
    capMessages = new Map<number, string>();
    capProgressColours = new Map<number, mod.Vector>();

    constructor(
        public team: mod.Team,
        public otherTeam: mod.Team,
    ) {}

    playersOnPoint(cpId: number): number {
        return this.playersOnPoints.get(cpId) ?? 0;
    }

    capTextColour(cpId: number): mod.Vector {
        return this.capTextColours.get(cpId) ?? mod.CreateVector(1, 1, 1);
    }

    capBGColour(cpId: number): mod.Vector {
        return this.capBGColours.get(cpId) ?? mod.CreateVector(0, 0, 0);
    }

    capMessage(cpId: number): string {
        return this.capMessages.get(cpId) ?? "";
    }

    capProgressColour(cpId: number): mod.Vector {
        return this.capProgressColours.get(cpId) ?? mod.CreateVector(0, 0, 0);
    }
}

// --- 1g. Capture Point State ---

class CapturePointState {
    id: number;
    progress = 0;
    uiSize: mod.Vector;
    uiPosition: mod.Vector;

    constructor(public capturePoint: mod.CapturePoint) {
        this.id = mod.GetObjId(capturePoint);
        this.uiSize = mod.CreateVector(0, 7, 0);
        this.uiPosition = mod.CreateVector(-110, 200, 0);
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

// --- 1h. Registries and Accessors ---

const playerStates = new Map<number, PlayerState>();
const teamStates = new Map<number, TeamState>();
const capturePointStates = new Map<number, CapturePointState>();

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

function getCapturePointState(cp: mod.CapturePoint): CapturePointState {
    const id = mod.GetObjId(cp);
    capturePointById.set(id, cp);

    let state = capturePointStates.get(id);
    if (!state) {
        state = new CapturePointState(cp);
        capturePointStates.set(id, state);
    } else {
        state.capturePoint = cp;
    }
    return state;
}

// --- 1i. Cached Handles ---

let stateInitialized = false;
let stateInitializing = false;

let TEAM_NEUTRAL: mod.Team;
let TEAM_1: mod.Team;
let TEAM_2: mod.Team;

const teamById = new Map<number, mod.Team>();
const capturePointById = new Map<number, mod.CapturePoint>();
const playerById = new Map<number, mod.Player>();

function ensureStateInitialized(): void {
    if (stateInitialized || stateInitializing) return;
    stateInitializing = true;

    try {
        TEAM_NEUTRAL = mod.GetTeam(0);
        TEAM_1 = mod.GetTeam(1);
        TEAM_2 = mod.GetTeam(2);

        teamById.set(mod.GetObjId(TEAM_NEUTRAL), TEAM_NEUTRAL);
        teamById.set(mod.GetObjId(TEAM_1), TEAM_1);
        teamById.set(mod.GetObjId(TEAM_2), TEAM_2);

        const allCPs = mod.AllCapturePoints();
        for (let i = 0; i < mod.CountOf(allCPs); i++) {
            const cp = mod.ValueInArray(allCPs, i) as mod.CapturePoint;
            getCapturePointState(cp);
        }

        initRuntimeValues();
        initTeams();
        initStaticArrays();

        stateInitialized = true;
    } finally {
        stateInitializing = false;
    }
}

// --- 1j. Initialization Functions ---

function initRuntimeValues(): void {
    isGameOngoing = false;
    isFXResetting = false;
    capturePointFlash = 0;
    botNameIndex = 0;

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

function initStaticArrays(): void {
    flagAnnounce.length = 0;
    flagLetters.length = 0;
    botNames.length = 0;
    objectiveTrackingUI.length = 0;
    uiIdPool.length = 0;
    activeUiIds.clear();

    // Fill these by migrating the existing initPlayerUIIds(), initObjectiveLetters(),
    // initObjectiveTeamUI(), initBotNames(), and initFlagCalls() data.
}

function initPlayerState(player: mod.Player): PlayerState {
    const state = getPlayerState(player);
    playerById.set(mod.GetObjId(player), player);

    state.captureTick = -1;
    state.isOnPoint = false;
    state.isOutOfBounds = false;
    state.ignoreOOB = false;
    state.aiInAction = false;

    return state;
}

function removePlayerStateById(playerId: number): void {
    const state = playerStates.get(playerId);
    if (state) {
        // TODO: releasePlayerUiId(state) when UI ID pool is migrated in Phase 7
        playerStates.delete(playerId);
    }
    playerById.delete(playerId);
}

// acquireUiId / releasePlayerUiId / rebuildUiIdPool
// will be added when UI ID pool is migrated in Phase 7.

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

    getConditionState(n: number): ConditionState {
        while (n >= this.conditionStates.length) {
            this.conditionStates.push(new ConditionState());
        }
        return this.conditionStates[n];
    }
}

let globalConditions = new Conditions();
let playerConditions: Conditions[] = [];
let capturePointConditions: Conditions[] = [];

function getGlobalCondition(n: number): ConditionState {
    return globalConditions.getConditionState(n);
}

function getPlayerCondition(player: mod.Player, n: number): ConditionState {
    const id = mod.GetObjId(player);
    while (id >= playerConditions.length) {
        playerConditions.push(new Conditions());
    }
    return playerConditions[id].getConditionState(n);
}

function getCapturePointCondition(cp: mod.CapturePoint, n: number): ConditionState {
    const id = mod.GetObjId(cp);
    while (id >= capturePointConditions.length) {
        capturePointConditions.push(new Conditions());
    }
    return capturePointConditions[id].getConditionState(n);
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

function initGameSettings() {
    mod.SetVariable(GameOngoingGlobalVar, false)
    mod.SetVariable(EnableCustomAIGlobalVar, true)
    mod.SetVariable(MaxCustomAIGlobalVar, 36)
    mod.SetVariable(EnableTeamSwitchingGlobalVar, true)
    mod.SetVariable(TimeLimitGlobalVar, 2700)
    mod.SetVariable(StartingScoreGlobalVar, 1500)
    mod.SetVariable(LowTicketMusicGlobalVar, 100)
    mod.SetVariable(LoserOnlyTicketBleedGlobalVar, true)
    mod.SetVariable(TotalControlTicketBleedGlobalVar, true)
    mod.SetVariable(TotalControlBonusGlobalVar, 10)
    mod.SetVariable(TicketBleedSpeedGlobalVar, 2)
    mod.SetVariable(PlayerDeathsBleedGlobalVar, true)
    mod.SetVariable(FlagCaptureTimeGlobalVar, 15)
    mod.SetVariable(FlagNeutralTimeGlobalVar, 20)
    mod.SetVariable(EnableVOGlobalVar, true)
    mod.SetVariable(EnableSnowGlobalVar, false)
    mod.SetVariable(Snow_ColourFilterGlobalVar, false)
    mod.SetVariable(BF3_ColourFilterGlobalVar, false)
    mod.SetVariable(BF4_ColourFilterGlobalVar, false)
    mod.SetVariable(GivePlayersNVGGlobalVar, false)
    mod.SetVariable(ConquestAssaultGlobalVar, false)
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), StartingScoreTeamVar), 2000)
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), StartingScoreTeamVar), 1500)
    if (mod.Not(mod.GetVariable(ConquestAssaultGlobalVar))) {
        mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), StartingScoreTeamVar), mod.GetVariable(StartingScoreGlobalVar))
        mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), StartingScoreTeamVar), mod.GetVariable(StartingScoreGlobalVar))
    }
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar), mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), StartingScoreTeamVar)))
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar), mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), StartingScoreTeamVar)))
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), OtherTeamTeamVar), mod.GetTeam(2))
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), OtherTeamTeamVar), mod.GetTeam(1))
    mod.SetVariable(ScorePositionLeftGlobalVar, mod.CreateVector(-315, 45, 0))
    mod.SetVariable(ScorePositionRightGlobalVar, mod.CreateVector(315, 45, 0))
    mod.SetVariable(FriendlyTextColourGlobalVar, mod.CreateVector(0, 0.8, 1))
    mod.SetVariable(FriendlyBGColourGlobalVar, mod.CreateVector(0, 0.2, 0.5))
    mod.SetVariable(EnemyTextColourGlobalVar, mod.CreateVector(1, 0.2, 0.2))
    mod.SetVariable(EnemyBGColourGlobalVar, mod.CreateVector(0.6, 0.1, 0.1))
    mod.SetVariable(resetFXingGlobalVar, false)
    mod.SetVariable(CapturePointProgressGlobalVar, mod.EmptyArray())
    mod.SetVariable(UniqueUI_ID_UsedGlobalVar, mod.EmptyArray())
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), PlayersOnPointTeamVar), mod.EmptyArray())
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), PlayersOnPointTeamVar), mod.EmptyArray())
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), Cap_TextColourTeamVar), mod.EmptyArray())
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), Cap_TextColourTeamVar), mod.EmptyArray())
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), Cap_BGColourTeamVar), mod.EmptyArray())
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), Cap_BGColourTeamVar), mod.EmptyArray())
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), Cap_MessageTeamVar), mod.EmptyArray())
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), Cap_MessageTeamVar), mod.EmptyArray())
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), Cap_ProgressTeamVar), mod.EmptyArray())
    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), Cap_ProgressTeamVar), mod.EmptyArray())
    mod.SetVariable(CaptureProgressSizeGlobalVar, mod.EmptyArray())
    mod.SetVariable(CaptureProgressPositionGlobalVar, mod.EmptyArray())
    initPlayerUIIds()
    initObjectiveLetters()
    initObjectiveTeamUI()
    initBotNames()
    initFlagCalls()
}
function initGameSettingsRule(conditionState: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    initGameSettings();
}

async function setupMap() {
    mod.SetGameModeTimeLimit(mod.GetVariable(TimeLimitGlobalVar))
    mod.SetGameModeTargetScore(1)
    mod.SetVehicleCategoryAllowedInSurroundingArea(mod.VehicleCategories.Air_All, true)
    if (mod.IsFaction(mod.GetTeam(1), mod.Factions.NATO)) {
        mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), FactionTeamVar), "NATO")
    } else {
        mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), FactionTeamVar), "PAX")
    }
    if (mod.IsFaction(mod.GetTeam(2), mod.Factions.NATO)) {
        mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), FactionTeamVar), "NATO")
    } else {
        mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), FactionTeamVar), "PAX")
    }
    setupMainUI()
    updateScoreboard()
    updateFlagIcons()
    if (mod.GetVariable(EnableSnowGlobalVar)) {
        mod.SetVariable(SnowGlobalVar, mod.SpawnObject(mod.RuntimeSpawn_Common.EnvironmentDecalVolume_Winter_Event, mod.GetObjectPosition(mod.GetCapturePoint(200)), mod.CreateVector(0, 0, 0), mod.CreateVector(10000, 10000, 10000)))
    }
    mod.AddUIContainer("container2", mod.CreateVector(0, 0, 0), mod.CreateVector(20000, 20000, 0), mod.UIAnchor.TopCenter)
    if (mod.GetVariable(BF3_ColourFilterGlobalVar)) {
        mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName("container2"), mod.CreateVector(0, 0.8, 1))
        mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName("container2"), 0.2)
        mod.SetUIWidgetBgFill(mod.FindUIWidgetWithName("container2"), mod.UIBgFill.Blur)
    } else if (mod.GetVariable(BF4_ColourFilterGlobalVar)) {
        mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName("container2"), mod.CreateVector(1, 0.5, 0))
        mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName("container2"), 0.2)
        mod.SetUIWidgetBgFill(mod.FindUIWidgetWithName("container2"), mod.UIBgFill.Blur)
    } else if (mod.GetVariable(Snow_ColourFilterGlobalVar)) {
        mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName("container2"), mod.CreateVector(0, 0.4, 0.7))
        mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName("container2"), 0.2)
        mod.SetUIWidgetBgFill(mod.FindUIWidgetWithName("container2"), mod.UIBgFill.Blur)
    } else {
        mod.SetUIWidgetBgFill(mod.FindUIWidgetWithName("container2"), mod.UIBgFill.None)
    }
    for (let i = 0; i < mod.CountOf(mod.AllCapturePoints()); i++) {
        setupCapturePoint(mod.ValueInArray(mod.AllCapturePoints(), i))
    }
    mod.SetUnspawnDelayInSeconds(mod.GetSpawner(901), 300)
    mod.SetUnspawnDelayInSeconds(mod.GetSpawner(902), 300)
    showVersion()
    mod.SetVariable(VO1GlobalVar, mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0)))
    mod.SetVariable(VO2GlobalVar, mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0)))
    mod.SetVariable(VO3GlobalVar, mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0)))
    mod.SetVariable(VO4GlobalVar, mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0)))
    mod.SetVariable(VO5GlobalVar, mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0)))
    mod.SetVariable(VO6GlobalVar, mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0)))
    mod.SetVariable(TickSoundTakingGlobalVar, mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_CapturingTickIcon_IsFriendly_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0)))
    mod.SetVariable(TickSoundLosingGlobalVar, mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_CapturingTickEnemy_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0)))
    mod.SetVariable(CapturedSoundGlobalVar, mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_OnCapturedByFriendly_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0)))
    mod.SetVariable(OOBSoundGlobalVar, mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_OutOfBounds_Countdown_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0)))
    mod.PlayMusic(mod.MusicEvents.Core_LastPhaseBegin)
    mod.LoadMusic(mod.MusicPackages.Core)
    await mod.Wait(2)
    mod.SetVariable(GameOngoingGlobalVar, true)
    if (mod.GetVariable(ConquestAssaultGlobalVar)) {
        mod.EnableHQ(mod.GetHQ(2), false)
    }
    for (let i = 2000; i < 2999; i++) {
        mod.EnableVFX(mod.GetVFX(i), true)
    }
    mod.SetVariable(GameOngoingGlobalVar, true)
    while (mod.GetVariable(GameOngoingGlobalVar)) {
        for (let i = 10; i < 0; i += -2) {
            mod.SetVariable(CapturepointFlashGlobalVar, i / 10)
            await mod.Wait(0.1)
        }
        for (let i = 0; i < 10; i += 2) {
            mod.SetVariable(CapturepointFlashGlobalVar, i / 10)
            await mod.Wait(0.1)
        }
    }
}
function setupMapRule(conditionState: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    setupMap();
}

function shouldUpdateScoreTime(): boolean {
    const newState = mod.And(mod.GetVariable(GameOngoingGlobalVar), mod.Equals(
        mod.Modulo(
            mod.RoundToInteger(mod.GetMatchTimeElapsed()),
            2),
        0))
    return newState;
}

async function updateScoreTimeAndAI() {
    updateScoreboard()
    addAI()
    await mod.Wait(0.1)
    addAI()
    checkConquestAssaultWin()
}
function updateScoreTimeRule(conditionState: any) {
    let newState = shouldUpdateScoreTime();
    if (!conditionState.update(newState)) {
        return;
    }
    updateScoreTimeAndAI();
}

function shouldUpdateScoreTimeOddTick(): boolean {
    const newState = mod.And(mod.GetVariable(GameOngoingGlobalVar), mod.Equals(
        mod.Modulo(
            mod.RoundToInteger(mod.GetMatchTimeElapsed()),
            2),
        1))
    return newState;
}

async function updateScoreTimeAndAISecondaryTick() {
    updateScoreboard()
    addAI()
    await mod.Wait(0.1)
    addAI()
}
function updateScoreTimeSecondaryTickRule(conditionState: any) {
    let newState = shouldUpdateScoreTimeOddTick();
    if (!conditionState.update(newState)) {
        return;
    }
    updateScoreTimeAndAISecondaryTick();
}

function shouldTrackScore(): boolean {
    const newState = mod.And(mod.GetVariable(GameOngoingGlobalVar), mod.Equals(
        mod.Modulo(
            mod.RoundToInteger(mod.GetMatchTimeElapsed()),
            mod.GetVariable(TicketBleedSpeedGlobalVar)),
        0))
    return newState;
}

function trackScoreAndBleed() {
    if (mod.GetVariable(TotalControlTicketBleedGlobalVar)) {
        if (isTrueForAll(mod.AllCapturePoints(), (currentArrayElement: any) => mod.Equals(
            mod.GetCurrentOwnerTeam(currentArrayElement),
            mod.GetTeam(1)))) {
            mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar), mod.Subtract(
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)),
                mod.GetVariable(TotalControlBonusGlobalVar)))
        } else if (isTrueForAll(mod.AllCapturePoints(), (currentArrayElement: any) => mod.Equals(
            mod.GetCurrentOwnerTeam(currentArrayElement),
            mod.GetTeam(2)))) {
            mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar), mod.Subtract(
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)),
                mod.GetVariable(TotalControlBonusGlobalVar)))
        } else {
        }
    }
    if (mod.GetVariable(LoserOnlyTicketBleedGlobalVar)) {
        if (mod.GreaterThan(
            mod.CountOf(filterModArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.Equals(
                    mod.GetCurrentOwnerTeam(currentArrayElement),
                    mod.GetTeam(2)))),
            mod.CountOf(filterModArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.Equals(
                    mod.GetCurrentOwnerTeam(currentArrayElement),
                    mod.GetTeam(1)))))) {
            mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar), mod.Subtract(
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)),
                mod.Subtract(
                    mod.CountOf(filterModArray(
                        mod.AllCapturePoints(),
                        (currentArrayElement: any) => mod.Equals(
                            mod.GetCurrentOwnerTeam(currentArrayElement),
                            mod.GetTeam(2)))),
                    mod.CountOf(filterModArray(
                        mod.AllCapturePoints(),
                        (currentArrayElement: any) => mod.Equals(
                            mod.GetCurrentOwnerTeam(currentArrayElement),
                            mod.GetTeam(1)))))))
            updateScoreboard()
            animateUIFlash("LeftFlash1", "RightFlash2")
        }
        if (mod.GreaterThan(
            mod.CountOf(filterModArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.Equals(
                    mod.GetCurrentOwnerTeam(currentArrayElement),
                    mod.GetTeam(1)))),
            mod.CountOf(filterModArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.Equals(
                    mod.GetCurrentOwnerTeam(currentArrayElement),
                    mod.GetTeam(2)))))) {
            mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar), mod.Subtract(
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)),
                mod.Subtract(
                    mod.CountOf(filterModArray(
                        mod.AllCapturePoints(),
                        (currentArrayElement: any) => mod.Equals(
                            mod.GetCurrentOwnerTeam(currentArrayElement),
                            mod.GetTeam(1)))),
                    mod.CountOf(filterModArray(
                        mod.AllCapturePoints(),
                        (currentArrayElement: any) => mod.Equals(
                            mod.GetCurrentOwnerTeam(currentArrayElement),
                            mod.GetTeam(2)))))))
            updateScoreboard()
            animateUIFlash("RightFlash1", "LeftFlash2")
        }
    } else {
        mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar), mod.Subtract(
            mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)),
            mod.CountOf(filterModArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.Equals(
                    mod.GetCurrentOwnerTeam(currentArrayElement),
                    mod.GetTeam(2))))))
        mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar), mod.Subtract(
            mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)),
            mod.CountOf(filterModArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.Equals(
                    mod.GetCurrentOwnerTeam(currentArrayElement),
                    mod.GetTeam(1))))))
    }
}
function trackScoreRule(conditionState: any) {
    let newState = shouldTrackScore();
    if (!conditionState.update(newState)) {
        return;
    }
    trackScoreAndBleed();
}

function shouldProcessKill(eventInfo: any): boolean {
    const newState = mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer));
    return newState;
}

function processKill(eventInfo: any) {
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, ScorePlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, ScorePlayerVar)),
        10))
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, ScorePlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, ScorePlayerVar)),
        10))
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, PlayerKillsPlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, PlayerKillsPlayerVar)),
        1))
    updatePlayerScoreboard(eventInfo.eventPlayer)
}
function processKillRule(conditionState: any, eventInfo: any) {
    let newState = shouldProcessKill(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    processKill(eventInfo);
}

function shouldProcessAssist(eventInfo: any): boolean {
    const newState = mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer));
    return newState;
}

function processAssist(eventInfo: any) {
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, ScorePlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, ScorePlayerVar)),
        5))
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, KillAssistsPlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, KillAssistsPlayerVar)),
        1))
    updatePlayerScoreboard(eventInfo.eventPlayer)
}
function processAssistRule(conditionState: any, eventInfo: any) {
    let newState = shouldProcessAssist(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    processAssist(eventInfo);
}

function processRevive(eventInfo: any) {
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventOtherPlayer, ScorePlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventOtherPlayer, ScorePlayerVar)),
        10))
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventOtherPlayer, RevivesPlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventOtherPlayer, RevivesPlayerVar)),
        1))
    updatePlayerScoreboard(eventInfo.eventOtherPlayer)
}
function processReviveRule(conditionState: any, eventInfo: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    processRevive(eventInfo);
}

async function handlePlayerDeath(eventInfo: any) {
    await mod.Wait(0.1)
    if (mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar))) {
        disableOutOfBounds(eventInfo)
    }
    if (mod.GetVariable(EnableCustomAIGlobalVar)) {
        if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
            if (mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier)) {
                if (mod.And(
                    mod.GetVariable(PlayerDeathsBleedGlobalVar),
                    mod.NotEqualTo(eventInfo.eventPlayer, eventInfo.eventOtherPlayer))) {
                    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), TeamScoreTeamVar), mod.Subtract(
                        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), TeamScoreTeamVar)),
                        1))
                }
                mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, PlayerDeathsPlayerVar), mod.Add(
                    mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, PlayerDeathsPlayerVar)),
                    1))
                updatePlayerScoreboard(eventInfo.eventPlayer)
                if (mod.GreaterThan(
                    mod.DistanceBetween(
                        mod.GetObjectPosition(eventInfo.eventPlayer),
                        mod.GetObjectPosition(mod.ClosestPlayerTo(mod.GetObjectPosition(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventPlayer)))),
                    20)) {
                    await mod.Wait(3)
                    if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
                        mod.UndeployPlayer(eventInfo.eventPlayer)
                    }
                }
            }
        }
    }
}
function handlePlayerDeathRule(conditionState: any, eventInfo: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    handlePlayerDeath(eventInfo);
}

function addEquipment(eventInfo: any) {
    if (mod.GetVariable(GivePlayersNVGGlobalVar)) {
        mod.AddEquipment(eventInfo.eventPlayer, mod.Gadgets.Mask_NVG)
    }
}
function addEquipmentRule(conditionState: any, eventInfo: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    addEquipment(eventInfo);
}

async function handlePlayerJoin(eventInfo: any) {
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar), -1)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar), false)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar), false)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, IgnoreOOBPlayerVar), false)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_InActionPlayerVar), false)
    await mod.Wait(1)
    if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
        updatePlayerScoreboard(eventInfo.eventPlayer)
        if (mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier))) {
            mod.SendErrorReport(mod.Message("Player Joined {}", eventInfo.eventPlayer))
            setupPlayerUI(eventInfo)
            await mod.Wait(5)
            if (mod.GetVariable(GameOngoingGlobalVar)) {
                await mod.Wait(0.1)
                resetFX(eventInfo)
            }
        }
    }
}
function handlePlayerJoinRule(conditionState: any, eventInfo: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    handlePlayerJoin(eventInfo);
}

function shouldUpdateDeathOnUndeploy(eventInfo: any): boolean {
    const newState = mod.GetVariable(GameOngoingGlobalVar);
    return newState;
}

function updateDeathOnUndeploy(eventInfo: any) {
    if (mod.GetVariable(PlayerDeathsBleedGlobalVar)) {
        mod.SetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), TeamScoreTeamVar), mod.Subtract(
            mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), TeamScoreTeamVar)),
            1))
    }
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, PlayerDeathsPlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, PlayerDeathsPlayerVar)),
        1))
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar), false)
    updatePlayerScoreboard(eventInfo.eventPlayer)
    updateScoreboard()
}
function updateDeathOnUndeployRule(conditionState: any, eventInfo: any) {
    let newState = shouldUpdateDeathOnUndeploy(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    updateDeathOnUndeploy(eventInfo);
}

async function handleCapturePointCaptured(eventInfo: any) {
    await mod.Wait(0.2)
    updateScoreboard()
    updateFlagIcons()
    mod.SetVariable(PlayersOnObjectiveGlobalVar, mod.EmptyArray())
    mod.SetVariable(PlayersOnObjectiveGlobalVar, filterModArray(
        mod.GetPlayersOnPoint(eventInfo.eventCapturePoint),
        (currentArrayElement: any) => mod.Equals(
            mod.GetTeam(currentArrayElement),
            mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint))))
    for (let i = 0; i < mod.CountOf(mod.GetVariable(PlayersOnObjectiveGlobalVar)); i++) {
        processObjectivePlayerData(mod.ValueInArray(mod.GetVariable(PlayersOnObjectiveGlobalVar), i))
        if (mod.GetSoldierState(mod.ValueInArray(mod.GetVariable(PlayersOnObjectiveGlobalVar), i), mod.SoldierStateBool.IsAISoldier)) {
            startAIScouting(mod.ValueInArray(mod.GetVariable(PlayersOnObjectiveGlobalVar), i))
        }
    }
    spawnObjectiveVehicles(eventInfo)
    if (mod.GetVariable(EnableVOGlobalVar)) {
        mod.PlayVO(mod.GetVariable(VO1GlobalVar), mod.VoiceOverEvents2D.ObjectiveCaptured, mod.ValueInArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.Subtract(
            mod.GetObjId(eventInfo.eventCapturePoint),
            200)), mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint))
        mod.PlayVO(mod.GetVariable(VO2GlobalVar), mod.VoiceOverEvents2D.ObjectiveCapturedEnemy, mod.ValueInArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.Subtract(
            mod.GetObjId(eventInfo.eventCapturePoint),
            200)), mod.GetVariable(mod.ObjectVariable(mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint), OtherTeamTeamVar)))
    }
}
function handleCapturePointCapturedRule(conditionState: any, eventInfo: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    handleCapturePointCaptured(eventInfo);
}

function shouldNotifyCapture(eventInfo: any): boolean {
    const newState = mod.GetVariable(EnableVOGlobalVar) && mod.Equals(
        mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
        mod.GetTeam(0)) && mod.LessThan(mod.GetCaptureProgress(eventInfo.eventCapturePoint), 0.05);
    return newState;
}

async function notifyCapture(eventInfo: any) {
    updateFlagIcons()
    await mod.Wait(0.2)
    updateScoreboard()
    if (mod.NotEqualTo(mod.GetPreviousOwnerTeam(eventInfo.eventCapturePoint), mod.GetTeam(0))) {
        mod.PlayVO(mod.GetVariable(VO3GlobalVar), mod.VoiceOverEvents2D.ObjectiveNeutralised, mod.ValueInArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.Subtract(
            mod.GetObjId(eventInfo.eventCapturePoint),
            200)), mod.GetOwnerProgressTeam(eventInfo.eventCapturePoint))
        mod.PlayVO(mod.GetVariable(VO4GlobalVar), mod.VoiceOverEvents2D.ObjectiveLost, mod.ValueInArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.Subtract(
            mod.GetObjId(eventInfo.eventCapturePoint),
            200)), mod.GetPreviousOwnerTeam(eventInfo.eventCapturePoint))
    } else {
        mod.PlayVO(mod.GetVariable(VO3GlobalVar), mod.VoiceOverEvents2D.ObjectiveCapturing, mod.ValueInArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.Subtract(
            mod.GetObjId(eventInfo.eventCapturePoint),
            200)), mod.GetOwnerProgressTeam(eventInfo.eventCapturePoint))
    }
}
function notifyCaptureRule(conditionState: any, eventInfo: any) {
    let newState = shouldNotifyCapture(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    notifyCapture(eventInfo);
}

function shouldPlayNearEndMusic(): boolean {
    const newState = mod.And(mod.GetVariable(GameOngoingGlobalVar), mod.Or(
        mod.LessThanEqualTo(mod.GetMatchTimeRemaining(), 60),
        mod.Or(
            mod.LessThanEqualTo(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)), mod.GetVariable(LowTicketMusicGlobalVar)),
            mod.LessThanEqualTo(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)), mod.GetVariable(LowTicketMusicGlobalVar)))))
    return newState;
}

function playNearEndMusic() {
    mod.PlayMusic(mod.MusicEvents.Core_Overtime_Loop)
}
function playNearEndMusicRule(conditionState: any) {
    let newState = shouldPlayNearEndMusic();
    if (!conditionState.update(newState)) {
        return;
    }
    playNearEndMusic();
}

function shouldEndGame(): boolean {
    const newState = mod.And(mod.GetVariable(GameOngoingGlobalVar), mod.Or(
        mod.LessThanEqualTo(mod.GetMatchTimeRemaining(), 1),
        mod.Or(
            mod.LessThanEqualTo(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)), 0),
            mod.LessThanEqualTo(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)), 0))))
    return newState;
}

async function endGame() {
    mod.SetVariable(GameOngoingGlobalVar, false)
    mod.PauseGameModeTime(true)
    if (mod.LessThan(
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)),
        0)) {
        mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar), 0)
    }
    if (mod.LessThan(
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)),
        0)) {
        mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar), 0)
    }
    if (mod.GreaterThan(
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)),
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)))) {
        mod.SetMusicParam(mod.MusicParams.Core_IsWinning, 1, mod.GetTeam(1))
    } else if (mod.GreaterThan(
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)),
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)))) {
        mod.SetMusicParam(mod.MusicParams.Core_IsWinning, 1, mod.GetTeam(2))
    } else {
    }
    mod.PlayMusic(mod.MusicEvents.Core_EndOfRound_Loop)
    mod.SetVariable(ScorePositionLeftGlobalVar, mod.CreateVector(-300, 385, 0))
    mod.SetVariable(ScorePositionRightGlobalVar, mod.CreateVector(300, 385, 0))
    updateScoreboard()
    mod.SetUIWidgetSize(mod.FindUIWidgetWithName("Timer"), mod.CreateVector(190, 60, 0))
    mod.SetUITextSize(mod.FindUIWidgetWithName("Timer"), 48)
    mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("Timer"), mod.CreateVector(0, 390, 0))
    mod.DeleteUIWidget(mod.FindUIWidgetWithName("Team1LeftBar"))
    mod.DeleteUIWidget(mod.FindUIWidgetWithName("Team1RightBar"))
    mod.DeleteUIWidget(mod.FindUIWidgetWithName("Team2LeftBar"))
    mod.DeleteUIWidget(mod.FindUIWidgetWithName("Team2RightBar"))
    mod.DeleteUIWidget(mod.FindUIWidgetWithName("LeftBarBG"))
    mod.DeleteUIWidget(mod.FindUIWidgetWithName("RightBarBG"))
    for (let i = 0; i < mod.CountOf(mod.GetVariable(ObjectiveTrackingUIGlobalVar)); i++) {
        mod.DeleteUIWidget(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), i)))
    }
    showEndGameUI("Team1ScoreLeft", mod.GetVariable(ScorePositionLeftGlobalVar))
    showEndGameUI("Team1ScoreRight", mod.GetVariable(ScorePositionRightGlobalVar))
    showEndGameUI("Team2ScoreLeft", mod.GetVariable(ScorePositionLeftGlobalVar))
    showEndGameUI("Team2ScoreRight", mod.GetVariable(ScorePositionRightGlobalVar))
    await mod.Wait(4)
    if (mod.GreaterThan(
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)),
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)))) {
        mod.EndGameMode(mod.GetTeam(1))
    } else if (mod.GreaterThan(
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)),
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)))) {
        mod.EndGameMode(mod.GetTeam(2))
    } else {
        mod.EndGameMode(mod.GetTeam(0))
    }
}
function endGameRule(conditionState: any) {
    let newState = shouldEndGame();
    if (!conditionState.update(newState)) {
        return;
    }
    endGame();
}

function shouldShowCaptureUI(eventInfo: any): boolean {
    const newState = mod.Not(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar)));
    return newState;
}

async function showCaptureUI(eventInfo: any) {
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointPlayerVar), eventInfo.eventCapturePoint)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointStatePlayerVar), mod.GetCaptureProgress(eventInfo.eventCapturePoint))
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, FlagOwnerPlayerVar), mod.GetTeam(3))
    const validPlayersOnPoint = filterModArray(
        mod.GetPlayersOnPoint(eventInfo.eventCapturePoint),
        (currentArrayElement: any) => mod.IsPlayerValid(currentArrayElement));
    mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), PlayersOnPointTeamVar), mod.GetObjId(eventInfo.eventCapturePoint), mod.CountOf(filterModArray(
        validPlayersOnPoint,
        (currentArrayElement: any) => mod.GetSoldierState(currentArrayElement, mod.SoldierStateBool.IsAlive) &&
            mod.Equals(
                mod.GetTeam(currentArrayElement),
                mod.GetTeam(eventInfo.eventPlayer)))))
    mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), OtherTeamTeamVar)), PlayersOnPointTeamVar), mod.GetObjId(eventInfo.eventCapturePoint), mod.CountOf(filterModArray(
        validPlayersOnPoint,
        (currentArrayElement: any) => mod.GetSoldierState(currentArrayElement, mod.SoldierStateBool.IsAlive) &&
            mod.Equals(
                mod.GetTeam(currentArrayElement),
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), OtherTeamTeamVar))))))
    await mod.Wait(0.05)
    manageCapturePointUI(eventInfo.eventCapturePoint, mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointStatePlayerVar)), eventInfo)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar), true)
    if (mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier))) {
        mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar), 9)
        while (mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar))) {
            if (mod.Not(mod.IsPlayerValid(eventInfo.eventPlayer))) {
                break
            }
            if (mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAlive)) {
                togglePlayerCaptureUI(true, eventInfo)
                updatePlayerCaptureUI(eventInfo)
            } else {
                togglePlayerCaptureUI(false, eventInfo)
            }
            mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointStatePlayerVar), mod.GetCaptureProgress(eventInfo.eventCapturePoint))
            mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, FlagOwnerPlayerVar), mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint))
            while (mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar))) { await mod.Wait(0.1) }
        }
        mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar), -1)
        togglePlayerCaptureUI(false, eventInfo)
    }
}
function showCaptureUIRule(conditionState: any, eventInfo: any) {
    let newState = shouldShowCaptureUI(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    showCaptureUI(eventInfo);
}

function shouldHideCaptureUI(eventInfo: any): boolean {
    const newState = mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar));
    return newState;
}

function hideCaptureUI(eventInfo: any) {
    const validPlayersOnPoint = filterModArray(
        mod.GetPlayersOnPoint(eventInfo.eventCapturePoint),
        (currentArrayElement: any) => mod.IsPlayerValid(currentArrayElement));
    mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), PlayersOnPointTeamVar), mod.GetObjId(eventInfo.eventCapturePoint), mod.CountOf(filterModArray(
        validPlayersOnPoint,
        (currentArrayElement: any) => mod.GetSoldierState(currentArrayElement, mod.SoldierStateBool.IsAlive) &&
            mod.Equals(
                mod.GetTeam(currentArrayElement),
                mod.GetTeam(eventInfo.eventPlayer)))))
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar), false)
}
function hideCaptureUIRule(conditionState: any, eventInfo: any) {
    let newState = shouldHideCaptureUI(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    hideCaptureUI(eventInfo);
}

function shouldUpdatePlayerCountOnDeath(eventInfo: any): boolean {
    const newState = mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar));
    return newState;
}

function updatePlayerCountOnDeath(eventInfo: any) {
    const cpId = mod.GetObjId(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointPlayerVar)));
    const validPlayersOnPoint = filterModArray(
        mod.GetPlayersOnPoint(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointPlayerVar))),
        (currentArrayElement: any) => mod.IsPlayerValid(currentArrayElement));
    mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), PlayersOnPointTeamVar), cpId, mod.CountOf(filterModArray(
        validPlayersOnPoint,
        (currentArrayElement: any) => mod.GetSoldierState(currentArrayElement, mod.SoldierStateBool.IsAlive) &&
            mod.Equals(
                mod.GetTeam(currentArrayElement),
                mod.GetTeam(eventInfo.eventPlayer)))))
}
function updatePlayerCountOnDeathRule(conditionState: any, eventInfo: any) {
    let newState = shouldUpdatePlayerCountOnDeath(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    updatePlayerCountOnDeath(eventInfo);
}

function shouldUpdatePlayerCountOnRevive(eventInfo: any): boolean {
    const newState = mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar));
    return newState;
}

function updatePlayerCountOnRevive(eventInfo: any) {
    const cpId = mod.GetObjId(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointPlayerVar)));
    const validPlayersOnPoint = filterModArray(
        mod.GetPlayersOnPoint(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointPlayerVar))),
        (currentArrayElement: any) => mod.IsPlayerValid(currentArrayElement));
    mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), PlayersOnPointTeamVar), cpId, mod.CountOf(filterModArray(
        validPlayersOnPoint,
        (currentArrayElement: any) => mod.GetSoldierState(currentArrayElement, mod.SoldierStateBool.IsAlive) &&
            mod.Equals(
                mod.GetTeam(currentArrayElement),
                mod.GetTeam(eventInfo.eventPlayer)))))
}
function updatePlayerCountOnReviveRule(conditionState: any, eventInfo: any) {
    let newState = shouldUpdatePlayerCountOnRevive(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    updatePlayerCountOnRevive(eventInfo);
}

async function handleTeamSwitchAndRepel(eventInfo: any) {
    if (mod.GetVariable(EnableTeamSwitchingGlobalVar)) {
        if (mod.Or(
            mod.Equals(
                mod.GetInteractPoint(998),
                eventInfo.eventInteractPoint),
            mod.Equals(
                mod.GetInteractPoint(999),
                eventInfo.eventInteractPoint))) {
            mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, IgnoreOOBPlayerVar), true)
            mod.UndeployPlayer(eventInfo.eventPlayer)
            mod.SetTeam(eventInfo.eventPlayer, mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), OtherTeamTeamVar)))
            mod.SetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), TeamScoreTeamVar), mod.Add(
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), TeamScoreTeamVar)),
                1))
            mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, PlayerDeathsPlayerVar), mod.Subtract(
                mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, PlayerDeathsPlayerVar)),
                1))
            updatePlayerScoreboard(eventInfo.eventPlayer)
            await mod.Wait(2)
            mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, IgnoreOOBPlayerVar), false)
        }
    }
    if (mod.And(
        mod.GreaterThanEqualTo(
            mod.GetObjId(eventInfo.eventInteractPoint),
            700),
        mod.LessThan(
            mod.GetObjId(eventInfo.eventInteractPoint),
            750))) {
        applyRepelForce(mod.Divide(
            mod.DistanceBetween(
                mod.GetObjectPosition(eventInfo.eventPlayer),
                mod.GetObjectPosition(mod.GetSpatialObject(mod.Add(
                    mod.GetObjId(eventInfo.eventInteractPoint),
                    50)))),
            8), eventInfo)
    }
}
function handleTeamSwitchAndRepelRule(conditionState: any, eventInfo: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    handleTeamSwitchAndRepel(eventInfo);
}

function shouldEnterAreaTrigger(eventInfo: any): boolean {
    const newState = mod.Or(
        mod.Or(
            mod.And(
                mod.And(
                    mod.GreaterThanEqualTo(
                        mod.GetObjId(eventInfo.eventAreaTrigger),
                        1100),
                    mod.LessThan(
                        mod.GetObjId(eventInfo.eventAreaTrigger),
                        1200)),
                mod.Equals(
                    mod.GetTeam(eventInfo.eventPlayer),
                    mod.GetTeam(2))),
            mod.And(
                mod.And(
                    mod.GreaterThanEqualTo(
                        mod.GetObjId(eventInfo.eventAreaTrigger),
                        1200),
                    mod.LessThan(
                        mod.GetObjId(eventInfo.eventAreaTrigger),
                        1300)),
                mod.Equals(
                    mod.GetTeam(eventInfo.eventPlayer),
                    mod.GetTeam(1)))),
        mod.And(
            mod.GreaterThanEqualTo(
                mod.GetObjId(eventInfo.eventAreaTrigger),
                1300),
            mod.LessThan(
                mod.GetObjId(eventInfo.eventAreaTrigger),
                1400)))
    return newState;
}

function enterAreaTrigger(eventInfo: any) {
    if (mod.Not(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar)))) {
        handleOutOfBounds(eventInfo)
    }
}
function enterAreaTriggerRule(conditionState: any, eventInfo: any) {
    let newState = shouldEnterAreaTrigger(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    enterAreaTrigger(eventInfo);
}

function shouldExitAreaTrigger(eventInfo: any): boolean {
    const newState = mod.Or(
        mod.Or(
            mod.Or(
                mod.And(
                    mod.And(
                        mod.GreaterThanEqualTo(
                            mod.GetObjId(eventInfo.eventAreaTrigger),
                            1100),
                        mod.LessThan(
                            mod.GetObjId(eventInfo.eventAreaTrigger),
                            1200)),
                    mod.Equals(
                        mod.GetTeam(eventInfo.eventPlayer),
                        mod.GetTeam(2))),
                mod.And(
                    mod.And(
                        mod.GreaterThanEqualTo(
                            mod.GetObjId(eventInfo.eventAreaTrigger),
                            1200),
                        mod.LessThan(
                            mod.GetObjId(eventInfo.eventAreaTrigger),
                            1300)),
                    mod.Equals(
                        mod.GetTeam(eventInfo.eventPlayer),
                        mod.GetTeam(1)))),
            mod.And(
                mod.GreaterThanEqualTo(
                    mod.GetObjId(eventInfo.eventAreaTrigger),
                    1300),
                mod.LessThan(
                    mod.GetObjId(eventInfo.eventAreaTrigger),
                    1400))),
        mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAlive)))
    return newState;
}

function exitAreaTrigger(eventInfo: any) {
    disableOutOfBounds(eventInfo)
}
function exitAreaTriggerRule(conditionState: any, eventInfo: any) {
    let newState = shouldExitAreaTrigger(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    exitAreaTrigger(eventInfo);
}

function shouldPlayVOLowTime(): boolean {
    const newState = mod.GetVariable(GameOngoingGlobalVar) && mod.GetVariable(EnableVOGlobalVar) && mod.LessThanEqualTo(mod.GetMatchTimeRemaining(), 300);
    return newState;
}

function playVOLowTime() {
    mod.PlayVO(mod.GetVariable(VO5GlobalVar), mod.VoiceOverEvents2D.TimeLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
    mod.PlayVO(mod.GetVariable(VO6GlobalVar), mod.VoiceOverEvents2D.TimeLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
}
function playVOLowTimeRule(conditionState: any) {
    let newState = shouldPlayVOLowTime();
    if (!conditionState.update(newState)) {
        return;
    }
    playVOLowTime();
}

function shouldPlayVOWinning(): boolean {
    const newState = mod.GetVariable(GameOngoingGlobalVar) && mod.GetVariable(EnableVOGlobalVar) && mod.GreaterThan(
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)),
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)));
    return newState;
}

function playVOWinning() {
    mod.PlayVO(mod.GetVariable(VO5GlobalVar), mod.VoiceOverEvents2D.ProgressMidWinning, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
    mod.PlayVO(mod.GetVariable(VO6GlobalVar), mod.VoiceOverEvents2D.ProgressMidLosing, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
}
function playVOWinningRule(conditionState: any) {
    let newState = shouldPlayVOWinning();
    if (!conditionState.update(newState)) {
        return;
    }
    playVOWinning();
}

function shouldPlayVOTeam2Winning(): boolean {
    const newState = mod.GetVariable(GameOngoingGlobalVar) && mod.GetVariable(EnableVOGlobalVar) && mod.GreaterThan(
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)),
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)));
    return newState;
}

function playVOTeam2Winning() {
    mod.PlayVO(mod.GetVariable(VO5GlobalVar), mod.VoiceOverEvents2D.ProgressMidWinning, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
    mod.PlayVO(mod.GetVariable(VO6GlobalVar), mod.VoiceOverEvents2D.ProgressMidLosing, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
}
function playVOTeam2WinningRule(conditionState: any) {
    let newState = shouldPlayVOTeam2Winning();
    if (!conditionState.update(newState)) {
        return;
    }
    playVOTeam2Winning();
}

function shouldPlayVOLowTickets(): boolean {
    const newState = mod.GetVariable(GameOngoingGlobalVar) && mod.GetVariable(EnableVOGlobalVar) && mod.LessThanEqualTo(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)), mod.GetVariable(LowTicketMusicGlobalVar));
    return newState;
}

function playVOLowTickets() {
    mod.PlayVO(mod.GetVariable(VO5GlobalVar), mod.VoiceOverEvents2D.PlayerCountFriendlyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
    mod.PlayVO(mod.GetVariable(VO6GlobalVar), mod.VoiceOverEvents2D.PlayerCountEnemyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
}
function playVOLowTicketsRule(conditionState: any) {
    let newState = shouldPlayVOLowTickets();
    if (!conditionState.update(newState)) {
        return;
    }
    playVOLowTickets();
}

function shouldPlayVOTeam2LowTickets(): boolean {
    const newState = mod.GetVariable(GameOngoingGlobalVar) && mod.GetVariable(EnableVOGlobalVar) && mod.LessThanEqualTo(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)), mod.GetVariable(LowTicketMusicGlobalVar));
    return newState;
}

function playVOTeam2LowTickets() {
    mod.PlayVO(mod.GetVariable(VO5GlobalVar), mod.VoiceOverEvents2D.PlayerCountFriendlyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
    mod.PlayVO(mod.GetVariable(VO6GlobalVar), mod.VoiceOverEvents2D.PlayerCountEnemyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
}
function playVOTeam2LowTicketsRule(conditionState: any) {
    let newState = shouldPlayVOTeam2LowTickets();
    if (!conditionState.update(newState)) {
        return;
    }
    playVOTeam2LowTickets();
}

async function updateCaptureProgress(eventInfo: any) {
    while (!mod.GetVariable(GameOngoingGlobalVar)) { await mod.Wait(999) }
    if (mod.GetVariable(ConquestAssaultGlobalVar)) {
        mod.SetCapturePointOwner(eventInfo.eventCapturePoint, mod.GetTeam(2))
    }
    await mod.Wait(mod.RandomReal(0, 1))
    mod.SetVariableAtIndex(CapturePointProgressGlobalVar, mod.GetObjId(eventInfo.eventCapturePoint), mod.GetCaptureProgress(eventInfo.eventCapturePoint))
    mod.SetVariableAtIndex(CaptureProgressSizeGlobalVar, mod.GetObjId(eventInfo.eventCapturePoint), mod.CreateVector(mod.Floor(mod.Multiply(220, mod.GetCaptureProgress(eventInfo.eventCapturePoint))), 7, 0))
    mod.SetVariableAtIndex(CaptureProgressPositionGlobalVar, mod.GetObjId(eventInfo.eventCapturePoint), mod.CreateVector(mod.Add(
        -110,
        mod.Floor(mod.Divide(
            mod.Multiply(220, mod.GetCaptureProgress(eventInfo.eventCapturePoint)),
            2))), 200, 0))
    // TODO: make this function "async"
    while (true) {
        if (mod.And(
            mod.GreaterThan(
                mod.GetCaptureProgress(eventInfo.eventCapturePoint),
                0),
            mod.LessThan(
                mod.GetCaptureProgress(eventInfo.eventCapturePoint),
                1))) {
            mod.SetUITextAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Subtract(
                mod.GetObjId(eventInfo.eventCapturePoint),
                200))), mod.GetVariable(CapturepointFlashGlobalVar))
            mod.SetUITextAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Subtract(
                mod.GetObjId(eventInfo.eventCapturePoint),
                174))), mod.GetVariable(CapturepointFlashGlobalVar))
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Subtract(
                mod.GetObjId(eventInfo.eventCapturePoint),
                148))), mod.GetVariable(CapturepointFlashGlobalVar))
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Subtract(
                mod.GetObjId(eventInfo.eventCapturePoint),
                122))), mod.GetVariable(CapturepointFlashGlobalVar))
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Subtract(
                mod.GetObjId(eventInfo.eventCapturePoint),
                200))), mod.GetVariable(CapturepointFlashGlobalVar))
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Subtract(
                mod.GetObjId(eventInfo.eventCapturePoint),
                174))), mod.GetVariable(CapturepointFlashGlobalVar))
        } else {
            mod.SetUITextAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Subtract(
                mod.GetObjId(eventInfo.eventCapturePoint),
                200))), 1)
            mod.SetUITextAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Subtract(
                mod.GetObjId(eventInfo.eventCapturePoint),
                174))), 1)
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Subtract(
                mod.GetObjId(eventInfo.eventCapturePoint),
                148))), 1)
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Subtract(
                mod.GetObjId(eventInfo.eventCapturePoint),
                122))), 1)
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Subtract(
                mod.GetObjId(eventInfo.eventCapturePoint),
                200))), 0.8)
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Subtract(
                mod.GetObjId(eventInfo.eventCapturePoint),
                174))), 0.8)
        }
        if (mod.NotEqualTo(mod.ValueInArray(mod.GetVariable(CapturePointProgressGlobalVar), mod.GetObjId(eventInfo.eventCapturePoint)), mod.GetCaptureProgress(eventInfo.eventCapturePoint))) {
            mod.SetVariableAtIndex(CaptureProgressSizeGlobalVar, mod.GetObjId(eventInfo.eventCapturePoint), mod.CreateVector(mod.Floor(mod.Multiply(220, mod.GetCaptureProgress(eventInfo.eventCapturePoint))), 7, 0))
            mod.SetVariableAtIndex(CaptureProgressPositionGlobalVar, mod.GetObjId(eventInfo.eventCapturePoint), mod.CreateVector(mod.Add(
                -110,
                mod.Floor(mod.Divide(
                    mod.Multiply(220, mod.GetCaptureProgress(eventInfo.eventCapturePoint)),
                    2))), 200, 0))
            manageCapturePointUI(eventInfo.eventCapturePoint, mod.ValueInArray(mod.GetVariable(CapturePointProgressGlobalVar), mod.GetObjId(eventInfo.eventCapturePoint)), eventInfo)
        }
        mod.SetVariableAtIndex(CapturePointProgressGlobalVar, mod.GetObjId(eventInfo.eventCapturePoint), mod.GetCaptureProgress(eventInfo.eventCapturePoint))
        await mod.Wait(0.1)
    }
}
function runCaptureProgressRule(conditionState: any, eventInfo: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    updateCaptureProgress(eventInfo);
}

function shouldAIScoutOnDeploy(eventInfo: any): boolean {
    const newState = mod.And(mod.GetVariable(EnableCustomAIGlobalVar), mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier));
    return newState;
}

async function deployAIScout(eventInfo: any) {
    await mod.Wait(0.2)
    if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
        mod.SetPlayerIncomingDamageFactor(eventInfo.eventPlayer, 0.5)
        deployAI(eventInfo)
    }
}
function aiScoutOnDeployRule(conditionState: any, eventInfo: any) {
    let newState = shouldAIScoutOnDeploy(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    deployAIScout(eventInfo);
}

function shouldAIFindNewObjective(eventInfo: any): boolean {
    const newState = mod.GetVariable(EnableCustomAIGlobalVar) && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier) && !mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle);
    return newState;
}

async function findNewAIObjective(eventInfo: any) {
    if (mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint))) {
        await mod.Wait(1.5)
        if (mod.IsType(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_TargetPlayerVar)), mod.Types.CapturePoint)) {
            if (mod.Equals(
                eventInfo.eventCapturePoint,
                mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_TargetPlayerVar)))) {
                if (mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAlive)) {
                    mod.AIDefendPositionBehavior(eventInfo.eventPlayer, mod.GetObjectPosition(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_TargetPlayerVar))), 0, 20)
                }
            }
        }
    } else {
        startAIScouting(eventInfo.eventPlayer)
    }
}
function aiFindNewObjectiveRule(conditionState: any, eventInfo: any) {
    let newState = shouldAIFindNewObjective(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    findNewAIObjective(eventInfo);
}

function shouldAIReadyForAttack(eventInfo: any): boolean {
    const newState = mod.GetVariable(EnableCustomAIGlobalVar) && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier) && mod.LessThanEqualTo(mod.GetVariable(MaxCustomAIGlobalVar), 70);
    return newState;
}

async function readyAIForAttack(eventInfo: any) {
    await mod.Wait(mod.RandomReal(2, 3))
    while (mod.IsPlayerValid(eventInfo.eventPlayer)) {
        if (mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAlive)) {
            if (mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle))) {
                if (mod.LessThan(
                    mod.DistanceBetween(
                        mod.GetObjectPosition(mod.ClosestPlayerTo(mod.GetObjectPosition(eventInfo.eventPlayer), mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), OtherTeamTeamVar)))),
                        mod.GetObjectPosition(eventInfo.eventPlayer)),
                    25)) {
                    mod.AIDefendPositionBehavior(eventInfo.eventPlayer, mod.GetObjectPosition(mod.ClosestPlayerTo(mod.GetObjectPosition(eventInfo.eventPlayer), mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), OtherTeamTeamVar)))), 10, 25)
                    mod.AISetTarget(eventInfo.eventPlayer, mod.ClosestPlayerTo(mod.GetObjectPosition(eventInfo.eventPlayer), mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), OtherTeamTeamVar))))
                    mod.AISetMoveSpeed(eventInfo.eventPlayer, mod.MoveSpeed.InvestigateRun)
                    await mod.Wait(15)
                    if (mod.Not(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_InActionPlayerVar)))) {
                        startAIScouting(eventInfo.eventPlayer)
                    }
                }
            }
        }
        await mod.Wait(1)
    }
}
function aiReadyForAttackRule(conditionState: any, eventInfo: any) {
    let newState = shouldAIReadyForAttack(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    readyAIForAttack(eventInfo);
}

function shouldAITargetDamager(eventInfo: any): boolean {
    const newState = mod.GetVariable(EnableCustomAIGlobalVar) && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier) && !mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_InActionPlayerVar)) && mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer)) && !mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle);
    return newState;
}

async function targetAIDamager(eventInfo: any) {
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_InActionPlayerVar), true)
    mod.AIDefendPositionBehavior(eventInfo.eventPlayer, mod.GetObjectPosition(eventInfo.eventPlayer), 0, 15)
    mod.AISetMoveSpeed(eventInfo.eventPlayer, mod.MoveSpeed.InvestigateRun)
    mod.AISetTarget(eventInfo.eventPlayer, eventInfo.eventOtherPlayer)
    await mod.Wait(10)
    if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
        if (mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_InActionPlayerVar))) {
            startAIScouting(eventInfo.eventPlayer)
            mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_InActionPlayerVar), false)
        }
    }
}
function aiTargetDamagerRule(conditionState: any, eventInfo: any) {
    let newState = shouldAITargetDamager(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    targetAIDamager(eventInfo);
}

function shouldAIExitVehicle(eventInfo: any): boolean {
    const newState = mod.And(mod.GetVariable(EnableCustomAIGlobalVar), mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier));
    return newState;
}

function exitAIVehicle(eventInfo: any) {
    startAIScouting(eventInfo.eventPlayer)
}
function aiExitVehicleRule(conditionState: any, eventInfo: any) {
    let newState = shouldAIExitVehicle(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    exitAIVehicle(eventInfo);
}

function shouldAIEnterVehicle(eventInfo: any): boolean {
    const newState = mod.And(mod.GetVariable(EnableCustomAIGlobalVar), mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier));
    return newState;
}

async function enterAIVehicle(eventInfo: any) {
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, StartPositionPlayerVar), mod.GetObjectPosition(eventInfo.eventPlayer))
    await mod.Wait(10)
    if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
        if (mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle)) {
            if (mod.LessThan(
                mod.DistanceBetween(
                    mod.GetObjectPosition(eventInfo.eventPlayer),
                    mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, StartPositionPlayerVar))),
                3)) {
                mod.ForcePlayerExitVehicle(eventInfo.eventPlayer, mod.GetVehicleFromPlayer(eventInfo.eventPlayer))
            }
        }
    }
}
function aiEnterVehicleRule(conditionState: any, eventInfo: any) {
    let newState = shouldAIEnterVehicle(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    enterAIVehicle(eventInfo);
}

function shouldAIRetryMove(eventInfo: any): boolean {
    const newState = mod.And(mod.GetVariable(EnableCustomAIGlobalVar), mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier));
    return newState;
}

function retryAIMove(eventInfo: any) {
    startAIScouting(eventInfo.eventPlayer)
}
function aiRetryMoveRule(conditionState: any, eventInfo: any) {
    let newState = shouldAIRetryMove(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    retryAIMove(eventInfo);
}

function shouldAITargetOnKill(eventInfo: any): boolean {
    const newState = mod.GetVariable(EnableCustomAIGlobalVar) && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier) && !mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle);
    return newState;
}

function targetAIOnKill(eventInfo: any) {
    startAIScouting(eventInfo.eventPlayer)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_InActionPlayerVar), false)
}
function aiTargetOnKillRule(conditionState: any, eventInfo: any) {
    let newState = shouldAITargetOnKill(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    targetAIOnKill(eventInfo);
}

function shouldAITargetOnKillAssist(eventInfo: any): boolean {
    const newState = mod.GetVariable(EnableCustomAIGlobalVar) && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier) && mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer)) && !mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle);
    return newState;
}

function targetAIOnKillAssist(eventInfo: any) {
    startAIScouting(eventInfo.eventPlayer)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_InActionPlayerVar), false)
}
function aiTargetOnKillAssistRule(conditionState: any, eventInfo: any) {
    let newState = shouldAITargetOnKillAssist(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    targetAIOnKillAssist(eventInfo);
}

function updateScoreboard() {


    mod.SetScoreboardType(mod.ScoreboardType.CustomTwoTeams)
    mod.SetScoreboardColumnNames(mod.Message("Score"), mod.Message("Kills"), mod.Message("Deaths"), mod.Message("Assists"), mod.Message("Captures"))
    mod.SetScoreboardHeader(mod.Message("{}: {}", mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), FactionTeamVar)), mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar))), mod.Message("{}: {}", mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), FactionTeamVar)), mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar))))
    mod.SetUITextLabel(mod.FindUIWidgetWithName("Team1ScoreLeft"), mod.Message("{}", mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar))))
    mod.SetUITextLabel(mod.FindUIWidgetWithName("Team1ScoreRight"), mod.Message("{}", mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar))))
    mod.SetUITextLabel(mod.FindUIWidgetWithName("Team2ScoreLeft"), mod.Message("{}", mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar))))
    mod.SetUITextLabel(mod.FindUIWidgetWithName("Team2ScoreRight"), mod.Message("{}", mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar))))
    mod.SetUITextLabel(mod.FindUIWidgetWithName("Timer"), mod.Message("{} : {}{}", mod.Floor(mod.Divide(
        mod.GetMatchTimeRemaining(),
        60)), mod.Floor(mod.Divide(
            mod.Modulo(
                mod.GetMatchTimeRemaining(),
                60),
            10)), mod.Floor(mod.Modulo(
                mod.GetMatchTimeRemaining(),
                10))))
    mod.SetUIWidgetSize(mod.FindUIWidgetWithName("Team1LeftBar"), mod.CreateVector(mod.Floor(mod.Multiply(200, mod.Divide(
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)),
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), StartingScoreTeamVar))))), 10, 0))
    mod.SetUIWidgetSize(mod.FindUIWidgetWithName("Team2LeftBar"), mod.CreateVector(mod.Floor(mod.Multiply(200, mod.Divide(
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)),
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), StartingScoreTeamVar))))), 10, 0))
    mod.SetUIWidgetSize(mod.FindUIWidgetWithName("Team1RightBar"), mod.CreateVector(mod.Floor(mod.Multiply(200, mod.Divide(
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)),
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), StartingScoreTeamVar))))), 10, 0))
    mod.SetUIWidgetSize(mod.FindUIWidgetWithName("Team2RightBar"), mod.CreateVector(mod.Floor(mod.Multiply(200, mod.Divide(
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)),
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), StartingScoreTeamVar))))), 10, 0))
    mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("Team1LeftBar"), mod.CreateVector(mod.Floor(mod.Add(
        -260,
        mod.Divide(
            mod.Multiply(200, mod.Divide(
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)),
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), StartingScoreTeamVar)))),
            2))), 60, 0))
    mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("Team1RightBar"), mod.CreateVector(mod.Floor(mod.Subtract(
        260,
        mod.Divide(
            mod.Multiply(200, mod.Divide(
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)),
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), StartingScoreTeamVar)))),
            2))), 60, 0))
    mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("Team2LeftBar"), mod.CreateVector(mod.Floor(mod.Add(
        -260,
        mod.Divide(
            mod.Multiply(200, mod.Divide(
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)),
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), StartingScoreTeamVar)))),
            2))), 60, 0))
    mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("Team2RightBar"), mod.CreateVector(mod.Floor(mod.Subtract(
        260,
        mod.Divide(
            mod.Multiply(200, mod.Divide(
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)),
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), StartingScoreTeamVar)))),
            2))), 60, 0))
}
function updatePlayerScoreboard(Player: any) {


    mod.SetScoreboardPlayerValues(Player, mod.GetVariable(mod.ObjectVariable(Player, ScorePlayerVar)), mod.GetVariable(mod.ObjectVariable(Player, PlayerKillsPlayerVar)), mod.GetVariable(mod.ObjectVariable(Player, PlayerDeathsPlayerVar)), mod.GetVariable(mod.ObjectVariable(Player, KillAssistsPlayerVar)), mod.GetVariable(mod.ObjectVariable(Player, CapturesPlayerVar)))
}
function setupCapturePoint(Objective: any) {


    mod.SetCapturePointCapturingTime(Objective, mod.GetVariable(FlagCaptureTimeGlobalVar))
    mod.SetCapturePointNeutralizationTime(Objective, mod.GetVariable(FlagNeutralTimeGlobalVar))
    mod.EnableGameModeObjective(Objective, true)
    mod.SetMaxCaptureMultiplier(Objective, 3)
}
function spawnObjectiveVehicles(eventInfo: any) {


    if (mod.Equals(
        eventInfo.eventCapturePoint,
        mod.GetCapturePoint(200))) {
        if (mod.Equals(
            mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
            mod.GetTeam(1))) {
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(600), true)
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(601), false)
        } else if (mod.Equals(
            mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
            mod.GetTeam(2))) {
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(601), true)
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(600), false)
        } else {
        }
    }
    if (mod.Equals(
        eventInfo.eventCapturePoint,
        mod.GetCapturePoint(201))) {
        if (mod.Equals(
            mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
            mod.GetTeam(1))) {
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(610), true)
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(611), false)
        } else if (mod.Equals(
            mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
            mod.GetTeam(2))) {
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(611), true)
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(610), false)
        } else {
        }
    }
    if (mod.Equals(
        eventInfo.eventCapturePoint,
        mod.GetCapturePoint(202))) {
        if (mod.Equals(
            mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
            mod.GetTeam(1))) {
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(620), true)
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(621), false)
        } else if (mod.Equals(
            mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
            mod.GetTeam(2))) {
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(621), true)
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(620), false)
        } else {
        }
    }
    if (mod.Equals(
        eventInfo.eventCapturePoint,
        mod.GetCapturePoint(203))) {
        if (mod.Equals(
            mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
            mod.GetTeam(1))) {
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(630), true)
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(631), false)
        } else if (mod.Equals(
            mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
            mod.GetTeam(2))) {
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(631), true)
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(630), false)
        } else {
        }
    }
    if (mod.Equals(
        eventInfo.eventCapturePoint,
        mod.GetCapturePoint(204))) {
        if (mod.Equals(
            mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
            mod.GetTeam(1))) {
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(640), true)
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(641), false)
        } else if (mod.Equals(
            mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
            mod.GetTeam(2))) {
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(641), true)
            mod.SetVehicleSpawnerAutoSpawn(mod.GetVehicleSpawner(640), false)
        } else {
        }
    }
}
function processObjectivePlayerData(Player: any) {


    mod.SetVariable(mod.ObjectVariable(Player, CapturesPlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(Player, CapturesPlayerVar)),
        1))
    mod.SetVariable(mod.ObjectVariable(Player, ScorePlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(Player, ScorePlayerVar)),
        50))
    updatePlayerScoreboard(Player)
    mod.PlaySound(mod.GetVariable(CapturedSoundGlobalVar), 0.7, Player)
}
function initPlayerUIIds() {
    const ids: string[] = [];
    for (let i = 1; i <= 105; i++) {
        ids.push(i.toString());
    }
    let pool = mod.EmptyArray();
    for (const id of ids) {
        pool = mod.AppendToArray(pool, id);
    }
    mod.SetVariable(ID_PoolGlobalVar, pool);
}
function updateObjectiveUI(Label: string, eventInfo: any) {


    mod.SetUITextLabel(mod.FindUIWidgetWithName("ObjText", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), mod.Message(Label))
    mod.SetUITextLabel(mod.FindUIWidgetWithName("ObjCounter", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), mod.Message("{} - {}", mod.ValueInArray(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), PlayersOnPointTeamVar)), mod.GetObjId(eventInfo.eventCapturePoint)), mod.ValueInArray(mod.GetVariable(mod.ObjectVariable(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), OtherTeamTeamVar)), PlayersOnPointTeamVar)), mod.GetObjId(eventInfo.eventCapturePoint))))
    if (mod.Or(
        mod.Equals(
            mod.ValueInArray(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), PlayersOnPointTeamVar)), mod.GetObjId(eventInfo.eventCapturePoint)),
            0),
        mod.GreaterThan(
            mod.ValueInArray(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), PlayersOnPointTeamVar)), mod.GetObjId(eventInfo.eventCapturePoint)),
            mod.ValueInArray(mod.GetVariable(mod.ObjectVariable(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), OtherTeamTeamVar)), PlayersOnPointTeamVar)), mod.GetObjId(eventInfo.eventCapturePoint))))) {
        mod.SetUITextColor(mod.FindUIWidgetWithName("ObjCounter", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), mod.CreateVector(1, 1, 1))
    } else {
        mod.SetUITextColor(mod.FindUIWidgetWithName("ObjCounter", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), mod.GetVariable(EnemyTextColourGlobalVar))
    }
}
function setupMainUI() {


    mod.AddUIContainer("container", mod.CreateVector(0, 0, 0), mod.CreateVector(2000, 2000, 0), mod.UIAnchor.TopCenter)
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
    mod.AddUIText("LeftBarBG", mod.CreateVector(-160, 60, 0), mod.CreateVector(200, 10, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.GetVariable(FriendlyBGColourGlobalVar), 0.8, mod.UIBgFill.Blur, mod.Message(""), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI)
    mod.AddUIText("RightBarBG", mod.CreateVector(160, 60, 0), mod.CreateVector(200, 10, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.GetVariable(EnemyBGColourGlobalVar), 0.8, mod.UIBgFill.Blur, mod.Message(""), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI)
    setupScoreUI("Team1ScoreLeft", "Team1ScoreRight", "Team1LeftBar", "Team1RightBar", mod.GetTeam(1))
    setupScoreUI("Team2ScoreLeft", "Team2ScoreRight", "Team2LeftBar", "Team2RightBar", mod.GetTeam(2))
    for (let i = 0; i < mod.CountOf(mod.AllCapturePoints()); i++) {
        mod.AddUIText(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), i), mod.CreateVector(mod.Multiply(mod.Subtract(
            i,
            mod.Divide(
                mod.Subtract(
                    mod.CountOf(mod.AllCapturePoints()),
                    1),
                2)), 50), 90, 0), mod.CreateVector(30, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Blur, mod.Message(mod.ValueInArray(mod.GetVariable(FlagLettersGlobalVar), i)), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(1))
        mod.AddUIText(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
            52,
            i)), mod.CreateVector(mod.Multiply(mod.Subtract(
                i,
                mod.Divide(
                    mod.Subtract(
                        mod.CountOf(mod.AllCapturePoints()),
                        1),
                    2)), 50), 90, 0), mod.CreateVector(30, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.OutlineThin, mod.Message(""), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(1))
        mod.AddUIText(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
            26,
            i)), mod.CreateVector(mod.Multiply(mod.Subtract(
                i,
                mod.Divide(
                    mod.Subtract(
                        mod.CountOf(mod.AllCapturePoints()),
                        1),
                    2)), 50), 90, 0), mod.CreateVector(30, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Blur, mod.Message(mod.ValueInArray(mod.GetVariable(FlagLettersGlobalVar), i)), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(2))
        mod.AddUIText(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
            78,
            i)), mod.CreateVector(mod.Multiply(mod.Subtract(
                i,
                mod.Divide(
                    mod.Subtract(
                        mod.CountOf(mod.AllCapturePoints()),
                        1),
                    2)), 50), 90, 0), mod.CreateVector(30, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.OutlineThin, mod.Message(""), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(2))
    }
    mod.AddUIText("LeftFlash1", mod.GetVariable(ScorePositionLeftGlobalVar), mod.CreateVector(80, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.GetVariable(FriendlyTextColourGlobalVar), 0, mod.UIBgFill.Solid, mod.Message(""), 32, mod.GetVariable(FriendlyTextColourGlobalVar), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(1))
    mod.AddUIText("RightFlash1", mod.GetVariable(ScorePositionRightGlobalVar), mod.CreateVector(80, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.GetVariable(EnemyTextColourGlobalVar), 0, mod.UIBgFill.Solid, mod.Message(""), 32, mod.GetVariable(EnemyTextColourGlobalVar), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(1))
    mod.AddUIText("LeftFlash2", mod.GetVariable(ScorePositionLeftGlobalVar), mod.CreateVector(80, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.GetVariable(FriendlyTextColourGlobalVar), 0, mod.UIBgFill.Solid, mod.Message(""), 32, mod.GetVariable(FriendlyTextColourGlobalVar), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(2))
    mod.AddUIText("RightFlash2", mod.GetVariable(ScorePositionRightGlobalVar), mod.CreateVector(80, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.GetVariable(EnemyTextColourGlobalVar), 0, mod.UIBgFill.Solid, mod.Message(""), 32, mod.GetVariable(EnemyTextColourGlobalVar), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(2))
}
function showEndGameUI(UI: string, Position: any) {


    mod.SetUIWidgetSize(mod.FindUIWidgetWithName(UI), mod.CreateVector(160, 70, 0))
    mod.SetUITextSize(mod.FindUIWidgetWithName(UI), 64)
    mod.SetUIWidgetPosition(mod.FindUIWidgetWithName(UI), Position)
}
function setupScoreUI(LeftScore: string, RightScore: string, LeftBar: string, RightBar: string, Team: any) {


    mod.AddUIText(LeftScore, mod.GetVariable(ScorePositionLeftGlobalVar), mod.CreateVector(80, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.GetVariable(FriendlyBGColourGlobalVar), 0.8, mod.UIBgFill.Blur, mod.Message("{}", mod.GetVariable(mod.ObjectVariable(Team, TeamScoreTeamVar))), 32, mod.GetVariable(FriendlyTextColourGlobalVar), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, Team)
    mod.AddUIText(RightScore, mod.GetVariable(ScorePositionRightGlobalVar), mod.CreateVector(80, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.GetVariable(EnemyBGColourGlobalVar), 0.8, mod.UIBgFill.Blur, mod.Message("{}", mod.GetVariable(mod.ObjectVariable(mod.GetVariable(mod.ObjectVariable(Team, OtherTeamTeamVar)), TeamScoreTeamVar))), 32, mod.GetVariable(EnemyTextColourGlobalVar), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, Team)
    mod.AddUIText(LeftBar, mod.CreateVector(mod.Add(
        -260,
        mod.Divide(
            mod.Multiply(200, mod.Divide(
                mod.GetVariable(mod.ObjectVariable(Team, TeamScoreTeamVar)),
                mod.GetVariable(mod.ObjectVariable(Team, StartingScoreTeamVar)))),
            2)), 60, 0), mod.CreateVector(mod.Multiply(200, mod.Divide(
                mod.GetVariable(mod.ObjectVariable(Team, TeamScoreTeamVar)),
                mod.GetVariable(mod.ObjectVariable(Team, StartingScoreTeamVar)))), 10, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.GetVariable(FriendlyTextColourGlobalVar), 1, mod.UIBgFill.Solid, mod.Message(""), 32, mod.GetVariable(FriendlyTextColourGlobalVar), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, Team)
    mod.AddUIText(RightBar, mod.CreateVector(mod.Subtract(
        260,
        mod.Divide(
            mod.Multiply(200, mod.Divide(
                mod.GetVariable(mod.ObjectVariable(mod.GetVariable(mod.ObjectVariable(Team, OtherTeamTeamVar)), TeamScoreTeamVar)),
                mod.GetVariable(mod.ObjectVariable(mod.GetVariable(mod.ObjectVariable(Team, OtherTeamTeamVar)), StartingScoreTeamVar)))),
            2)), 60, 0), mod.CreateVector(mod.Multiply(200, mod.Divide(
                mod.GetVariable(mod.ObjectVariable(mod.GetVariable(mod.ObjectVariable(Team, OtherTeamTeamVar)), TeamScoreTeamVar)),
                mod.GetVariable(mod.ObjectVariable(mod.GetVariable(mod.ObjectVariable(Team, OtherTeamTeamVar)), StartingScoreTeamVar)))), 10, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.GetVariable(EnemyTextColourGlobalVar), 1, mod.UIBgFill.Solid, mod.Message(""), 32, mod.GetVariable(EnemyTextColourGlobalVar), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, Team)
}
function initObjectiveLetters() {
    const letters: string[] = [];
    for (let i = 0; i < 26; i++) {
        letters.push(String.fromCharCode(65 + i));
    }
    let arr = mod.EmptyArray();
    for (const letter of letters) {
        arr = mod.AppendToArray(arr, letter);
    }
    mod.SetVariable(FlagLettersGlobalVar, arr);
}
function initObjectiveTeamUI() {
    const items: string[] = [];
    for (let suffix = 1; suffix <= 4; suffix++) {
        for (let i = 0; i < 26; i++) {
            items.push(String.fromCharCode(65 + i) + suffix);
        }
    }
    let arr = mod.EmptyArray();
    for (const item of items) {
        arr = mod.AppendToArray(arr, item);
    }
    mod.SetVariable(ObjectiveTrackingUIGlobalVar, arr);
}
function addAI() {


    if (mod.GetVariable(EnableCustomAIGlobalVar)) {
        if (mod.LessThan(
            mod.CountOf(mod.AllPlayers()),
            mod.GetVariable(MaxCustomAIGlobalVar))) {
            if (mod.GreaterThan(
                mod.CountOf(filterModArray(
                    mod.AllPlayers(),
                    (currentArrayElement: any) => mod.Equals(
                        mod.GetTeam(currentArrayElement),
                        mod.GetTeam(1)))),
                mod.CountOf(filterModArray(
                    mod.AllPlayers(),
                    (currentArrayElement: any) => mod.Equals(
                        mod.GetTeam(currentArrayElement),
                        mod.GetTeam(2)))))) {
                mod.SpawnAIFromAISpawner(mod.GetSpawner(902), mod.Message(mod.ValueInArray(mod.GetVariable(BotNamesGlobalVar), botNameIndex)), mod.GetTeam(2))
            } else {
                mod.SpawnAIFromAISpawner(mod.GetSpawner(901), mod.Message(mod.ValueInArray(mod.GetVariable(BotNamesGlobalVar), botNameIndex)), mod.GetTeam(1))
            }
            const botNameCount = mod.CountOf(mod.GetVariable(BotNamesGlobalVar));
            if (botNameCount > 0) {
                botNameIndex = (botNameIndex + 1) % botNameCount;
            }
        } else {
        }
    }
}
function initBotNames() {
    const names: string[] = [
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
    ];
    let arr = mod.EmptyArray();
    for (const name of names) {
        arr = mod.AppendToArray(arr, name);
    }
    mod.SetVariable(BotNamesGlobalVar, arr);
}
function spawnAIObjectives(eventInfo: any) {


    if (mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle))) {
        mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_SpawnPlayerVar), mod.EmptyArray())
        mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_SpawnPlayerVar), filterModArray(
            mod.AllCapturePoints(),
            (currentArrayElement: any) => mod.And(
                mod.Equals(
                    mod.GetTeam(eventInfo.eventPlayer),
                    mod.GetCurrentOwnerTeam(currentArrayElement)),
                mod.GreaterThan(
                    mod.DistanceBetween(
                        mod.GetObjectPosition(mod.ClosestPlayerTo(mod.GetObjectPosition(currentArrayElement), mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), OtherTeamTeamVar)))),
                        mod.GetObjectPosition(currentArrayElement)),
                    40))))
        if (mod.GreaterThan(
            mod.CountOf(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_SpawnPlayerVar))),
            0)) {
            if (mod.And(
                mod.GetVariable(ConquestAssaultGlobalVar),
                mod.Equals(
                    mod.GetTeam(2),
                    mod.GetTeam(eventInfo.eventPlayer)))) {
                mod.Teleport(eventInfo.eventPlayer, mod.GetObjectPosition(mod.RandomValueInArray(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_SpawnPlayerVar)))), 1)
                deployAIVehicle(mod.RandomValueInArray(filterModArray(
                    mod.AllVehicles(),
                    (currentArrayElement: any) => mod.LessThan(
                        mod.CountOf(mod.GetAllPlayersInVehicle(currentArrayElement)),
                        2))), 60, eventInfo)
            }
            if (mod.LessThan(
                mod.RoundToInteger(mod.RandomReal(0, 5)),
                5)) {
                mod.Teleport(eventInfo.eventPlayer, mod.GetObjectPosition(mod.RandomValueInArray(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_SpawnPlayerVar)))), 1)
                deployAIVehicle(mod.RandomValueInArray(filterModArray(
                    mod.AllVehicles(),
                    (currentArrayElement: any) => mod.LessThan(
                        mod.CountOf(mod.GetAllPlayersInVehicle(currentArrayElement)),
                        2))), 60, eventInfo)
            }
        } else {
            if (mod.And(
                mod.GetVariable(ConquestAssaultGlobalVar),
                mod.Equals(
                    mod.GetTeam(2),
                    mod.GetTeam(eventInfo.eventPlayer)))) {
                mod.UndeployPlayer(eventInfo.eventPlayer)
            }
        }
    }
}
function initFlagCalls() {
    let arr = mod.EmptyArray();
    arr = mod.AppendToArray(arr, mod.VoiceOverFlags.Alpha);
    arr = mod.AppendToArray(arr, mod.VoiceOverFlags.Bravo);
    arr = mod.AppendToArray(arr, mod.VoiceOverFlags.Charlie);
    arr = mod.AppendToArray(arr, mod.VoiceOverFlags.Delta);
    arr = mod.AppendToArray(arr, mod.VoiceOverFlags.Echo);
    arr = mod.AppendToArray(arr, mod.VoiceOverFlags.Foxtrot);
    arr = mod.AppendToArray(arr, mod.VoiceOverFlags.Golf);
    arr = mod.AppendToArray(arr, mod.VoiceOverFlags.Hotel);
    arr = mod.AppendToArray(arr, mod.VoiceOverFlags.India);
    mod.SetVariable(FlagAnnounceGlobalVar, arr);
}
async function animateUIFlash(Team1UI: string, Team2UI: string) {


    mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(Team1UI), 1)
    mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(Team2UI), 1)
    for (let i = 10; i < 100; i += 10) {
        mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(Team1UI), mod.Subtract(
            1,
            mod.Divide(
                i,
                100)))
        mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(Team2UI), mod.Subtract(
            1,
            mod.Divide(
                i,
                100)))
        await mod.Wait(0.033)
    }
    mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(Team1UI), 0)
    mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(Team2UI), 0)
}
async function handleOutOfBounds(eventInfo: any) {

    const newState = !mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, IgnoreOOBPlayerVar)) && !mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar)) && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAlive);
    return newState;

    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar), true)
    mod.SkipManDown(eventInfo.eventPlayer, true)
    if (mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier)) {
        for (let CaptureTickVar = 10; CaptureTickVar < 0; CaptureTickVar += -1) {
            mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar), CaptureTickVar);
            while (mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar))) { await mod.Wait(1) }
            if (mod.Not(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar)))) {
                break
            }
        }
        if (mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar))) {
            if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
                mod.DealDamage(eventInfo.eventPlayer, 10000, eventInfo.eventPlayer)
            }
        }
        mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar), -1)
    } else {
        togglePlayerOOBUI(true, eventInfo)
        for (let CaptureTickVar = 10; CaptureTickVar < 0; CaptureTickVar += -1) {
            mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar), CaptureTickVar);
            mod.SetUITextLabel(mod.FindUIWidgetWithName("OOBCounter", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), mod.Message("{}", mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar))))
            mod.PlaySound(mod.GetVariable(OOBSoundGlobalVar), 0.7, eventInfo.eventPlayer)
            while (mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar))) { await mod.Wait(1) }
            if (mod.Not(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar)))) {
                break
            }
        }
        if (mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar))) {
            mod.DealDamage(eventInfo.eventPlayer, 10000, eventInfo.eventPlayer)
        }
        togglePlayerOOBUI(false, eventInfo)
        mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar), -1)
    }
}
function disableOutOfBounds(eventInfo: any) {

    const newState = mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar));
    return newState;

    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar), false)
    mod.SkipManDown(eventInfo.eventPlayer, false)
}
function deployAIVehicle(Vehicle: any, Distance: number, eventInfo: any) {

    const newState = mod.And(mod.IsPlayerValid(eventInfo.eventPlayer), mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle)));
    return newState;

    if (mod.LessThan(
        mod.DistanceBetween(
            mod.GetVehicleState(Vehicle, mod.VehicleStateVector.VehiclePosition),
            mod.GetObjectPosition(eventInfo.eventPlayer)),
        Distance)) {
        mod.AIBattlefieldBehavior(eventInfo.eventPlayer)
        mod.ForcePlayerToSeat(eventInfo.eventPlayer, Vehicle, -1)
    }
}
function startAIScouting(Player: any) {

    const newState = mod.IsPlayerValid(Player) && mod.GetSoldierState(Player, mod.SoldierStateBool.IsAlive) && !mod.GetSoldierState(Player, mod.SoldierStateBool.IsInVehicle);
    return newState;

    if (mod.Equals(
        mod.CountOf(filterModArray(
            mod.AllCapturePoints(),
            (currentArrayElement: any) => mod.NotEqualTo(mod.GetTeam(Player), mod.GetCurrentOwnerTeam(currentArrayElement)))),
        0)) {
        mod.SetVariable(mod.ObjectVariable(Player, AI_TargetPlayerVar), mod.RandomValueInArray(filterModArray(
            mod.AllCapturePoints(),
            (currentArrayElement: any) => mod.Equals(
                mod.GetTeam(Player),
                mod.GetCurrentOwnerTeam(currentArrayElement)))))
        mod.AIDefendPositionBehavior(Player, mod.GetObjectPosition(mod.GetVariable(mod.ObjectVariable(Player, AI_TargetPlayerVar))), 0, 30)
    } else {
        mod.SetVariable(mod.ObjectVariable(Player, AI_TargetPlayerVar), mod.RandomValueInArray(filterModArray(
            mod.AllCapturePoints(),
            (currentArrayElement: any) => mod.NotEqualTo(mod.GetTeam(Player), mod.GetCurrentOwnerTeam(currentArrayElement)))))
        mod.AIMoveToBehavior(Player, mod.GetObjectPosition(mod.GetVariable(mod.ObjectVariable(Player, AI_TargetPlayerVar))))
    }
    if (mod.GreaterThan(
        mod.DistanceBetween(
            mod.GetObjectPosition(mod.ClosestPlayerTo(mod.GetObjectPosition(Player), mod.GetVariable(mod.ObjectVariable(mod.GetTeam(Player), OtherTeamTeamVar)))),
            mod.GetObjectPosition(Player)),
        30)) {
        mod.AISetMoveSpeed(Player, mod.MoveSpeed.Sprint)
    } else {
        mod.AISetMoveSpeed(Player, mod.MoveSpeed.InvestigateRun)
    }
}
function updateFlagIcons() {


    for (let i = 0; i < mod.CountOf(mod.AllCapturePoints()); i++) {
        
        if (mod.Equals(
            mod.GetCurrentOwnerTeam(mod.GetCapturePoint(mod.Add(
                200,
                i))),
            mod.GetTeam(1))) {
            mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), i)), mod.GetVariable(FriendlyTextColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), i)), mod.GetVariable(FriendlyBGColourGlobalVar))
            mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                i,
                26))), mod.GetVariable(EnemyTextColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                i,
                26))), mod.GetVariable(EnemyBGColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                i,
                52))), mod.GetVariable(FriendlyTextColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                i,
                78))), mod.GetVariable(EnemyTextColourGlobalVar))
        } else if (mod.Equals(
            mod.GetCurrentOwnerTeam(mod.GetCapturePoint(mod.Add(
                200,
                i))),
            mod.GetTeam(2))) {
            mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), i)), mod.GetVariable(EnemyTextColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), i)), mod.GetVariable(EnemyBGColourGlobalVar))
            mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                i,
                26))), mod.GetVariable(FriendlyTextColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                i,
                26))), mod.GetVariable(FriendlyBGColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                i,
                52))), mod.GetVariable(EnemyTextColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                i,
                78))), mod.GetVariable(FriendlyTextColourGlobalVar))
        } else {
            mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), i)), mod.CreateVector(0.9, 0.9, 0.9))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), i)), mod.CreateVector(0, 0, 0))
            mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                i,
                26))), mod.CreateVector(0.9, 0.9, 0.9))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                i,
                26))), mod.CreateVector(0, 0, 0))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                i,
                52))), mod.CreateVector(0.9, 0.9, 0.9))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                i,
                78))), mod.CreateVector(0.9, 0.9, 0.9))
        }
    }
}
function showVersion() {


    mod.AddUIText("ver", mod.CreateVector(10, 2, 0), mod.CreateVector(300, 30, 0), mod.UIAnchor.BottomLeft, mod.GetUIRoot(), true, 0, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.None, mod.Message("ViperStudiosAndy | andy6170 | Conquest Template V10"), 12, mod.CreateVector(1, 1, 1), 0.3, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI)
}
function updatePlayerCaptureUI(eventInfo: any) {


    mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("ObjProgress", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), mod.ValueInArray(mod.GetVariable(CaptureProgressPositionGlobalVar), mod.GetObjId(eventInfo.eventCapturePoint)))
    mod.SetUIWidgetSize(mod.FindUIWidgetWithName("ObjProgress", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), mod.ValueInArray(mod.GetVariable(CaptureProgressSizeGlobalVar), mod.GetObjId(eventInfo.eventCapturePoint)))
    mod.SetUITextColor(mod.FindUIWidgetWithName("ObjText", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), mod.ValueInArray(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), Cap_TextColourTeamVar)), mod.GetObjId(eventInfo.eventCapturePoint)))
    mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName("ObjText", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), mod.ValueInArray(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), Cap_BGColourTeamVar)), mod.GetObjId(eventInfo.eventCapturePoint)))
    mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName("ObjProgressBG", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), mod.ValueInArray(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), Cap_ProgressTeamVar)), mod.GetObjId(eventInfo.eventCapturePoint)))
    if (mod.Equals(
        mod.GetTeam(eventInfo.eventPlayer),
        mod.GetOwnerProgressTeam(eventInfo.eventCapturePoint))) {
        mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName("ObjProgress", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), mod.GetVariable(FriendlyTextColourGlobalVar))
    } else {
        mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName("ObjProgress", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), mod.GetVariable(EnemyTextColourGlobalVar))
    }
    updateObjectiveUI(mod.ValueInArray(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), Cap_MessageTeamVar)), mod.GetObjId(eventInfo.eventCapturePoint)), eventInfo)
    if (mod.NotEqualTo(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointStatePlayerVar)), mod.GetCaptureProgress(eventInfo.eventCapturePoint))) {
        mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar), mod.Add(
            mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar)),
            1))
        if (mod.Equals(
            mod.Modulo(
                mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar)),
                10),
            0)) {
            if (mod.GreaterThan(
                mod.GetCaptureProgress(eventInfo.eventCapturePoint),
                mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointStatePlayerVar)))) {
                if (mod.Equals(
                    mod.GetTeam(eventInfo.eventPlayer),
                    mod.GetOwnerProgressTeam(eventInfo.eventCapturePoint))) {
                    mod.PlaySound(mod.GetVariable(TickSoundTakingGlobalVar), 0.5, eventInfo.eventPlayer)
                } else {
                    mod.PlaySound(mod.GetVariable(TickSoundLosingGlobalVar), 0.5, eventInfo.eventPlayer)
                }
            } else {
                if (mod.Equals(
                    mod.GetTeam(eventInfo.eventPlayer),
                    mod.GetOwnerProgressTeam(eventInfo.eventCapturePoint))) {
                    mod.PlaySound(mod.GetVariable(TickSoundLosingGlobalVar), 0.5, eventInfo.eventPlayer)
                } else {
                    mod.PlaySound(mod.GetVariable(TickSoundTakingGlobalVar), 0.5, eventInfo.eventPlayer)
                }
            }
        }
    } else {
        mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar), 0)
    }
}
function togglePlayerCaptureUI(Enable: boolean, eventInfo: any) {


    mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("ObjText", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), Enable)
    mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("ObjCounter", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), Enable)
    mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("ObjProgress", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), Enable)
    mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("ObjProgressBG", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), Enable)
}
function setupPlayerUI(eventInfo: any) {


    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar), mod.ValueInArray(mod.GetVariable(ID_PoolGlobalVar), 0))
    if (isTrueForAny(
        mod.GetVariable(UniqueUI_ID_UsedGlobalVar),
        (currentArrayElement: any) => mod.Equals(
            currentArrayElement,
            mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))))) {
        mod.DeleteUIWidget(mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))))
        mod.SetVariable(UniqueUI_ID_UsedGlobalVar, filterModArray(
            mod.GetVariable(UniqueUI_ID_UsedGlobalVar),
            (currentArrayElement: any) => mod.NotEqualTo(currentArrayElement, mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))))
    }
    mod.SetVariable(ID_PoolGlobalVar, filterModArray(
        mod.GetVariable(ID_PoolGlobalVar),
        (currentArrayElement: any) => mod.NotEqualTo(currentArrayElement, mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))))
    mod.SetVariable(UniqueUI_ID_UsedGlobalVar, mod.AppendToArray(mod.GetVariable(UniqueUI_ID_UsedGlobalVar), mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))))
    mod.AddUIContainer(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)), mod.CreateVector(0, 0, 0), mod.CreateVector(10000, 10000, 0), mod.UIAnchor.TopCenter, eventInfo.eventPlayer)
    mod.SetUIWidgetBgFill(mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))), mod.UIBgFill.None)
    mod.SetUIWidgetDepth(mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))), mod.UIDepth.AboveGameUI)
    if (mod.LessThanEqualTo(mod.CountOf(mod.GetVariable(ID_PoolGlobalVar)), 1)) {
        initPlayerUIIds()
        for (let i = 0; i < mod.CountOf(mod.AllPlayers()); i++) {
            mod.SetVariable(ID_PoolGlobalVar, filterModArray(
                mod.GetVariable(ID_PoolGlobalVar),
                (currentArrayElement: any) => mod.NotEqualTo(currentArrayElement, mod.GetVariable(mod.ObjectVariable(mod.ValueInArray(mod.AllPlayers(), i), UniqueIDPlayerVar)))))
        }
    }
    mod.AddUIText("ObjText", mod.CreateVector(0, 150, 0), mod.CreateVector(220, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))), false, 1, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Blur, mod.Message(""), 36, mod.CreateVector(0, 0, 0), 1, mod.UIAnchor.Center, eventInfo.eventPlayer)
    mod.AddUIText("ObjCounter", mod.CreateVector(0, 210, 0), mod.CreateVector(220, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))), false, 1, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.None, mod.Message(""), 28, mod.CreateVector(0, 0, 0), 1, mod.UIAnchor.Center, eventInfo.eventPlayer)
    mod.AddUIContainer("ObjProgressBG", mod.CreateVector(0, 200, 0), mod.CreateVector(220, 7, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))), false, 1, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Blur, eventInfo.eventPlayer)
    mod.AddUIContainer("ObjProgress", mod.CreateVector(0, 200, 0), mod.CreateVector(220, 7, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))), false, 1, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.Solid, eventInfo.eventPlayer)
    mod.AddUIText("OOBBackground", mod.CreateVector(0, 0, 0), mod.CreateVector(5000, 5000, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))), false, 1, mod.CreateVector(0, 0, 0), 0.9, mod.UIBgFill.Blur, mod.Message(""), 24, mod.CreateVector(0, 0, 0), 1, mod.UIAnchor.Center, eventInfo.eventPlayer)
    mod.AddUIText("OOBText", mod.CreateVector(0, 470, 0), mod.CreateVector(400, 150, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))), false, 1, mod.GetVariable(EnemyBGColourGlobalVar), 0.8, mod.UIBgFill.Blur, mod.Message("Return To Combat"), 56, mod.GetVariable(EnemyTextColourGlobalVar), 1, mod.UIAnchor.TopCenter, eventInfo.eventPlayer)
    mod.AddUIText("OOBCounter", mod.CreateVector(0, 470, 0), mod.CreateVector(400, 150, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))), false, 1, mod.CreateVector(0, 0, 0), 0, mod.UIBgFill.None, mod.Message("{}", mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar))), 72, mod.GetVariable(EnemyTextColourGlobalVar), 1, mod.UIAnchor.BottomCenter, eventInfo.eventPlayer)
}
function manageCapturePointUI(Flag: any, OldProggress: number, eventInfo: any) {


    if (mod.Equals(
        mod.GetCurrentOwnerTeam(Flag),
        mod.GetTeam(1))) {
        mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(1), Cap_TextColourTeamVar), mod.GetObjId(Flag), mod.GetVariable(FriendlyTextColourGlobalVar))
        mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(1), Cap_BGColourTeamVar), mod.GetObjId(Flag), mod.GetVariable(FriendlyBGColourGlobalVar))
        mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(2), Cap_TextColourTeamVar), mod.GetObjId(Flag), mod.GetVariable(EnemyTextColourGlobalVar))
        mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(2), Cap_BGColourTeamVar), mod.GetObjId(Flag), mod.GetVariable(EnemyBGColourGlobalVar))
    } else if (mod.Equals(
        mod.GetCurrentOwnerTeam(Flag),
        mod.GetTeam(2))) {
        mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(2), Cap_TextColourTeamVar), mod.GetObjId(Flag), mod.GetVariable(FriendlyTextColourGlobalVar))
        mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(2), Cap_BGColourTeamVar), mod.GetObjId(Flag), mod.GetVariable(FriendlyBGColourGlobalVar))
        mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(1), Cap_TextColourTeamVar), mod.GetObjId(Flag), mod.GetVariable(EnemyTextColourGlobalVar))
        mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(1), Cap_BGColourTeamVar), mod.GetObjId(Flag), mod.GetVariable(EnemyBGColourGlobalVar))
    } else {
        mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(1), Cap_TextColourTeamVar), mod.GetObjId(Flag), mod.CreateVector(1, 1, 1))
        mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(1), Cap_BGColourTeamVar), mod.GetObjId(Flag), mod.CreateVector(0, 0, 0))
        mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(2), Cap_TextColourTeamVar), mod.GetObjId(Flag), mod.CreateVector(1, 1, 1))
        mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(2), Cap_BGColourTeamVar), mod.GetObjId(Flag), mod.CreateVector(0, 0, 0))
    }
    if (mod.LessThan(
        mod.GetCaptureProgress(mod.GetCapturePoint(mod.GetObjId(Flag))),
        1)) {
        if (mod.Equals(
            mod.GetOwnerProgressTeam(eventInfo.eventCapturePoint),
            mod.GetTeam(1))) {
            if (mod.GreaterThan(
                mod.GetCaptureProgress(eventInfo.eventCapturePoint),
                OldProggress)) {
                mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(1), Cap_MessageTeamVar), mod.GetObjId(Flag), "CAPTURING")
                mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(2), Cap_MessageTeamVar), mod.GetObjId(Flag), "LOSING")
            } else if (mod.LessThan(
                mod.GetCaptureProgress(eventInfo.eventCapturePoint),
                OldProggress)) {
                mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(1), Cap_MessageTeamVar), mod.GetObjId(Flag), "LOSING")
                mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(2), Cap_MessageTeamVar), mod.GetObjId(Flag), "CAPTURING")
            } else {
                mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(1), Cap_MessageTeamVar), mod.GetObjId(Flag), "CONTESTED")
                mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(2), Cap_MessageTeamVar), mod.GetObjId(Flag), "CONTESTED")
            }
        } else {
            if (mod.GreaterThan(
                mod.GetCaptureProgress(eventInfo.eventCapturePoint),
                OldProggress)) {
                mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(1), Cap_MessageTeamVar), mod.GetObjId(Flag), "LOSING")
                mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(2), Cap_MessageTeamVar), mod.GetObjId(Flag), "CAPTURING")
            } else if (mod.LessThan(
                mod.GetCaptureProgress(eventInfo.eventCapturePoint),
                OldProggress)) {
                mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(1), Cap_MessageTeamVar), mod.GetObjId(Flag), "CAPTURING")
                mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(2), Cap_MessageTeamVar), mod.GetObjId(Flag), "LOSING")
            } else {
                mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(1), Cap_MessageTeamVar), mod.GetObjId(Flag), "CONTESTED")
                mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(2), Cap_MessageTeamVar), mod.GetObjId(Flag), "CONTESTED")
            }
        }
    } else {
        if (mod.Equals(
            mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
            mod.GetTeam(1))) {
            mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(1), Cap_MessageTeamVar), mod.GetObjId(Flag), "SECURED")
            mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(2), Cap_MessageTeamVar), mod.GetObjId(Flag), "CONTESTED")
        } else {
            mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(1), Cap_MessageTeamVar), mod.GetObjId(Flag), "CONTESTED")
            mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(2), Cap_MessageTeamVar), mod.GetObjId(Flag), "SECURED")
        }
    }
}
async function applyRepelForce(Time: number, eventInfo: any) {


    if (mod.GreaterThan(
        mod.YComponentOf(mod.GetObjectPosition(mod.GetSpatialObject(mod.Add(
            mod.GetObjId(eventInfo.eventInteractPoint),
            50)))),
        mod.YComponentOf(mod.GetObjectPosition(eventInfo.eventPlayer)))) {
        mod.SetObjectTransformOverTime(eventInfo.eventPlayer, mod.CreateTransform(mod.Add(
            mod.CreateVector(mod.XComponentOf(mod.GetObjectPosition(eventInfo.eventPlayer)), mod.YComponentOf(mod.GetObjectPosition(mod.GetSpatialObject(mod.Add(
                mod.GetObjId(eventInfo.eventInteractPoint),
                50)))), mod.ZComponentOf(mod.GetObjectPosition(eventInfo.eventPlayer))),
            mod.UpVector()), mod.CreateVector(0, mod.YComponentOf(mod.GetObjectRotation(eventInfo.eventPlayer)), 0)), Time, false, false)
    } else {
        mod.Teleport(eventInfo.eventPlayer, mod.CreateVector(mod.XComponentOf(mod.GetObjectPosition(mod.GetSpatialObject(mod.Add(
            mod.GetObjId(eventInfo.eventInteractPoint),
            50)))), mod.YComponentOf(mod.GetObjectPosition(eventInfo.eventPlayer)), mod.ZComponentOf(mod.GetObjectPosition(mod.GetSpatialObject(mod.Add(
                mod.GetObjId(eventInfo.eventInteractPoint),
                50))))), mod.YComponentOf(mod.GetObjectRotation(eventInfo.eventPlayer)))
        await mod.Wait(0.1)
        mod.SetObjectTransformOverTime(eventInfo.eventPlayer, mod.CreateTransform(mod.Add(
            mod.GetObjectPosition(mod.GetSpatialObject(mod.Add(
                mod.GetObjId(eventInfo.eventInteractPoint),
                50))),
            mod.Multiply(mod.UpVector(), 3)), mod.CreateVector(0, mod.YComponentOf(mod.GetObjectRotation(eventInfo.eventPlayer)), 0)), Time, false, false)
    }
    await mod.Wait(mod.Add(
        Time,
        0.1))
    mod.Teleport(eventInfo.eventPlayer, mod.GetObjectPosition(mod.GetSpatialObject(mod.Add(
        mod.GetObjId(eventInfo.eventInteractPoint),
        50))), mod.YComponentOf(mod.GetObjectRotation(eventInfo.eventPlayer)))
}
async function resetFX(eventInfo: any) {


    while (mod.GetVariable(resetFXingGlobalVar)) {
        await mod.Wait(1)
    }
    mod.SetVariable(resetFXingGlobalVar, true)
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
    mod.SetVariable(resetFXingGlobalVar, false)
}
async function deployAI(eventInfo: any) {


    spawnAIObjectives(eventInfo)
    await mod.Wait(0.2)
    if (mod.Equals(
        mod.RoundToInteger(mod.RandomReal(0, 1)),
        0)) {
        deployAIVehicle(mod.RandomValueInArray(filterModArray(
            mod.AllVehicles(),
            (currentArrayElement: any) => mod.And(
                mod.LessThan(
                    mod.CountOf(mod.GetAllPlayersInVehicle(currentArrayElement)),
                    2),
                mod.LessThan(
                    mod.DistanceBetween(
                        mod.GetVehicleState(currentArrayElement, mod.VehicleStateVector.VehiclePosition),
                        mod.GetObjectPosition(eventInfo.eventPlayer)),
                    150)))), 150, eventInfo)
    }
    await mod.Wait(0.2)
    startAIScouting(eventInfo.eventPlayer)
}
function checkConquestAssaultWin() {

    const newState = mod.GetVariable(ConquestAssaultGlobalVar) && mod.GreaterThan(
        mod.GetMatchTimeElapsed(),
        10) && mod.Equals(
            mod.CountOf(filterModArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.NotEqualTo(mod.GetTeam(2), mod.GetCurrentOwnerTeam(currentArrayElement)))),
            0) && mod.Equals(
                mod.CountOf(filterModArray(
                    mod.AllPlayers(),
                    (currentArrayElement: any) => mod.NotEqualTo(mod.Equals(
                        mod.GetTeam(2),
                        mod.GetTeam(currentArrayElement)), mod.GetSoldierState(currentArrayElement, mod.SoldierStateBool.IsAlive)))),
                0);
    return newState;

    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar), 0)
}
function togglePlayerOOBUI(Enable: boolean, eventInfo: any) {


    mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("OOBBackground", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), Enable)
    mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("OOBText", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), Enable)
    mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("OOBCounter", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), Enable)
}
// global vars
const tempGlobalVar = mod.GlobalVariable(0)
const iteratorGlobalVar = mod.GlobalVariable(1)
const LowTicketMusicGlobalVar = mod.GlobalVariable(2)
const TotalControlTicketBleedGlobalVar = mod.GlobalVariable(3)
const ScorePositionLeftGlobalVar = mod.GlobalVariable(4)
const CaptureProgressSizeGlobalVar = mod.GlobalVariable(5)
const EnableVOGlobalVar = mod.GlobalVariable(6)
const Snow_ColourFilterGlobalVar = mod.GlobalVariable(7)
const VO5GlobalVar = mod.GlobalVariable(8)
const ScorePositionRightGlobalVar = mod.GlobalVariable(9)
const StartingScoreGlobalVar = mod.GlobalVariable(10)
const iterator2GlobalVar = mod.GlobalVariable(11)
const FlagNeutralTimeGlobalVar = mod.GlobalVariable(12)
const AppendGlobalVar = mod.GlobalVariable(13)
const nameIndexGlobalVar = mod.GlobalVariable(14)
const UniqueUI_ID_UsedGlobalVar = mod.GlobalVariable(15)
const iterator3GlobalVar = mod.GlobalVariable(16)
const resetFXingGlobalVar = mod.GlobalVariable(17)
const CaptureProgressPositionGlobalVar = mod.GlobalVariable(18)
const VO6GlobalVar = mod.GlobalVariable(19)
const TickSoundLosingGlobalVar = mod.GlobalVariable(20)
const EnemyTextColourGlobalVar = mod.GlobalVariable(21)
const TicketBleedSpeedGlobalVar = mod.GlobalVariable(22)
const BF3_ColourFilterGlobalVar = mod.GlobalVariable(23)
const CapturepointFlashGlobalVar = mod.GlobalVariable(24)
const VO4GlobalVar = mod.GlobalVariable(25)
const PlayerDeathsBleedGlobalVar = mod.GlobalVariable(26)
const EnableSnowGlobalVar = mod.GlobalVariable(27)
const SnowGlobalVar = mod.GlobalVariable(28)
const CapturePointProgressGlobalVar = mod.GlobalVariable(29)
const TimeLimitGlobalVar = mod.GlobalVariable(30)
const OOBSoundGlobalVar = mod.GlobalVariable(31)
const CapturedSoundGlobalVar = mod.GlobalVariable(32)
const VO1GlobalVar = mod.GlobalVariable(33)
const LoserOnlyTicketBleedGlobalVar = mod.GlobalVariable(34)
const ID_PoolGlobalVar = mod.GlobalVariable(35)
const FriendlyTextColourGlobalVar = mod.GlobalVariable(36)
const ConquestAssaultGlobalVar = mod.GlobalVariable(37)
const PlayersOnObjectiveGlobalVar = mod.GlobalVariable(38)
const VO3GlobalVar = mod.GlobalVariable(39)
const MaxCustomAIGlobalVar = mod.GlobalVariable(40)
const EnableTeamSwitchingGlobalVar = mod.GlobalVariable(41)
const BotNamesGlobalVar = mod.GlobalVariable(42)
const iterator4GlobalVar = mod.GlobalVariable(43)
const TickSoundTakingGlobalVar = mod.GlobalVariable(44)
const BF4_ColourFilterGlobalVar = mod.GlobalVariable(45)
const TotalControlBonusGlobalVar = mod.GlobalVariable(46)
const EnemyBGColourGlobalVar = mod.GlobalVariable(47)
const FlagLettersGlobalVar = mod.GlobalVariable(48)
const FlagAnnounceGlobalVar = mod.GlobalVariable(49)
const GameOngoingGlobalVar = mod.GlobalVariable(50)
const GivePlayersNVGGlobalVar = mod.GlobalVariable(51)
const ObjectiveTrackingUIGlobalVar = mod.GlobalVariable(52)
const FriendlyBGColourGlobalVar = mod.GlobalVariable(53)
const FlagCaptureTimeGlobalVar = mod.GlobalVariable(54)
const EnableCustomAIGlobalVar = mod.GlobalVariable(55)
const VO2GlobalVar = mod.GlobalVariable(56)

// player vars
const OutOfBoundsPlayerVar = 0;
const UniqueIDPlayerVar = 1;
const AI_TargetPlayerVar = 2;
const CapturePointStatePlayerVar = 3;
const PlayerDeathsPlayerVar = 4;
const RevivesPlayerVar = 5;
const CapturesPlayerVar = 6;
const CapturePointPlayerVar = 7;
const iteratorPlayerVar = 8;
const FlagOwnerPlayerVar = 9;
const KillAssistsPlayerVar = 10;
const ScorePlayerVar = 11;
const AI_InActionPlayerVar = 12;
const PlayerKillsPlayerVar = 13;
const OnPointPlayerVar = 14;
const StartPositionPlayerVar = 15;
const CaptureTickPlayerVar = 16;
const AI_SpawnPlayerVar = 17;
const IgnoreOOBPlayerVar = 18;

// team vars
const Cap_MessageTeamVar = 0;
const Cap_TextColourTeamVar = 1;
const PlayersOnPointTeamVar = 2;
const Cap_BGColourTeamVar = 3;
const FactionTeamVar = 4;
const Cap_ProgressTeamVar = 5;
const OtherTeamTeamVar = 6;
const TeamScoreTeamVar = 7;
const StartingScoreTeamVar = 8;

// capture point vars

// mcom vars

// vehicle vars

export function OngoingGlobal() {
    ensureStateInitialized();
    const eventInfo = {};
    let eventNum = 0;
    initGameSettingsRule(getGlobalCondition(eventNum++));
    updateScoreTimeRule(getGlobalCondition(eventNum++));
    updateScoreTimeSecondaryTickRule(getGlobalCondition(eventNum++));
    trackScoreRule(getGlobalCondition(eventNum++));
    playNearEndMusicRule(getGlobalCondition(eventNum++));
    endGameRule(getGlobalCondition(eventNum++));
    playVOLowTimeRule(getGlobalCondition(eventNum++));
    playVOWinningRule(getGlobalCondition(eventNum++));
    playVOTeam2WinningRule(getGlobalCondition(eventNum++));
    playVOLowTicketsRule(getGlobalCondition(eventNum++));
    playVOTeam2LowTicketsRule(getGlobalCondition(eventNum++));
}

export function OnGameModeStarted() {
    ensureStateInitialized();
    const eventInfo = {};
    let eventNum = 11;
    setupMapRule(getGlobalCondition(eventNum++));
}

export function OnPlayerEarnedKill(eventPlayer: mod.Player, eventOtherPlayer: mod.Player, eventDeathType: mod.DeathType, eventWeaponUnlock: mod.WeaponUnlock) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventOtherPlayer, eventDeathType, eventWeaponUnlock };
    let eventNum = 0;
    processKillRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
    aiTargetOnKillRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerEarnedKillAssist(eventPlayer: mod.Player, eventOtherPlayer: mod.Player) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventOtherPlayer };
    let eventNum = 2;
    processAssistRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
    aiTargetOnKillAssistRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnRevived(eventPlayer: mod.Player, eventOtherPlayer: mod.Player) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventOtherPlayer };
    let eventNum = 4;
    processReviveRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
    updatePlayerCountOnReviveRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerDied(eventPlayer: mod.Player, eventOtherPlayer: mod.Player, eventDeathType: mod.DeathType, eventWeaponUnlock: mod.WeaponUnlock) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventOtherPlayer, eventDeathType, eventWeaponUnlock };
    let eventNum = 6;
    handlePlayerDeathRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
    updatePlayerCountOnDeathRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerDeployed(eventPlayer: mod.Player) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer };
    let eventNum = 8;
    addEquipmentRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
    aiScoutOnDeployRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
    aiReadyForAttackRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerJoinGame(eventPlayer: mod.Player) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer };
    let eventNum = 11;
    handlePlayerJoinRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerUndeploy(eventPlayer: mod.Player) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer };
    let eventNum = 12;
    updateDeathOnUndeployRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnCapturePointCaptured(eventCapturePoint: mod.CapturePoint) {
    ensureStateInitialized();
    const eventInfo = { eventCapturePoint };
    let eventNum = 0;
    handleCapturePointCapturedRule(getCapturePointCondition(eventCapturePoint, eventNum++), eventInfo);
}

export function OnCapturePointCapturing(eventCapturePoint: mod.CapturePoint) {
    ensureStateInitialized();
    const eventInfo = { eventCapturePoint };
    let eventNum = 1;
    notifyCaptureRule(getCapturePointCondition(eventCapturePoint, eventNum++), eventInfo);
}

export function OnPlayerEnterCapturePoint(eventPlayer: mod.Player, eventCapturePoint: mod.CapturePoint) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventCapturePoint };
    let eventNum = 13;
    showCaptureUIRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
    aiFindNewObjectiveRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerExitCapturePoint(eventPlayer: mod.Player, eventCapturePoint: mod.CapturePoint) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventCapturePoint };
    let eventNum = 15;
    hideCaptureUIRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerInteract(eventPlayer: mod.Player, eventInteractPoint: mod.InteractPoint) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventInteractPoint };
    let eventNum = 16;
    handleTeamSwitchAndRepelRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerEnterAreaTrigger(eventPlayer: mod.Player, eventAreaTrigger: mod.AreaTrigger) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventAreaTrigger };
    let eventNum = 17;
    enterAreaTriggerRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerExitAreaTrigger(eventPlayer: mod.Player, eventAreaTrigger: mod.AreaTrigger) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventAreaTrigger };
    let eventNum = 18;
    exitAreaTriggerRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OngoingCapturePoint(eventCapturePoint: mod.CapturePoint) {
    ensureStateInitialized();
    const eventInfo = { eventCapturePoint: eventCapturePoint };
    let eventNum = 2;
    runCaptureProgressRule(getCapturePointCondition(eventCapturePoint, eventNum++), eventInfo);
}

export function OnPlayerDamaged(eventPlayer: mod.Player, eventOtherPlayer: mod.Player, eventDamageType: mod.DamageType, eventWeaponUnlock: mod.WeaponUnlock) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventOtherPlayer, eventDamageType, eventWeaponUnlock };
    let eventNum = 19;
    aiTargetDamagerRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerExitVehicle(eventPlayer: mod.Player, eventVehicle: mod.Vehicle) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventVehicle };
    let eventNum = 20;
    aiExitVehicleRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerEnterVehicle(eventPlayer: mod.Player, eventVehicle: mod.Vehicle) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer, eventVehicle };
    let eventNum = 21;
    aiEnterVehicleRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnAIMoveToFailed(eventPlayer: mod.Player) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer };
    let eventNum = 22;
    aiRetryMoveRule(getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}
