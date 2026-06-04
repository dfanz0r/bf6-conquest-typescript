
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

// ============================================================
// EVENT INFO TYPES (Phase 10)
// ============================================================

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

// ============================================================
// STATE FOUNDATION (Phase 1)
// ============================================================

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
    vo1: null as mod.VO | null,
    vo2: null as mod.VO | null,
    vo3: null as mod.VO | null,
    vo4: null as mod.VO | null,
    vo5: null as mod.VO | null,
    vo6: null as mod.VO | null,
    tickSoundTaking: null as mod.SFX | null,
    tickSoundLosing: null as mod.SFX | null,
    capturedSound: null as mod.SFX | null,
    oobSound: null as mod.SFX | null,
};

let snowVolume: mod.SpatialObject | null = null;

// --- 1d. Static Portal Arrays ---

let flagAnnounce: mod.Array;
let flagLetters: mod.Array;
let botNames: mod.Array;
let objectiveTrackingUI: mod.Array;

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
    aiSpawnPoints: mod.Array = undefined!;
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
    // Populate static arrays
    initObjectiveLetters();
    initObjectiveTeamUI();
    initBotNames();
    initFlagCalls();
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

function playerRootWidgetName(playerId: number): string {
    return "PlayerRoot_" + playerId;
}

function removePlayerStateById(playerId: number): void {
    mod.DeleteUIWidget(mod.FindUIWidgetWithName(playerRootWidgetName(playerId)));
    const state = playerStates.get(playerId);
    if (state) {
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
// MANAGER SHELLS (Phase 10)
// ============================================================

class UIController {
    updatePlayerScoreboard(player: mod.Player): void {
        mod.SetScoreboardPlayerValues(player, getPlayerState(player).score, getPlayerState(player).kills, getPlayerState(player).deaths, getPlayerState(player).assists, getPlayerState(player).captures)
    }

    updateObjectiveUI(label: string, eventInfo: PlayerCapturePointEventInfo): void {
        mod.SetUITextLabel(mod.FindUIWidgetWithName("ObjText", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), mod.Message(label))
        mod.SetUITextLabel(mod.FindUIWidgetWithName("ObjCounter", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), mod.Message("{} - {}", getTeamState(mod.GetTeam(eventInfo.eventPlayer)).playersOnPoints.get(mod.GetObjId(eventInfo.eventCapturePoint)) ?? 0, getTeamState(getTeamState(mod.GetTeam(eventInfo.eventPlayer)).otherTeam).playersOnPoints.get(mod.GetObjId(eventInfo.eventCapturePoint)) ?? 0))
        if (mod.Or(
            mod.Equals(
                getTeamState(mod.GetTeam(eventInfo.eventPlayer)).playersOnPoints.get(mod.GetObjId(eventInfo.eventCapturePoint)) ?? 0,
                0),
            mod.GreaterThan(
                getTeamState(mod.GetTeam(eventInfo.eventPlayer)).playersOnPoints.get(mod.GetObjId(eventInfo.eventCapturePoint)) ?? 0,
                getTeamState(getTeamState(mod.GetTeam(eventInfo.eventPlayer)).otherTeam).playersOnPoints.get(mod.GetObjId(eventInfo.eventCapturePoint)) ?? 0))) {
            mod.SetUITextColor(mod.FindUIWidgetWithName("ObjCounter", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), mod.CreateVector(1, 1, 1))
        } else {
            mod.SetUITextColor(mod.FindUIWidgetWithName("ObjCounter", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), enemyTextColour)
        }
    }

    setupMainUI(): void {
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
        mod.AddUIText("LeftBarBG", mod.CreateVector(-160, 60, 0), mod.CreateVector(200, 10, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, friendlyBGColour, 0.8, mod.UIBgFill.Blur, mod.Message(""), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI)
        mod.AddUIText("RightBarBG", mod.CreateVector(160, 60, 0), mod.CreateVector(200, 10, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, enemyBGColour, 0.8, mod.UIBgFill.Blur, mod.Message(""), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI)
        this.setupScoreUI("Team1ScoreLeft", "Team1ScoreRight", "Team1LeftBar", "Team1RightBar", mod.GetTeam(1))
        this.setupScoreUI("Team2ScoreLeft", "Team2ScoreRight", "Team2LeftBar", "Team2RightBar", mod.GetTeam(2))
        for (let i = 0; i < mod.CountOf(mod.AllCapturePoints()); i++) {
            mod.AddUIText(mod.ValueInArray(objectiveTrackingUI, i), mod.CreateVector(mod.Multiply(mod.Subtract(
                i,
                mod.Divide(
                    mod.Subtract(
                        mod.CountOf(mod.AllCapturePoints()),
                        1),
                    2)), 50), 90, 0), mod.CreateVector(30, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Blur, mod.Message(mod.ValueInArray(flagLetters, i)), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(1))
            mod.AddUIText(mod.ValueInArray(objectiveTrackingUI, mod.Add(
                52,
                i)), mod.CreateVector(mod.Multiply(mod.Subtract(
                    i,
                    mod.Divide(
                        mod.Subtract(
                            mod.CountOf(mod.AllCapturePoints()),
                            1),
                        2)), 50), 90, 0), mod.CreateVector(30, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.OutlineThin, mod.Message(""), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(1))
            mod.AddUIText(mod.ValueInArray(objectiveTrackingUI, mod.Add(
                26,
                i)), mod.CreateVector(mod.Multiply(mod.Subtract(
                    i,
                    mod.Divide(
                        mod.Subtract(
                            mod.CountOf(mod.AllCapturePoints()),
                            1),
                        2)), 50), 90, 0), mod.CreateVector(30, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Blur, mod.Message(mod.ValueInArray(flagLetters, i)), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(2))
            mod.AddUIText(mod.ValueInArray(objectiveTrackingUI, mod.Add(
                78,
                i)), mod.CreateVector(mod.Multiply(mod.Subtract(
                    i,
                    mod.Divide(
                        mod.Subtract(
                            mod.CountOf(mod.AllCapturePoints()),
                            1),
                        2)), 50), 90, 0), mod.CreateVector(30, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.OutlineThin, mod.Message(""), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(2))
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
        if (mod.Equals(
            mod.GetCurrentOwnerTeam(flag),
            mod.GetTeam(1))) {
            getTeamState(TEAM_1).capTextColours.set(mod.GetObjId(flag), friendlyTextColour)
            getTeamState(TEAM_1).capBGColours.set(mod.GetObjId(flag), friendlyBGColour)
            getTeamState(TEAM_2).capTextColours.set(mod.GetObjId(flag), enemyTextColour)
            getTeamState(TEAM_2).capBGColours.set(mod.GetObjId(flag), enemyBGColour)
        } else if (mod.Equals(
            mod.GetCurrentOwnerTeam(flag),
            mod.GetTeam(2))) {
            getTeamState(TEAM_2).capTextColours.set(mod.GetObjId(flag), friendlyTextColour)
            getTeamState(TEAM_2).capBGColours.set(mod.GetObjId(flag), friendlyBGColour)
            getTeamState(TEAM_1).capTextColours.set(mod.GetObjId(flag), enemyTextColour)
            getTeamState(TEAM_1).capBGColours.set(mod.GetObjId(flag), enemyBGColour)
        } else {
            getTeamState(TEAM_1).capTextColours.set(mod.GetObjId(flag), mod.CreateVector(1, 1, 1))
            getTeamState(TEAM_1).capBGColours.set(mod.GetObjId(flag), mod.CreateVector(0, 0, 0))
            getTeamState(TEAM_2).capTextColours.set(mod.GetObjId(flag), mod.CreateVector(1, 1, 1))
            getTeamState(TEAM_2).capBGColours.set(mod.GetObjId(flag), mod.CreateVector(0, 0, 0))
        }
        if (mod.LessThan(
            mod.GetCaptureProgress(mod.GetCapturePoint(mod.GetObjId(flag))),
            1)) {
            if (mod.Equals(
                mod.GetOwnerProgressTeam(eventInfo.eventCapturePoint),
                mod.GetTeam(1))) {
                if (mod.GreaterThan(
                    mod.GetCaptureProgress(eventInfo.eventCapturePoint),
                    oldProgress)) {
                    getTeamState(TEAM_1).capMessages.set(mod.GetObjId(flag), "CAPTURING")
                    getTeamState(TEAM_2).capMessages.set(mod.GetObjId(flag), "LOSING")
                } else if (mod.LessThan(
                    mod.GetCaptureProgress(eventInfo.eventCapturePoint),
                    oldProgress)) {
                    getTeamState(TEAM_1).capMessages.set(mod.GetObjId(flag), "LOSING")
                    getTeamState(TEAM_2).capMessages.set(mod.GetObjId(flag), "CAPTURING")
                } else {
                    getTeamState(TEAM_1).capMessages.set(mod.GetObjId(flag), "CONTESTED")
                    getTeamState(TEAM_2).capMessages.set(mod.GetObjId(flag), "CONTESTED")
                }
            } else {
                if (mod.GreaterThan(
                    mod.GetCaptureProgress(eventInfo.eventCapturePoint),
                    oldProgress)) {
                    getTeamState(TEAM_1).capMessages.set(mod.GetObjId(flag), "LOSING")
                    getTeamState(TEAM_2).capMessages.set(mod.GetObjId(flag), "CAPTURING")
                } else if (mod.LessThan(
                    mod.GetCaptureProgress(eventInfo.eventCapturePoint),
                    oldProgress)) {
                    getTeamState(TEAM_1).capMessages.set(mod.GetObjId(flag), "CAPTURING")
                    getTeamState(TEAM_2).capMessages.set(mod.GetObjId(flag), "LOSING")
                } else {
                    getTeamState(TEAM_1).capMessages.set(mod.GetObjId(flag), "CONTESTED")
                    getTeamState(TEAM_2).capMessages.set(mod.GetObjId(flag), "CONTESTED")
                }
            }
        } else {
            if (mod.Equals(
                mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
                mod.GetTeam(1))) {
                getTeamState(TEAM_1).capMessages.set(mod.GetObjId(flag), "SECURED")
                getTeamState(TEAM_2).capMessages.set(mod.GetObjId(flag), "CONTESTED")
            } else {
                getTeamState(TEAM_1).capMessages.set(mod.GetObjId(flag), "CONTESTED")
                getTeamState(TEAM_2).capMessages.set(mod.GetObjId(flag), "SECURED")
            }
        }
    }

    setupPlayerUI(player: mod.Player): void {
        const playerId = mod.GetObjId(player);
        const rootName = playerRootWidgetName(playerId);
        getPlayerState(player).uniqueUiId = rootName;

        mod.DeleteUIWidget(mod.FindUIWidgetWithName(rootName));
        mod.AddUIContainer(rootName, mod.CreateVector(0, 0, 0), mod.CreateVector(10000, 10000, 0), mod.UIAnchor.TopCenter, player)
        mod.SetUIWidgetBgFill(mod.FindUIWidgetWithName(rootName), mod.UIBgFill.None)
        mod.SetUIWidgetDepth(mod.FindUIWidgetWithName(rootName), mod.UIDepth.AboveGameUI)
        mod.AddUIText("ObjText", mod.CreateVector(0, 150, 0), mod.CreateVector(220, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName(getPlayerState(player).uniqueUiId), false, 1, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Blur, mod.Message(""), 36, mod.CreateVector(0, 0, 0), 1, mod.UIAnchor.Center, player)
        mod.AddUIText("ObjCounter", mod.CreateVector(0, 210, 0), mod.CreateVector(220, 40, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName(getPlayerState(player).uniqueUiId), false, 1, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.None, mod.Message(""), 28, mod.CreateVector(0, 0, 0), 1, mod.UIAnchor.Center, player)
        mod.AddUIContainer("ObjProgressBG", mod.CreateVector(0, 200, 0), mod.CreateVector(220, 7, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName(getPlayerState(player).uniqueUiId), false, 1, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Blur, player)
        mod.AddUIContainer("ObjProgress", mod.CreateVector(0, 200, 0), mod.CreateVector(220, 7, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName(getPlayerState(player).uniqueUiId), false, 1, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.Solid, player)
        mod.AddUIText("OOBBackground", mod.CreateVector(0, 0, 0), mod.CreateVector(5000, 5000, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName(getPlayerState(player).uniqueUiId), false, 1, mod.CreateVector(0, 0, 0), 0.9, mod.UIBgFill.Blur, mod.Message(""), 24, mod.CreateVector(0, 0, 0), 1, mod.UIAnchor.Center, player)
        mod.AddUIText("OOBText", mod.CreateVector(0, 470, 0), mod.CreateVector(400, 150, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName(getPlayerState(player).uniqueUiId), false, 1, enemyBGColour, 0.8, mod.UIBgFill.Blur, mod.Message("Return To Combat"), 56, enemyTextColour, 1, mod.UIAnchor.TopCenter, player)
        mod.AddUIText("OOBCounter", mod.CreateVector(0, 470, 0), mod.CreateVector(400, 150, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName(getPlayerState(player).uniqueUiId), false, 1, mod.CreateVector(0, 0, 0), 0, mod.UIBgFill.None, mod.Message("{}", getPlayerState(player).captureTick), 72, enemyTextColour, 1, mod.UIAnchor.BottomCenter, player)
    }

    togglePlayerCaptureUI(enabled: boolean, eventInfo: PlayerCapturePointEventInfo): void {
        mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("ObjText", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), enabled)
        mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("ObjCounter", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), enabled)
        mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("ObjProgress", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), enabled)
        mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("ObjProgressBG", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), enabled)
    }

    togglePlayerOOBUI(enabled: boolean, eventInfo: PlayerEventInfo): void {
        mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("OOBBackground", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), enabled)
        mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("OOBText", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), enabled)
        mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("OOBCounter", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), enabled)
    }

    updateFlagIcons(): void {
        for (let i = 0; i < mod.CountOf(mod.AllCapturePoints()); i++) {

            if (mod.Equals(
                mod.GetCurrentOwnerTeam(mod.GetCapturePoint(mod.Add(
                    200,
                    i))),
                mod.GetTeam(1))) {
                mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, i)), friendlyTextColour)
                mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, i)), friendlyBGColour)
                mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, mod.Add(
                    i,
                    26))), enemyTextColour)
                mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, mod.Add(
                    i,
                    26))), enemyBGColour)
                mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, mod.Add(
                    i,
                    52))), friendlyTextColour)
                mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, mod.Add(
                    i,
                    78))), enemyTextColour)
            } else if (mod.Equals(
                mod.GetCurrentOwnerTeam(mod.GetCapturePoint(mod.Add(
                    200,
                    i))),
                mod.GetTeam(2))) {
                mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, i)), enemyTextColour)
                mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, i)), enemyBGColour)
                mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, mod.Add(
                    i,
                    26))), friendlyTextColour)
                mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, mod.Add(
                    i,
                    26))), friendlyBGColour)
                mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, mod.Add(
                    i,
                    52))), enemyTextColour)
                mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, mod.Add(
                    i,
                    78))), friendlyTextColour)
            } else {
                mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, i)), mod.CreateVector(0.9, 0.9, 0.9))
                mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, i)), mod.CreateVector(0, 0, 0))
                mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, mod.Add(
                    i,
                    26))), mod.CreateVector(0.9, 0.9, 0.9))
                mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, mod.Add(
                    i,
                    26))), mod.CreateVector(0, 0, 0))
                mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, mod.Add(
                    i,
                    52))), mod.CreateVector(0.9, 0.9, 0.9))
                mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, mod.Add(
                    i,
                    78))), mod.CreateVector(0.9, 0.9, 0.9))
            }
        }
    }

    updatePlayerCaptureUI(eventInfo: PlayerCapturePointEventInfo): void {
        mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("ObjProgress", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), getCapturePointState(eventInfo.eventCapturePoint).uiPosition)
        mod.SetUIWidgetSize(mod.FindUIWidgetWithName("ObjProgress", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), getCapturePointState(eventInfo.eventCapturePoint).uiSize)
        mod.SetUITextColor(mod.FindUIWidgetWithName("ObjText", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), getTeamState(mod.GetTeam(eventInfo.eventPlayer)).capTextColour(mod.GetObjId(eventInfo.eventCapturePoint)))
        mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName("ObjText", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), getTeamState(mod.GetTeam(eventInfo.eventPlayer)).capBGColour(mod.GetObjId(eventInfo.eventCapturePoint)))
        mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName("ObjProgressBG", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), getTeamState(mod.GetTeam(eventInfo.eventPlayer)).capProgressColour(mod.GetObjId(eventInfo.eventCapturePoint)))
        if (mod.Equals(
            mod.GetTeam(eventInfo.eventPlayer),
            mod.GetOwnerProgressTeam(eventInfo.eventCapturePoint))) {
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName("ObjProgress", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), friendlyTextColour)
        } else {
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName("ObjProgress", mod.FindUIWidgetWithName(getPlayerState(eventInfo.eventPlayer).uniqueUiId)), enemyTextColour)
        }
        this.updateObjectiveUI(getTeamState(mod.GetTeam(eventInfo.eventPlayer)).capMessage(mod.GetObjId(eventInfo.eventCapturePoint)), eventInfo)
        if (mod.NotEqualTo(getPlayerState(eventInfo.eventPlayer).capturePointState, mod.GetCaptureProgress(eventInfo.eventCapturePoint))) {
            getPlayerState(eventInfo.eventPlayer).captureTick += 1;
            if (mod.Equals(
                mod.Modulo(
                    getPlayerState(eventInfo.eventPlayer).captureTick,
                    10),
                0)) {
                if (mod.GreaterThan(
                    mod.GetCaptureProgress(eventInfo.eventCapturePoint),
                    getPlayerState(eventInfo.eventPlayer).capturePointState)) {
                    if (mod.Equals(
                        mod.GetTeam(eventInfo.eventPlayer),
                        mod.GetOwnerProgressTeam(eventInfo.eventCapturePoint))) {
                        mod.PlaySound(audio.tickSoundTaking!, 0.5, eventInfo.eventPlayer)
                    } else {
                        mod.PlaySound(audio.tickSoundLosing!, 0.5, eventInfo.eventPlayer)
                    }
                } else {
                    if (mod.Equals(
                        mod.GetTeam(eventInfo.eventPlayer),
                        mod.GetOwnerProgressTeam(eventInfo.eventCapturePoint))) {
                        mod.PlaySound(audio.tickSoundLosing!, 0.5, eventInfo.eventPlayer)
                    } else {
                        mod.PlaySound(audio.tickSoundTaking!, 0.5, eventInfo.eventPlayer)
                    }
                }
            }
        } else {
            getPlayerState(eventInfo.eventPlayer).captureTick = 0;
        }
    }

    showVersion(): void {
        mod.AddUIText("ver", mod.CreateVector(10, 2, 0), mod.CreateVector(300, 30, 0), mod.UIAnchor.BottomLeft, mod.GetUIRoot(), true, 0, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.None, mod.Message("ViperStudiosAndy | andy6170 | Conquest Template V10"), 12, mod.CreateVector(1, 1, 1), 0.3, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI)
    }

    flashCaptureProgressUI(capturePoint: mod.CapturePoint, flashAlpha: number): void {
        const cpOffset = mod.GetObjId(capturePoint) - 200;
        if (mod.And(
            mod.GreaterThan(
                mod.GetCaptureProgress(capturePoint),
                0),
            mod.LessThan(
                mod.GetCaptureProgress(capturePoint),
                1))) {
            mod.SetUITextAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, cpOffset)), flashAlpha)
            mod.SetUITextAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, cpOffset + 26)), flashAlpha)
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, cpOffset + 52)), flashAlpha)
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, cpOffset + 78)), flashAlpha)
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, cpOffset)), flashAlpha)
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, cpOffset + 26)), flashAlpha)
        } else {
            mod.SetUITextAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, cpOffset)), 1)
            mod.SetUITextAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, cpOffset + 26)), 1)
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, cpOffset + 52)), 1)
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, cpOffset + 78)), 1)
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, cpOffset)), 0.8)
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, cpOffset + 26)), 0.8)
        }
    }

    updateOOBUI(player: mod.Player, tick: number): void {
        mod.SetUITextLabel(mod.FindUIWidgetWithName("OOBCounter", mod.FindUIWidgetWithName(getPlayerState(player).uniqueUiId)), mod.Message("{}", tick))
    }

    teardownScoreUI(): void {
        mod.SetUIWidgetSize(mod.FindUIWidgetWithName("Timer"), mod.CreateVector(190, 60, 0))
        mod.SetUITextSize(mod.FindUIWidgetWithName("Timer"), 48)
        mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("Timer"), mod.CreateVector(0, 390, 0))
        mod.DeleteUIWidget(mod.FindUIWidgetWithName("Team1LeftBar"))
        mod.DeleteUIWidget(mod.FindUIWidgetWithName("Team1RightBar"))
        mod.DeleteUIWidget(mod.FindUIWidgetWithName("Team2LeftBar"))
        mod.DeleteUIWidget(mod.FindUIWidgetWithName("Team2RightBar"))
        mod.DeleteUIWidget(mod.FindUIWidgetWithName("LeftBarBG"))
        mod.DeleteUIWidget(mod.FindUIWidgetWithName("RightBarBG"))
        for (let i = 0; i < mod.CountOf(objectiveTrackingUI); i++) {
            mod.DeleteUIWidget(mod.FindUIWidgetWithName(mod.ValueInArray(objectiveTrackingUI, i)))
        }
    }

    setupColourFilter(): void {
        mod.AddUIContainer("container2", mod.CreateVector(0, 0, 0), mod.CreateVector(20000, 20000, 0), mod.UIAnchor.TopCenter)
        if (FLAGS.BF3_COLOUR_FILTER) {
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName("container2"), mod.CreateVector(0, 0.8, 1))
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName("container2"), 0.2)
            mod.SetUIWidgetBgFill(mod.FindUIWidgetWithName("container2"), mod.UIBgFill.Blur)
        } else if (FLAGS.BF4_COLOUR_FILTER) {
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName("container2"), mod.CreateVector(1, 0.5, 0))
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName("container2"), 0.2)
            mod.SetUIWidgetBgFill(mod.FindUIWidgetWithName("container2"), mod.UIBgFill.Blur)
        } else if (FLAGS.SNOW_COLOUR_FILTER) {
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName("container2"), mod.CreateVector(0, 0.4, 0.7))
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName("container2"), 0.2)
            mod.SetUIWidgetBgFill(mod.FindUIWidgetWithName("container2"), mod.UIBgFill.Blur)
        } else {
            mod.SetUIWidgetBgFill(mod.FindUIWidgetWithName("container2"), mod.UIBgFill.None)
        }
    }

    async animateUIFlash(team1Widget: string, team2Widget: string): Promise<void> {
        mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(team1Widget), 1)
        mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(team2Widget), 1)
        for (let i = 10; i < 100; i += 10) {
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(team1Widget), mod.Subtract(
                1,
                mod.Divide(
                    i,
                    100)))
            mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(team2Widget), mod.Subtract(
                1,
                mod.Divide(
                    i,
                    100)))
            await mod.Wait(0.033)
        }
        mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(team1Widget), 0)
        mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(team2Widget), 0)
    }

    updateScoreboard(): void {
        mod.SetScoreboardType(mod.ScoreboardType.CustomTwoTeams)
        mod.SetScoreboardColumnNames(mod.Message("Score"), mod.Message("Kills"), mod.Message("Deaths"), mod.Message("Assists"), mod.Message("Captures"))
        mod.SetScoreboardHeader(mod.Message("{}: {}", getTeamState(TEAM_1).faction, getTeamState(TEAM_1).score), mod.Message("{}: {}", getTeamState(TEAM_2).faction, getTeamState(TEAM_2).score))
        mod.SetUITextLabel(mod.FindUIWidgetWithName("Team1ScoreLeft"), mod.Message("{}", getTeamState(TEAM_1).score))
        mod.SetUITextLabel(mod.FindUIWidgetWithName("Team1ScoreRight"), mod.Message("{}", getTeamState(TEAM_2).score))
        mod.SetUITextLabel(mod.FindUIWidgetWithName("Team2ScoreLeft"), mod.Message("{}", getTeamState(TEAM_2).score))
        mod.SetUITextLabel(mod.FindUIWidgetWithName("Team2ScoreRight"), mod.Message("{}", getTeamState(TEAM_1).score))
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
            getTeamState(TEAM_1).score,
            getTeamState(TEAM_1).startingScore))), 10, 0))
        mod.SetUIWidgetSize(mod.FindUIWidgetWithName("Team2LeftBar"), mod.CreateVector(mod.Floor(mod.Multiply(200, mod.Divide(
            getTeamState(TEAM_2).score,
            getTeamState(TEAM_2).startingScore))), 10, 0))
        mod.SetUIWidgetSize(mod.FindUIWidgetWithName("Team1RightBar"), mod.CreateVector(mod.Floor(mod.Multiply(200, mod.Divide(
            getTeamState(TEAM_2).score,
            getTeamState(TEAM_2).startingScore))), 10, 0))
        mod.SetUIWidgetSize(mod.FindUIWidgetWithName("Team2RightBar"), mod.CreateVector(mod.Floor(mod.Multiply(200, mod.Divide(
            getTeamState(TEAM_1).score,
            getTeamState(TEAM_1).startingScore))), 10, 0))
        mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("Team1LeftBar"), mod.CreateVector(mod.Floor(mod.Add(
            -260,
            mod.Divide(
                mod.Multiply(200, mod.Divide(
                    getTeamState(TEAM_1).score,
                    getTeamState(TEAM_1).startingScore)),
                2))), 60, 0))
        mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("Team1RightBar"), mod.CreateVector(mod.Floor(mod.Subtract(
            260,
            mod.Divide(
                mod.Multiply(200, mod.Divide(
                    getTeamState(TEAM_2).score,
                    getTeamState(TEAM_2).startingScore)),
                2))), 60, 0))
        mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("Team2LeftBar"), mod.CreateVector(mod.Floor(mod.Add(
            -260,
            mod.Divide(
                mod.Multiply(200, mod.Divide(
                    getTeamState(TEAM_2).score,
                    getTeamState(TEAM_2).startingScore)),
                2))), 60, 0))
        mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("Team2RightBar"), mod.CreateVector(mod.Floor(mod.Subtract(
            260,
            mod.Divide(
                mod.Multiply(200, mod.Divide(
                    getTeamState(TEAM_1).score,
                    getTeamState(TEAM_1).startingScore)),
                2))), 60, 0))
    }
}
class PlayerController {}
class CapturePointController {}
class AIController {}
class ConquestGame {}

const uiController = new UIController();
const playerController = new PlayerController();
const capturePointController = new CapturePointController();
const aiController = new AIController();
const conquestGame = new ConquestGame();

// ============================================================

function initGameSettings() {
    isGameOngoing = false;
    // FLAGS.ENABLE_CUSTOM_AI is a constant
    // CONFIG.MAX_CUSTOM_AI is a constant
    // FLAGS.ENABLE_TEAM_SWITCHING is a constant
    // CONFIG.TIME_LIMIT is a constant
    // CONFIG.STARTING_SCORE is a constant
    // CONFIG.LOW_TICKET_MUSIC_THRESHOLD is a constant
    // FLAGS.LOSER_ONLY_TICKET_BLEED is a constant
    // FLAGS.TOTAL_CONTROL_TICKET_BLEED is a constant
    // CONFIG.TOTAL_CONTROL_BONUS is a constant
    // CONFIG.TICKET_BLEED_SPEED is a constant
    // FLAGS.PLAYER_DEATHS_BLEED is a constant
    // CONFIG.FLAG_CAPTURE_TIME is a constant
    // CONFIG.FLAG_NEUTRAL_TIME is a constant
    // FLAGS.ENABLE_VO is a constant
    // FLAGS.ENABLE_SNOW is a constant
    // FLAGS.SNOW_COLOUR_FILTER is a constant
    // FLAGS.BF3_COLOUR_FILTER is a constant
    // FLAGS.BF4_COLOUR_FILTER is a constant
    // FLAGS.GIVE_PLAYERS_NVG is a constant
    // FLAGS.CONQUEST_ASSAULT is a constant
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
    // CapturePointProgress is now in CapturePointState
    // PlayersOnPoint is now a Map, initialized in TeamState constructor
    // PlayersOnPoint is now a Map, initialized in TeamState constructor
    // Cap_TextColour is now a Map, initialized in TeamState constructor
    // Cap_TextColour is now a Map, initialized in TeamState constructor
    // Cap_BGColour is now a Map, initialized in TeamState constructor
    // Cap_BGColour is now a Map, initialized in TeamState constructor
    // Cap_Message is now a Map, initialized in TeamState constructor
    // Cap_Message is now a Map, initialized in TeamState constructor
    // Cap_Progress is now a Map, initialized in TeamState constructor
    // Cap_Progress is now a Map, initialized in TeamState constructor
    // CaptureProgressSize is now in CapturePointState
    // CaptureProgressPosition is now in CapturePointState
}
function initGameSettingsRule(conditionState: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    initGameSettings();
}

async function setupMap() {
    mod.SetGameModeTimeLimit(CONFIG.TIME_LIMIT)
    mod.SetGameModeTargetScore(1)
    mod.SetVehicleCategoryAllowedInSurroundingArea(mod.VehicleCategories.Air_All, true)
    if (mod.IsFaction(mod.GetTeam(1), mod.Factions.NATO)) {
        getTeamState(TEAM_1).faction = "NATO";
    } else {
        getTeamState(TEAM_1).faction = "PAX";
    }
    if (mod.IsFaction(mod.GetTeam(2), mod.Factions.NATO)) {
        getTeamState(TEAM_2).faction = "NATO";
    } else {
        getTeamState(TEAM_2).faction = "PAX";
    }
    uiController.setupMainUI()
    uiController.updateScoreboard()
    uiController.updateFlagIcons()
    if (FLAGS.ENABLE_SNOW) {
        snowVolume = mod.SpawnObject(mod.RuntimeSpawn_Common.EnvironmentDecalVolume_Winter_Event, mod.GetObjectPosition(mod.GetCapturePoint(200)), mod.CreateVector(0, 0, 0), mod.CreateVector(10000, 10000, 10000));
    }
    uiController.setupColourFilter()
    for (let i = 0; i < mod.CountOf(mod.AllCapturePoints()); i++) {
        setupCapturePoint(mod.ValueInArray(mod.AllCapturePoints(), i))
    }
    mod.SetUnspawnDelayInSeconds(mod.GetSpawner(901), 300)
    mod.SetUnspawnDelayInSeconds(mod.GetSpawner(902), 300)
    uiController.showVersion()
    audio.vo1 = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
    audio.vo2 = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
    audio.vo3 = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
    audio.vo4 = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
    audio.vo5 = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
    audio.vo6 = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
    audio.tickSoundTaking = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_CapturingTickIcon_IsFriendly_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
    audio.tickSoundLosing = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_CapturingTickEnemy_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
    audio.capturedSound = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_OnCapturedByFriendly_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
    audio.oobSound = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_OutOfBounds_Countdown_OneShot2D, mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0), mod.CreateVector(0, 0, 0));
    mod.PlayMusic(mod.MusicEvents.Core_LastPhaseBegin)
    mod.LoadMusic(mod.MusicPackages.Core)
    await mod.Wait(2)
    isGameOngoing = true;
    if (FLAGS.CONQUEST_ASSAULT) {
        mod.EnableHQ(mod.GetHQ(2), false)
    }
    for (let i = 2000; i < 2999; i++) {
        mod.EnableVFX(mod.GetVFX(i), true)
    }
    while (isGameOngoing) {
        for (let i = 10; i < 0; i += -2) {
            capturePointFlash = i / 10;
            await mod.Wait(0.1)
        }
        for (let i = 0; i < 10; i += 2) {
            capturePointFlash = i / 10;
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
    const newState = mod.And(isGameOngoing, mod.Equals(
        mod.Modulo(
            mod.RoundToInteger(mod.GetMatchTimeElapsed()),
            2),
        0))
    return newState;
}

async function updateScoreTimeAndAI() {
    uiController.updateScoreboard()
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
    const newState = mod.And(isGameOngoing, mod.Equals(
        mod.Modulo(
            mod.RoundToInteger(mod.GetMatchTimeElapsed()),
            2),
        1))
    return newState;
}

async function updateScoreTimeAndAISecondaryTick() {
    uiController.updateScoreboard()
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
    const newState = mod.And(isGameOngoing, mod.Equals(
        mod.Modulo(
            mod.RoundToInteger(mod.GetMatchTimeElapsed()),
            CONFIG.TICKET_BLEED_SPEED),
        0))
    return newState;
}

function trackScoreAndBleed() {
    if (FLAGS.TOTAL_CONTROL_TICKET_BLEED) {
        if (isTrueForAll(mod.AllCapturePoints(), (currentArrayElement: any) => mod.Equals(
            mod.GetCurrentOwnerTeam(currentArrayElement),
            mod.GetTeam(1)))) {
            getTeamState(TEAM_2).score -= CONFIG.TOTAL_CONTROL_BONUS;
        } else if (isTrueForAll(mod.AllCapturePoints(), (currentArrayElement: any) => mod.Equals(
            mod.GetCurrentOwnerTeam(currentArrayElement),
            mod.GetTeam(2)))) {
            getTeamState(TEAM_1).score -= CONFIG.TOTAL_CONTROL_BONUS;
        } else {
        }
    }
    if (FLAGS.LOSER_ONLY_TICKET_BLEED) {
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
            getTeamState(TEAM_1).score -=
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
                            mod.GetTeam(1)))));
            uiController.updateScoreboard()
            uiController.animateUIFlash("LeftFlash1", "RightFlash2")
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
            getTeamState(TEAM_2).score -=
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
                            mod.GetTeam(2)))));
            uiController.updateScoreboard()
            uiController.animateUIFlash("RightFlash1", "LeftFlash2")
        }
    } else {
        getTeamState(TEAM_1).score -=
            mod.CountOf(filterModArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.Equals(
                    mod.GetCurrentOwnerTeam(currentArrayElement),
                    mod.GetTeam(2))));
        getTeamState(TEAM_2).score -=
            mod.CountOf(filterModArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.Equals(
                    mod.GetCurrentOwnerTeam(currentArrayElement),
                    mod.GetTeam(1))));
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
    getPlayerState(eventInfo.eventPlayer).score += 10;
    getPlayerState(eventInfo.eventPlayer).score += 10;
    getPlayerState(eventInfo.eventPlayer).kills += 1;
    uiController.updatePlayerScoreboard(eventInfo.eventPlayer)
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
    getPlayerState(eventInfo.eventPlayer).score += 5;
    getPlayerState(eventInfo.eventPlayer).assists += 1;
    uiController.updatePlayerScoreboard(eventInfo.eventPlayer)
}
function processAssistRule(conditionState: any, eventInfo: any) {
    let newState = shouldProcessAssist(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    processAssist(eventInfo);
}

function processRevive(eventInfo: any) {
    getPlayerState(eventInfo.eventOtherPlayer).score += 10;
    getPlayerState(eventInfo.eventOtherPlayer).revives += 1;
    uiController.updatePlayerScoreboard(eventInfo.eventOtherPlayer)
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
    if (getPlayerState(eventInfo.eventPlayer).isOutOfBounds) {
        disableOutOfBounds(eventInfo)
    }
    if (FLAGS.ENABLE_CUSTOM_AI) {
        if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
            if (mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier)) {
                if (mod.And(
                    FLAGS.PLAYER_DEATHS_BLEED,
                    mod.NotEqualTo(eventInfo.eventPlayer, eventInfo.eventOtherPlayer))) {
                    getTeamState(mod.GetTeam(eventInfo.eventPlayer)).score -= 1;
                }
                getPlayerState(eventInfo.eventPlayer).deaths += 1;
                uiController.updatePlayerScoreboard(eventInfo.eventPlayer)
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
    if (FLAGS.GIVE_PLAYERS_NVG) {
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
    getPlayerState(eventInfo.eventPlayer).captureTick = -1;
    getPlayerState(eventInfo.eventPlayer).isOnPoint = false;
    getPlayerState(eventInfo.eventPlayer).isOutOfBounds = false;
    getPlayerState(eventInfo.eventPlayer).ignoreOOB = false;
    getPlayerState(eventInfo.eventPlayer).aiInAction = false;
    await mod.Wait(1)
    if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
        uiController.updatePlayerScoreboard(eventInfo.eventPlayer)
        if (mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier))) {
            mod.SendErrorReport(mod.Message("Player Joined {}", eventInfo.eventPlayer))
            uiController.setupPlayerUI(eventInfo.eventPlayer)
            await mod.Wait(5)
            if (isGameOngoing) {
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
    const newState = isGameOngoing;
    return newState;
}

function updateDeathOnUndeploy(eventInfo: any) {
    if (FLAGS.PLAYER_DEATHS_BLEED) {
        getTeamState(mod.GetTeam(eventInfo.eventPlayer)).score -= 1;
    }
    getPlayerState(eventInfo.eventPlayer).deaths += 1;
    getPlayerState(eventInfo.eventPlayer).isOnPoint = false;
    uiController.updatePlayerScoreboard(eventInfo.eventPlayer)
    uiController.updateScoreboard()
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
    uiController.updateScoreboard()
    uiController.updateFlagIcons()
    const playersOnObjective = filterModArray(
        mod.GetPlayersOnPoint(eventInfo.eventCapturePoint),
        (currentArrayElement: any) => mod.Equals(
            mod.GetTeam(currentArrayElement),
            mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint)));
    for (let i = 0; i < mod.CountOf(playersOnObjective); i++) {
        processObjectivePlayerData(mod.ValueInArray(playersOnObjective, i))
        if (mod.GetSoldierState(mod.ValueInArray(playersOnObjective, i), mod.SoldierStateBool.IsAISoldier)) {
            startAIScouting(mod.ValueInArray(playersOnObjective, i))
        }
    }
    spawnObjectiveVehicles(eventInfo)
    if (FLAGS.ENABLE_VO) {
        mod.PlayVO(audio.vo1!, mod.VoiceOverEvents2D.ObjectiveCaptured, mod.ValueInArray(flagAnnounce, mod.Subtract(
            mod.GetObjId(eventInfo.eventCapturePoint),
            200)), mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint))
        mod.PlayVO(audio.vo2!, mod.VoiceOverEvents2D.ObjectiveCapturedEnemy, mod.ValueInArray(flagAnnounce, mod.Subtract(
            mod.GetObjId(eventInfo.eventCapturePoint),
            200)), getTeamState(mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint)).otherTeam)
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
    const newState = FLAGS.ENABLE_VO && mod.Equals(
        mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
        mod.GetTeam(0)) && mod.LessThan(mod.GetCaptureProgress(eventInfo.eventCapturePoint), 0.05);
    return newState;
}

async function notifyCapture(eventInfo: any) {
    uiController.updateFlagIcons()
    await mod.Wait(0.2)
    uiController.updateScoreboard()
    if (mod.NotEqualTo(mod.GetPreviousOwnerTeam(eventInfo.eventCapturePoint), mod.GetTeam(0))) {
        mod.PlayVO(audio.vo3!, mod.VoiceOverEvents2D.ObjectiveNeutralised, mod.ValueInArray(flagAnnounce, mod.Subtract(
            mod.GetObjId(eventInfo.eventCapturePoint),
            200)), mod.GetOwnerProgressTeam(eventInfo.eventCapturePoint))
        mod.PlayVO(audio.vo4!, mod.VoiceOverEvents2D.ObjectiveLost, mod.ValueInArray(flagAnnounce, mod.Subtract(
            mod.GetObjId(eventInfo.eventCapturePoint),
            200)), mod.GetPreviousOwnerTeam(eventInfo.eventCapturePoint))
    } else {
        mod.PlayVO(audio.vo3!, mod.VoiceOverEvents2D.ObjectiveCapturing, mod.ValueInArray(flagAnnounce, mod.Subtract(
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
    const newState = mod.And(isGameOngoing, mod.Or(
        mod.LessThanEqualTo(mod.GetMatchTimeRemaining(), 60),
        mod.Or(
            mod.LessThanEqualTo(getTeamState(TEAM_1).score, CONFIG.LOW_TICKET_MUSIC_THRESHOLD),
            mod.LessThanEqualTo(getTeamState(TEAM_2).score, CONFIG.LOW_TICKET_MUSIC_THRESHOLD))))
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
    const newState = mod.And(isGameOngoing, mod.Or(
        mod.LessThanEqualTo(mod.GetMatchTimeRemaining(), 1),
        mod.Or(
            mod.LessThanEqualTo(getTeamState(TEAM_1).score, 0),
            mod.LessThanEqualTo(getTeamState(TEAM_2).score, 0))))
    return newState;
}

async function endGame() {
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
    mod.PlayMusic(mod.MusicEvents.Core_EndOfRound_Loop)
    scorePositionLeft = mod.CreateVector(-300, 385, 0);
    scorePositionRight = mod.CreateVector(300, 385, 0);
    uiController.updateScoreboard()
    uiController.teardownScoreUI()
    uiController.showEndGameUI("Team1ScoreLeft", scorePositionLeft)
    uiController.showEndGameUI("Team1ScoreRight", scorePositionRight)
    uiController.showEndGameUI("Team2ScoreLeft", scorePositionLeft)
    uiController.showEndGameUI("Team2ScoreRight", scorePositionRight)
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
}
function endGameRule(conditionState: any) {
    let newState = shouldEndGame();
    if (!conditionState.update(newState)) {
        return;
    }
    endGame();
}

function shouldShowCaptureUI(eventInfo: any): boolean {
    const newState = mod.Not(getPlayerState(eventInfo.eventPlayer).isOnPoint);
    return newState;
}

async function showCaptureUI(eventInfo: any) {
    getPlayerState(eventInfo.eventPlayer).currentCapturePoint = eventInfo.eventCapturePoint;
    getPlayerState(eventInfo.eventPlayer).capturePointState = mod.GetCaptureProgress(eventInfo.eventCapturePoint);
    getPlayerState(eventInfo.eventPlayer).flagOwner = mod.GetTeam(3);
    const validPlayersOnPoint = filterModArray(
        mod.GetPlayersOnPoint(eventInfo.eventCapturePoint),
        (currentArrayElement: any) => mod.IsPlayerValid(currentArrayElement));
    getTeamState(mod.GetTeam(eventInfo.eventPlayer)).playersOnPoints.set(mod.GetObjId(eventInfo.eventCapturePoint), mod.CountOf(filterModArray(
        validPlayersOnPoint,
        (currentArrayElement: any) => mod.GetSoldierState(currentArrayElement, mod.SoldierStateBool.IsAlive) &&
            mod.Equals(
                mod.GetTeam(currentArrayElement),
                mod.GetTeam(eventInfo.eventPlayer)))))
    getTeamState(getTeamState(mod.GetTeam(eventInfo.eventPlayer)).otherTeam).playersOnPoints.set(mod.GetObjId(eventInfo.eventCapturePoint), mod.CountOf(filterModArray(
        validPlayersOnPoint,
        (currentArrayElement: any) => mod.GetSoldierState(currentArrayElement, mod.SoldierStateBool.IsAlive) &&
            mod.Equals(
                mod.GetTeam(currentArrayElement),
                getTeamState(mod.GetTeam(eventInfo.eventPlayer)).otherTeam))))
    await mod.Wait(0.05)
    uiController.manageCapturePointUI(eventInfo.eventCapturePoint, getPlayerState(eventInfo.eventPlayer).capturePointState, eventInfo)
    getPlayerState(eventInfo.eventPlayer).isOnPoint = true;
    if (mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier))) {
        getPlayerState(eventInfo.eventPlayer).captureTick = 9;
        while (getPlayerState(eventInfo.eventPlayer).isOnPoint) {
            if (mod.Not(mod.IsPlayerValid(eventInfo.eventPlayer))) {
                break
            }
            if (mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAlive)) {
                uiController.togglePlayerCaptureUI(true, eventInfo)
                uiController.updatePlayerCaptureUI(eventInfo)
            } else {
                uiController.togglePlayerCaptureUI(false, eventInfo)
            }
            getPlayerState(eventInfo.eventPlayer).capturePointState = mod.GetCaptureProgress(eventInfo.eventCapturePoint);
            getPlayerState(eventInfo.eventPlayer).flagOwner = mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint);
            while (getPlayerState(eventInfo.eventPlayer).isOnPoint) { await mod.Wait(0.1) }
        }
        getPlayerState(eventInfo.eventPlayer).captureTick = -1;
        uiController.togglePlayerCaptureUI(false, eventInfo)
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
    const newState = getPlayerState(eventInfo.eventPlayer).isOnPoint;
    return newState;
}

function hideCaptureUI(eventInfo: any) {
    const validPlayersOnPoint = filterModArray(
        mod.GetPlayersOnPoint(eventInfo.eventCapturePoint),
        (currentArrayElement: any) => mod.IsPlayerValid(currentArrayElement));
    getTeamState(mod.GetTeam(eventInfo.eventPlayer)).playersOnPoints.set(mod.GetObjId(eventInfo.eventCapturePoint), mod.CountOf(filterModArray(
        validPlayersOnPoint,
        (currentArrayElement: any) => mod.GetSoldierState(currentArrayElement, mod.SoldierStateBool.IsAlive) &&
            mod.Equals(
                mod.GetTeam(currentArrayElement),
                mod.GetTeam(eventInfo.eventPlayer)))))
    getPlayerState(eventInfo.eventPlayer).isOnPoint = false;
}
function hideCaptureUIRule(conditionState: any, eventInfo: any) {
    let newState = shouldHideCaptureUI(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    hideCaptureUI(eventInfo);
}

function shouldUpdatePlayerCountOnDeath(eventInfo: any): boolean {
    const newState = getPlayerState(eventInfo.eventPlayer).isOnPoint;
    return newState;
}

function updatePlayerCountOnDeath(eventInfo: any) {
    const cpId = mod.GetObjId(getPlayerState(eventInfo.eventPlayer).currentCapturePoint!);
    const validPlayersOnPoint = filterModArray(
        mod.GetPlayersOnPoint(getPlayerState(eventInfo.eventPlayer).currentCapturePoint!),
        (currentArrayElement: any) => mod.IsPlayerValid(currentArrayElement));
    getTeamState(mod.GetTeam(eventInfo.eventPlayer)).playersOnPoints.set(cpId, mod.CountOf(filterModArray(
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
    const newState = getPlayerState(eventInfo.eventPlayer).isOnPoint;
    return newState;
}

function updatePlayerCountOnRevive(eventInfo: any) {
    const cpId = mod.GetObjId(getPlayerState(eventInfo.eventPlayer).currentCapturePoint!);
    const validPlayersOnPoint = filterModArray(
        mod.GetPlayersOnPoint(getPlayerState(eventInfo.eventPlayer).currentCapturePoint!),
        (currentArrayElement: any) => mod.IsPlayerValid(currentArrayElement));
    getTeamState(mod.GetTeam(eventInfo.eventPlayer)).playersOnPoints.set(cpId, mod.CountOf(filterModArray(
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
    if (FLAGS.ENABLE_TEAM_SWITCHING) {
        if (mod.Or(
            mod.Equals(
                mod.GetInteractPoint(998),
                eventInfo.eventInteractPoint),
            mod.Equals(
                mod.GetInteractPoint(999),
                eventInfo.eventInteractPoint))) {
            getPlayerState(eventInfo.eventPlayer).ignoreOOB = true;
            mod.UndeployPlayer(eventInfo.eventPlayer)
            mod.SetTeam(eventInfo.eventPlayer, getTeamState(mod.GetTeam(eventInfo.eventPlayer)).otherTeam)
            getTeamState(mod.GetTeam(eventInfo.eventPlayer)).score += 1;
            getPlayerState(eventInfo.eventPlayer).deaths -= 1;
            uiController.updatePlayerScoreboard(eventInfo.eventPlayer)
            await mod.Wait(2)
            getPlayerState(eventInfo.eventPlayer).ignoreOOB = false;
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
    if (mod.Not(getPlayerState(eventInfo.eventPlayer).isOutOfBounds)) {
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
    const newState = isGameOngoing && FLAGS.ENABLE_VO && mod.LessThanEqualTo(mod.GetMatchTimeRemaining(), 300);
    return newState;
}

function playVOLowTime() {
    mod.PlayVO(audio.vo5!, mod.VoiceOverEvents2D.TimeLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
    mod.PlayVO(audio.vo6!, mod.VoiceOverEvents2D.TimeLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
}
function playVOLowTimeRule(conditionState: any) {
    let newState = shouldPlayVOLowTime();
    if (!conditionState.update(newState)) {
        return;
    }
    playVOLowTime();
}

function shouldPlayVOWinning(): boolean {
    const newState = isGameOngoing && FLAGS.ENABLE_VO && mod.GreaterThan(
        getTeamState(TEAM_1).score,
        getTeamState(TEAM_2).score);
    return newState;
}

function playVOWinning() {
    mod.PlayVO(audio.vo5!, mod.VoiceOverEvents2D.ProgressMidWinning, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
    mod.PlayVO(audio.vo6!, mod.VoiceOverEvents2D.ProgressMidLosing, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
}
function playVOWinningRule(conditionState: any) {
    let newState = shouldPlayVOWinning();
    if (!conditionState.update(newState)) {
        return;
    }
    playVOWinning();
}

function shouldPlayVOTeam2Winning(): boolean {
    const newState = isGameOngoing && FLAGS.ENABLE_VO && mod.GreaterThan(
        getTeamState(TEAM_2).score,
        getTeamState(TEAM_1).score);
    return newState;
}

function playVOTeam2Winning() {
    mod.PlayVO(audio.vo5!, mod.VoiceOverEvents2D.ProgressMidWinning, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
    mod.PlayVO(audio.vo6!, mod.VoiceOverEvents2D.ProgressMidLosing, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
}
function playVOTeam2WinningRule(conditionState: any) {
    let newState = shouldPlayVOTeam2Winning();
    if (!conditionState.update(newState)) {
        return;
    }
    playVOTeam2Winning();
}

function shouldPlayVOLowTickets(): boolean {
    const newState = isGameOngoing && FLAGS.ENABLE_VO && mod.LessThanEqualTo(getTeamState(TEAM_1).score, CONFIG.LOW_TICKET_MUSIC_THRESHOLD);
    return newState;
}

function playVOLowTickets() {
    mod.PlayVO(audio.vo5!, mod.VoiceOverEvents2D.PlayerCountFriendlyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
    mod.PlayVO(audio.vo6!, mod.VoiceOverEvents2D.PlayerCountEnemyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
}
function playVOLowTicketsRule(conditionState: any) {
    let newState = shouldPlayVOLowTickets();
    if (!conditionState.update(newState)) {
        return;
    }
    playVOLowTickets();
}

function shouldPlayVOTeam2LowTickets(): boolean {
    const newState = isGameOngoing && FLAGS.ENABLE_VO && mod.LessThanEqualTo(getTeamState(TEAM_2).score, CONFIG.LOW_TICKET_MUSIC_THRESHOLD);
    return newState;
}

function playVOTeam2LowTickets() {
    mod.PlayVO(audio.vo5!, mod.VoiceOverEvents2D.PlayerCountFriendlyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
    mod.PlayVO(audio.vo6!, mod.VoiceOverEvents2D.PlayerCountEnemyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
}
function playVOTeam2LowTicketsRule(conditionState: any) {
    let newState = shouldPlayVOTeam2LowTickets();
    if (!conditionState.update(newState)) {
        return;
    }
    playVOTeam2LowTickets();
}

async function updateCaptureProgress(eventInfo: any) {
    while (!isGameOngoing) { await mod.Wait(999) }
    if (FLAGS.CONQUEST_ASSAULT) {
        mod.SetCapturePointOwner(eventInfo.eventCapturePoint, mod.GetTeam(2))
    }
    await mod.Wait(mod.RandomReal(0, 1))
    const cpState = getCapturePointState(eventInfo.eventCapturePoint);
    cpState.progress = mod.GetCaptureProgress(eventInfo.eventCapturePoint);
    cpState.setProgressVisuals(cpState.progress);
    // TODO: make this function "async"
    while (true) {
        uiController.flashCaptureProgressUI(eventInfo.eventCapturePoint, capturePointFlash)
        if (mod.NotEqualTo(getCapturePointState(eventInfo.eventCapturePoint).progress, mod.GetCaptureProgress(eventInfo.eventCapturePoint))) {
            const cpState = getCapturePointState(eventInfo.eventCapturePoint);
            cpState.setProgressVisuals(mod.GetCaptureProgress(eventInfo.eventCapturePoint));
            uiController.manageCapturePointUI(eventInfo.eventCapturePoint, cpState.progress, eventInfo)
        }
        getCapturePointState(eventInfo.eventCapturePoint).progress = mod.GetCaptureProgress(eventInfo.eventCapturePoint);
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
    const newState = mod.And(FLAGS.ENABLE_CUSTOM_AI, mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier));
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
    const newState = FLAGS.ENABLE_CUSTOM_AI && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier) && !mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle);
    return newState;
}

async function findNewAIObjective(eventInfo: any) {
    if (mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint))) {
        await mod.Wait(1.5)
        if (mod.IsType(getPlayerState(eventInfo.eventPlayer).aiTarget, mod.Types.CapturePoint)) {
            if (mod.Equals(
                eventInfo.eventCapturePoint,
                getPlayerState(eventInfo.eventPlayer).aiTarget)) {
                if (mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAlive)) {
                    mod.AIDefendPositionBehavior(eventInfo.eventPlayer, mod.GetObjectPosition(getPlayerState(eventInfo.eventPlayer).aiTarget!), 0, 20)
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
    const newState = FLAGS.ENABLE_CUSTOM_AI && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier) && mod.LessThanEqualTo(CONFIG.MAX_CUSTOM_AI, 70);
    return newState;
}

async function readyAIForAttack(eventInfo: any) {
    await mod.Wait(mod.RandomReal(2, 3))
    while (mod.IsPlayerValid(eventInfo.eventPlayer)) {
        if (mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAlive)) {
            if (mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle))) {
                if (mod.LessThan(
                    mod.DistanceBetween(
                        mod.GetObjectPosition(mod.ClosestPlayerTo(mod.GetObjectPosition(eventInfo.eventPlayer), getTeamState(mod.GetTeam(eventInfo.eventPlayer)).otherTeam)),
                        mod.GetObjectPosition(eventInfo.eventPlayer)),
                    25)) {
                    mod.AIDefendPositionBehavior(eventInfo.eventPlayer, mod.GetObjectPosition(mod.ClosestPlayerTo(mod.GetObjectPosition(eventInfo.eventPlayer), getTeamState(mod.GetTeam(eventInfo.eventPlayer)).otherTeam)), 10, 25)
                    mod.AISetTarget(eventInfo.eventPlayer, mod.ClosestPlayerTo(mod.GetObjectPosition(eventInfo.eventPlayer), getTeamState(mod.GetTeam(eventInfo.eventPlayer)).otherTeam))
                    mod.AISetMoveSpeed(eventInfo.eventPlayer, mod.MoveSpeed.InvestigateRun)
                    await mod.Wait(15)
                    if (mod.Not(getPlayerState(eventInfo.eventPlayer).aiInAction)) {
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
    const newState = FLAGS.ENABLE_CUSTOM_AI && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier) && !getPlayerState(eventInfo.eventPlayer).aiInAction && mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer)) && !mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle);
    return newState;
}

async function targetAIDamager(eventInfo: any) {
    getPlayerState(eventInfo.eventPlayer).aiInAction = true;
    mod.AIDefendPositionBehavior(eventInfo.eventPlayer, mod.GetObjectPosition(eventInfo.eventPlayer), 0, 15)
    mod.AISetMoveSpeed(eventInfo.eventPlayer, mod.MoveSpeed.InvestigateRun)
    mod.AISetTarget(eventInfo.eventPlayer, eventInfo.eventOtherPlayer)
    await mod.Wait(10)
    if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
        if (getPlayerState(eventInfo.eventPlayer).aiInAction) {
            startAIScouting(eventInfo.eventPlayer)
            getPlayerState(eventInfo.eventPlayer).aiInAction = false;
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
    const newState = mod.And(FLAGS.ENABLE_CUSTOM_AI, mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier));
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
    const newState = mod.And(FLAGS.ENABLE_CUSTOM_AI, mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier));
    return newState;
}

async function enterAIVehicle(eventInfo: any) {
    getPlayerState(eventInfo.eventPlayer).startPosition = mod.GetObjectPosition(eventInfo.eventPlayer);
    await mod.Wait(10)
    if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
        if (mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle)) {
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
function aiEnterVehicleRule(conditionState: any, eventInfo: any) {
    let newState = shouldAIEnterVehicle(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    enterAIVehicle(eventInfo);
}

function shouldAIRetryMove(eventInfo: any): boolean {
    const newState = mod.And(FLAGS.ENABLE_CUSTOM_AI, mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier));
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
    const newState = FLAGS.ENABLE_CUSTOM_AI && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier) && !mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle);
    return newState;
}

function targetAIOnKill(eventInfo: any) {
    startAIScouting(eventInfo.eventPlayer)
    getPlayerState(eventInfo.eventPlayer).aiInAction = false;
}
function aiTargetOnKillRule(conditionState: any, eventInfo: any) {
    let newState = shouldAITargetOnKill(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    targetAIOnKill(eventInfo);
}

function shouldAITargetOnKillAssist(eventInfo: any): boolean {
    const newState = FLAGS.ENABLE_CUSTOM_AI && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier) && mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer)) && !mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle);
    return newState;
}

function targetAIOnKillAssist(eventInfo: any) {
    startAIScouting(eventInfo.eventPlayer)
    getPlayerState(eventInfo.eventPlayer).aiInAction = false;
}
function aiTargetOnKillAssistRule(conditionState: any, eventInfo: any) {
    let newState = shouldAITargetOnKillAssist(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    targetAIOnKillAssist(eventInfo);
}



function setupCapturePoint(Objective: any) {


    mod.SetCapturePointCapturingTime(Objective, CONFIG.FLAG_CAPTURE_TIME)
    mod.SetCapturePointNeutralizationTime(Objective, CONFIG.FLAG_NEUTRAL_TIME)
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


    getPlayerState(Player).captures += 1;
    getPlayerState(Player).score += 50;
    uiController.updatePlayerScoreboard(Player)
    mod.PlaySound(audio.capturedSound!, 0.7, Player)
}




function initObjectiveLetters() {
    flagLetters = mod.EmptyArray();
    for (let i = 0; i < 26; i++) {
        flagLetters = mod.AppendToArray(flagLetters, String.fromCharCode(65 + i));
    }
}
function initObjectiveTeamUI() {
    objectiveTrackingUI = mod.EmptyArray();
    for (let suffix = 1; suffix <= 4; suffix++) {
        for (let i = 0; i < 26; i++) {
            objectiveTrackingUI = mod.AppendToArray(objectiveTrackingUI, String.fromCharCode(65 + i) + suffix);
        }
    }
}
function addAI() {
    if (FLAGS.ENABLE_CUSTOM_AI) {
        if (mod.LessThan(
            mod.CountOf(mod.AllPlayers()),
            CONFIG.MAX_CUSTOM_AI)) {
            const botNameCount = mod.CountOf(botNames);
            if (botNameCount <= 0) return;
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
                mod.SpawnAIFromAISpawner(mod.GetSpawner(902), mod.Message(mod.ValueInArray(botNames, botNameIndex)), mod.GetTeam(2))
            } else {
                mod.SpawnAIFromAISpawner(mod.GetSpawner(901), mod.Message(mod.ValueInArray(botNames, botNameIndex)), mod.GetTeam(1))
            }
            botNameIndex = (botNameIndex + 1) % botNameCount;
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
    botNames = mod.EmptyArray();
    for (const name of names) {
        botNames = mod.AppendToArray(botNames, name);
    }
}
function spawnAIObjectives(eventInfo: any) {


    if (mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle))) {
        getPlayerState(eventInfo.eventPlayer).aiSpawnPoints = mod.EmptyArray();
        getPlayerState(eventInfo.eventPlayer).aiSpawnPoints = filterModArray(
            mod.AllCapturePoints(),
            (currentArrayElement: any) => mod.And(
                mod.Equals(
                    mod.GetTeam(eventInfo.eventPlayer),
                    mod.GetCurrentOwnerTeam(currentArrayElement)),
                mod.GreaterThan(
                    mod.DistanceBetween(
                        mod.GetObjectPosition(mod.ClosestPlayerTo(mod.GetObjectPosition(currentArrayElement), getTeamState(mod.GetTeam(eventInfo.eventPlayer)).otherTeam)),
                        mod.GetObjectPosition(currentArrayElement)),
                    40)))
        if (mod.GreaterThan(
            mod.CountOf(getPlayerState(eventInfo.eventPlayer).aiSpawnPoints),
            0)) {
            if (mod.And(
                FLAGS.CONQUEST_ASSAULT,
                mod.Equals(
                    mod.GetTeam(2),
                    mod.GetTeam(eventInfo.eventPlayer)))) {
                mod.Teleport(eventInfo.eventPlayer, mod.GetObjectPosition(mod.RandomValueInArray(getPlayerState(eventInfo.eventPlayer).aiSpawnPoints)), 1)
                deployAIVehicle(mod.RandomValueInArray(filterModArray(
                    mod.AllVehicles(),
                    (currentArrayElement: any) => mod.LessThan(
                        mod.CountOf(mod.GetAllPlayersInVehicle(currentArrayElement)),
                        2))), 60, eventInfo)
            }
            if (mod.LessThan(
                mod.RoundToInteger(mod.RandomReal(0, 5)),
                5)) {
                mod.Teleport(eventInfo.eventPlayer, mod.GetObjectPosition(mod.RandomValueInArray(getPlayerState(eventInfo.eventPlayer).aiSpawnPoints)), 1)
                deployAIVehicle(mod.RandomValueInArray(filterModArray(
                    mod.AllVehicles(),
                    (currentArrayElement: any) => mod.LessThan(
                        mod.CountOf(mod.GetAllPlayersInVehicle(currentArrayElement)),
                        2))), 60, eventInfo)
            }
        } else {
            if (mod.And(
                FLAGS.CONQUEST_ASSAULT,
                mod.Equals(
                    mod.GetTeam(2),
                    mod.GetTeam(eventInfo.eventPlayer)))) {
                mod.UndeployPlayer(eventInfo.eventPlayer)
            }
        }
    }
}
function initFlagCalls() {
    flagAnnounce = mod.EmptyArray();
    flagAnnounce = mod.AppendToArray(flagAnnounce, mod.VoiceOverFlags.Alpha);
    flagAnnounce = mod.AppendToArray(flagAnnounce, mod.VoiceOverFlags.Bravo);
    flagAnnounce = mod.AppendToArray(flagAnnounce, mod.VoiceOverFlags.Charlie);
    flagAnnounce = mod.AppendToArray(flagAnnounce, mod.VoiceOverFlags.Delta);
    flagAnnounce = mod.AppendToArray(flagAnnounce, mod.VoiceOverFlags.Echo);
    flagAnnounce = mod.AppendToArray(flagAnnounce, mod.VoiceOverFlags.Foxtrot);
    flagAnnounce = mod.AppendToArray(flagAnnounce, mod.VoiceOverFlags.Golf);
    flagAnnounce = mod.AppendToArray(flagAnnounce, mod.VoiceOverFlags.Hotel);
    flagAnnounce = mod.AppendToArray(flagAnnounce, mod.VoiceOverFlags.India);
}

async function handleOutOfBounds(eventInfo: any) {

    const newState = !getPlayerState(eventInfo.eventPlayer).ignoreOOB && !getPlayerState(eventInfo.eventPlayer).isOutOfBounds && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAlive);
    return newState;

    getPlayerState(eventInfo.eventPlayer).isOutOfBounds = true;
    mod.SkipManDown(eventInfo.eventPlayer, true)
    if (mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier)) {
        for (let CaptureTickVar = 10; CaptureTickVar < 0; CaptureTickVar += -1) {
            getPlayerState(eventInfo.eventPlayer).captureTick = CaptureTickVar;;
            while (getPlayerState(eventInfo.eventPlayer).isOutOfBounds) { await mod.Wait(1) }
            if (mod.Not(getPlayerState(eventInfo.eventPlayer).isOutOfBounds)) {
                break
            }
        }
        if (getPlayerState(eventInfo.eventPlayer).isOutOfBounds) {
            if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
                mod.DealDamage(eventInfo.eventPlayer, 10000, eventInfo.eventPlayer)
            }
        }
        getPlayerState(eventInfo.eventPlayer).captureTick = -1;
    } else {
        uiController.togglePlayerOOBUI(true, eventInfo)
        for (let CaptureTickVar = 10; CaptureTickVar < 0; CaptureTickVar += -1) {
            getPlayerState(eventInfo.eventPlayer).captureTick = CaptureTickVar;;
            uiController.updateOOBUI(eventInfo.eventPlayer, getPlayerState(eventInfo.eventPlayer).captureTick)
            mod.PlaySound(audio.oobSound!, 0.7, eventInfo.eventPlayer)
            while (getPlayerState(eventInfo.eventPlayer).isOutOfBounds) { await mod.Wait(1) }
            if (mod.Not(getPlayerState(eventInfo.eventPlayer).isOutOfBounds)) {
                break
            }
        }
        if (getPlayerState(eventInfo.eventPlayer).isOutOfBounds) {
            mod.DealDamage(eventInfo.eventPlayer, 10000, eventInfo.eventPlayer)
        }
        uiController.togglePlayerOOBUI(false, eventInfo)
        getPlayerState(eventInfo.eventPlayer).captureTick = -1;
    }
}
function disableOutOfBounds(eventInfo: any) {

    const newState = getPlayerState(eventInfo.eventPlayer).isOutOfBounds;
    return newState;

    getPlayerState(eventInfo.eventPlayer).isOutOfBounds = false;
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
        getPlayerState(Player).aiTarget = mod.RandomValueInArray(filterModArray(
            mod.AllCapturePoints(),
            (currentArrayElement: any) => mod.Equals(
                mod.GetTeam(Player),
                mod.GetCurrentOwnerTeam(currentArrayElement))));
        mod.AIDefendPositionBehavior(Player, mod.GetObjectPosition(getPlayerState(Player).aiTarget!), 0, 30)
    } else {
        getPlayerState(Player).aiTarget = mod.RandomValueInArray(filterModArray(
            mod.AllCapturePoints(),
            (currentArrayElement: any) => mod.NotEqualTo(mod.GetTeam(Player), mod.GetCurrentOwnerTeam(currentArrayElement))));
        mod.AIMoveToBehavior(Player, mod.GetObjectPosition(getPlayerState(Player).aiTarget!))
    }
    if (mod.GreaterThan(
        mod.DistanceBetween(
            mod.GetObjectPosition(mod.ClosestPlayerTo(mod.GetObjectPosition(Player), getTeamState(mod.GetTeam(Player)).otherTeam)),
            mod.GetObjectPosition(Player)),
        30)) {
        mod.AISetMoveSpeed(Player, mod.MoveSpeed.Sprint)
    } else {
        mod.AISetMoveSpeed(Player, mod.MoveSpeed.InvestigateRun)
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

    const newState = FLAGS.CONQUEST_ASSAULT && mod.GreaterThan(
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

    getTeamState(TEAM_2).score = 0;
}

// UI ID: PlayerRoot_<playerObjectId>

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

export function OnPlayerLeaveGame(eventNumber: number) {
    ensureStateInitialized();
    removePlayerStateById(eventNumber);
}
