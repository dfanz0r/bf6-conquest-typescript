
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
    oobSound: null as mod.SFX | null,
};

let snowVolume: mod.SpatialObject | null = null;

// Static Arrays

const flagAnnounce: mod.VoiceOverFlags[] = [
    mod.VoiceOverFlags.Alpha,
    mod.VoiceOverFlags.Bravo,
    mod.VoiceOverFlags.Charlie,
    mod.VoiceOverFlags.Delta,
    mod.VoiceOverFlags.Echo,
    mod.VoiceOverFlags.Foxtrot,
    mod.VoiceOverFlags.Golf,
    mod.VoiceOverFlags.Hotel,
    mod.VoiceOverFlags.India,
];

let flagLetters: mod.Array;
let botNames: mod.Array;
let objectiveTrackingUI: mod.Array;

// Player State

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

    conditions = new Conditions(PlayerConditionSlot.Count);
}

// Team State

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

// Capture Point State

class CapturePointState {
    id: number;
    progress = 0;
    uiSize: mod.Vector;
    uiPosition: mod.Vector;
    conditions: Conditions;

    constructor(public capturePoint: mod.CapturePoint) {
        this.id = mod.GetObjId(capturePoint);
        this.uiSize = mod.CreateVector(0, 7, 0);
        this.uiPosition = mod.CreateVector(-110, 200, 0);
        this.conditions = new Conditions(CapturePointConditionSlot.Count);
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
    AIScoutOnDeploy = 9,
    AIReadyForAttack = 10,
    HandlePlayerJoin = 11,
    UpdateDeathOnUndeploy = 12,
    ShowCaptureUI = 13,
    AIFindNewObjective = 14,
    HideCaptureUI = 15,
    HandleTeamSwitchAndRepel = 16,
    EnterAreaTrigger = 17,
    ExitAreaTrigger = 18,
    AITargetDamager = 19,
    AIExitVehicle = 20,
    AIEnterVehicle = 21,
    AIRetryMove = 22,
    Count = 23,
}

enum CapturePointConditionSlot {
    HandleCaptured = 0,
    NotifyCapture = 1,
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
    return getCapturePointState(cp).conditions.getConditionState(n);
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
class PlayerController {
    shouldProcessKill(eventInfo: PlayerCombatEventInfo): boolean {
        return mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer));
    }

    processKill(eventInfo: PlayerCombatEventInfo): void {
        getPlayerState(eventInfo.eventPlayer).score += 10;
        getPlayerState(eventInfo.eventPlayer).score += 10;
        getPlayerState(eventInfo.eventPlayer).kills += 1;
        uiController.updatePlayerScoreboard(eventInfo.eventPlayer)
    }

    shouldProcessAssist(eventInfo: PlayerCombatEventInfo): boolean {
        return mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer));
    }

    processAssist(eventInfo: PlayerCombatEventInfo): void {
        getPlayerState(eventInfo.eventPlayer).score += 5;
        getPlayerState(eventInfo.eventPlayer).assists += 1;
        uiController.updatePlayerScoreboard(eventInfo.eventPlayer)
    }

    processRevive(eventInfo: PlayerCombatEventInfo): void {
        getPlayerState(eventInfo.eventOtherPlayer).score += 10;
        getPlayerState(eventInfo.eventOtherPlayer).revives += 1;
        uiController.updatePlayerScoreboard(eventInfo.eventOtherPlayer)
    }

    onUndeploy(eventInfo: PlayerEventInfo): void {
        if (FLAGS.PLAYER_DEATHS_BLEED) {
            getTeamState(mod.GetTeam(eventInfo.eventPlayer)).score -= 1;
        }
        getPlayerState(eventInfo.eventPlayer).deaths += 1;
        getPlayerState(eventInfo.eventPlayer).isOnPoint = false;
        uiController.updatePlayerScoreboard(eventInfo.eventPlayer)
        uiController.updateScoreboard()
    }

    shouldUndeploy(eventInfo: PlayerEventInfo): boolean {
        return isGameOngoing;
    }

    shouldEnterAreaTrigger(eventInfo: { eventPlayer: mod.Player; eventAreaTrigger: mod.AreaTrigger }): boolean {
        return mod.Or(
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
                    1400)));
    }

    shouldExitAreaTrigger(eventInfo: { eventPlayer: mod.Player; eventAreaTrigger: mod.AreaTrigger }): boolean {
        return mod.Or(
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
            mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAlive)));
    }

    enterAreaTrigger(eventInfo: { eventPlayer: mod.Player; eventAreaTrigger: mod.AreaTrigger }): void {
        if (mod.Not(getPlayerState(eventInfo.eventPlayer).isOutOfBounds)) {
            this.handleOutOfBounds(eventInfo)
        }
    }

    exitAreaTrigger(eventInfo: { eventPlayer: mod.Player; eventAreaTrigger: mod.AreaTrigger }): void {
        this.disableOutOfBounds(eventInfo)
    }

    async applyRepelForce(time: number, eventInfo: { eventPlayer: mod.Player; eventInteractPoint: mod.InteractPoint }): Promise<void> {
        if (mod.GreaterThan(
            mod.YComponentOf(mod.GetObjectPosition(mod.GetSpatialObject(mod.Add(
                mod.GetObjId(eventInfo.eventInteractPoint),
                50)))),
            mod.YComponentOf(mod.GetObjectPosition(eventInfo.eventPlayer)))) {
            mod.SetObjectTransformOverTime(eventInfo.eventPlayer, mod.CreateTransform(mod.Add(
                mod.CreateVector(mod.XComponentOf(mod.GetObjectPosition(eventInfo.eventPlayer)), mod.YComponentOf(mod.GetObjectPosition(mod.GetSpatialObject(mod.Add(
                    mod.GetObjId(eventInfo.eventInteractPoint),
                    50)))), mod.ZComponentOf(mod.GetObjectPosition(eventInfo.eventPlayer))),
                mod.UpVector()), mod.CreateVector(0, mod.YComponentOf(mod.GetObjectRotation(eventInfo.eventPlayer)), 0)), time, false, false)
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
                mod.Multiply(mod.UpVector(), 3)), mod.CreateVector(0, mod.YComponentOf(mod.GetObjectRotation(eventInfo.eventPlayer)), 0)), time, false, false)
        }
        await mod.Wait(mod.Add(
            time,
            0.1))
        mod.Teleport(eventInfo.eventPlayer, mod.GetObjectPosition(mod.GetSpatialObject(mod.Add(
            mod.GetObjId(eventInfo.eventInteractPoint),
            50))), mod.YComponentOf(mod.GetObjectRotation(eventInfo.eventPlayer)))
    }

    async handleTeamSwitchAndRepel(eventInfo: { eventPlayer: mod.Player; eventInteractPoint: mod.InteractPoint }): Promise<void> {
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
            await this.applyRepelForce(mod.Divide(
                mod.DistanceBetween(
                    mod.GetObjectPosition(eventInfo.eventPlayer),
                    mod.GetObjectPosition(mod.GetSpatialObject(mod.Add(
                        mod.GetObjId(eventInfo.eventInteractPoint),
                        50)))),
                8), eventInfo)
        }
    }

    async handleOutOfBounds(eventInfo: PlayerEventInfo): Promise<void> {
        if (!getPlayerState(eventInfo.eventPlayer).ignoreOOB && !getPlayerState(eventInfo.eventPlayer).isOutOfBounds && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAlive)) {
            getPlayerState(eventInfo.eventPlayer).isOutOfBounds = true;
            mod.SkipManDown(eventInfo.eventPlayer, true)
            if (mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier)) {
                for (let CaptureTickVar = 10; CaptureTickVar >= 0; CaptureTickVar -= 1) {
                    getPlayerState(eventInfo.eventPlayer).captureTick = CaptureTickVar;;
                    await mod.Wait(1)
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
                for (let CaptureTickVar = 10; CaptureTickVar >= 0; CaptureTickVar -= 1) {
                    getPlayerState(eventInfo.eventPlayer).captureTick = CaptureTickVar;;
                    uiController.updateOOBUI(eventInfo.eventPlayer, getPlayerState(eventInfo.eventPlayer).captureTick)
                    mod.PlaySound(audio.oobSound!, 0.7, eventInfo.eventPlayer)
                    await mod.Wait(1)
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
    }

    addEquipment(player: mod.Player): void {
        if (FLAGS.GIVE_PLAYERS_NVG) {
            mod.AddEquipment(player, mod.Gadgets.Mask_NVG)
        }
    }

    disableOutOfBounds(eventInfo: PlayerEventInfo): void {
        if (getPlayerState(eventInfo.eventPlayer).isOutOfBounds) {
            getPlayerState(eventInfo.eventPlayer).isOutOfBounds = false;
            mod.SkipManDown(eventInfo.eventPlayer, false)
        }
    }

    async onJoin(player: mod.Player): Promise<void> {
        getPlayerState(player).captureTick = -1;
        getPlayerState(player).isOnPoint = false;
        getPlayerState(player).isOutOfBounds = false;
        getPlayerState(player).ignoreOOB = false;
        getPlayerState(player).aiInAction = false;
        await mod.Wait(1)
        if (mod.IsPlayerValid(player)) {
            uiController.updatePlayerScoreboard(player)
            if (mod.Not(mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier))) {
                mod.SendErrorReport(mod.Message("Player Joined {}", player))
                uiController.setupPlayerUI(player)
                await mod.Wait(5)
                if (isGameOngoing) {
                    await mod.Wait(0.1)
                    conquestGame.resetFX({ eventPlayer: player })
                }
            }
        }
    }

    onLeave(playerId: number): void {
        removePlayerStateById(playerId);
    }

    async handleDeath(eventInfo: PlayerCombatEventInfo): Promise<void> {
        await mod.Wait(0.1)
        if (getPlayerState(eventInfo.eventPlayer).isOutOfBounds) {
            this.disableOutOfBounds(eventInfo)
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
}
class CapturePointController {
    setupCapturePoint(cp: mod.CapturePoint): void {
        mod.SetCapturePointCapturingTime(cp, CONFIG.FLAG_CAPTURE_TIME)
        mod.SetCapturePointNeutralizationTime(cp, CONFIG.FLAG_NEUTRAL_TIME)
        mod.EnableGameModeObjective(cp, true)
        mod.SetMaxCaptureMultiplier(cp, 3)
    }

    processObjectivePlayerData(player: mod.Player): void {
        getPlayerState(player).captures += 1;
        getPlayerState(player).score += 50;
        uiController.updatePlayerScoreboard(player)
        mod.PlaySound(audio.capturedSound!, 0.7, player)
    }

    async onCaptured(eventInfo: CapturePointEventInfo): Promise<void> {
        await mod.Wait(0.2)
        uiController.updateScoreboard()
        uiController.updateFlagIcons()
        const playersOnObjective = filterModArray(
            mod.GetPlayersOnPoint(eventInfo.eventCapturePoint),
            (currentArrayElement: any) => mod.Equals(
                mod.GetTeam(currentArrayElement),
                mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint)));
        for (let i = 0; i < mod.CountOf(playersOnObjective); i++) {
            this.processObjectivePlayerData(mod.ValueInArray(playersOnObjective, i) as mod.Player)
            if (mod.GetSoldierState(mod.ValueInArray(playersOnObjective, i), mod.SoldierStateBool.IsAISoldier)) {
                aiController.startScouting(mod.ValueInArray(playersOnObjective, i))
            }
        }
        this.spawnObjectiveVehicles(eventInfo)
        if (FLAGS.ENABLE_VO) {
            const flag = flagAnnounce[mod.GetObjId(eventInfo.eventCapturePoint) - 200];
            mod.PlayVO(audio.vo1!, mod.VoiceOverEvents2D.ObjectiveCaptured, flag, mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint))
            mod.PlayVO(audio.vo2!, mod.VoiceOverEvents2D.ObjectiveCapturedEnemy, flag, getTeamState(mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint)).otherTeam)
        }
    }

    shouldNotifyCapture(eventInfo: CapturePointEventInfo): boolean {
        return FLAGS.ENABLE_VO && mod.Equals(
            mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
            mod.GetTeam(0)) && mod.LessThan(mod.GetCaptureProgress(eventInfo.eventCapturePoint), 0.05);
    }

    async runProgressLoop(eventInfo: CapturePointEventInfo): Promise<void> {
        while (!isGameOngoing) { await mod.Wait(999) }
        if (FLAGS.CONQUEST_ASSAULT) {
            mod.SetCapturePointOwner(eventInfo.eventCapturePoint, mod.GetTeam(2))
        }
        await mod.Wait(mod.RandomReal(0, 1))
        const cpState = getCapturePointState(eventInfo.eventCapturePoint);
        cpState.progress = mod.GetCaptureProgress(eventInfo.eventCapturePoint);
        cpState.setProgressVisuals(cpState.progress);
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

    async onCapturing(eventInfo: CapturePointEventInfo): Promise<void> {
        uiController.updateFlagIcons()
        await mod.Wait(0.2)
        uiController.updateScoreboard()
        const flag = flagAnnounce[mod.GetObjId(eventInfo.eventCapturePoint) - 200];
        if (mod.NotEqualTo(mod.GetPreviousOwnerTeam(eventInfo.eventCapturePoint), mod.GetTeam(0))) {
            mod.PlayVO(audio.vo3!, mod.VoiceOverEvents2D.ObjectiveNeutralised, flag, mod.GetOwnerProgressTeam(eventInfo.eventCapturePoint))
            mod.PlayVO(audio.vo4!, mod.VoiceOverEvents2D.ObjectiveLost, flag, mod.GetPreviousOwnerTeam(eventInfo.eventCapturePoint))
        } else {
            mod.PlayVO(audio.vo3!, mod.VoiceOverEvents2D.ObjectiveCapturing, flag, mod.GetOwnerProgressTeam(eventInfo.eventCapturePoint))
        }
    }

    spawnObjectiveVehicles(eventInfo: CapturePointEventInfo): void {
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

    shouldShowCaptureUI(eventInfo: PlayerCapturePointEventInfo): boolean {
        return mod.Not(getPlayerState(eventInfo.eventPlayer).isOnPoint);
    }

    shouldHideCaptureUI(eventInfo: PlayerCapturePointEventInfo): boolean {
        return getPlayerState(eventInfo.eventPlayer).isOnPoint;
    }

    shouldUpdatePlayerCountOnDeath(eventInfo: PlayerEventInfo): boolean {
        return getPlayerState(eventInfo.eventPlayer).isOnPoint;
    }

    shouldUpdatePlayerCountOnRevive(eventInfo: PlayerEventInfo): boolean {
        return getPlayerState(eventInfo.eventPlayer).isOnPoint;
    }

    async showCaptureUI(eventInfo: PlayerCapturePointEventInfo): Promise<void> {
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

    hideCaptureUI(eventInfo: PlayerCapturePointEventInfo): void {
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

    updatePlayerCountOnDeath(eventInfo: PlayerEventInfo): void {
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

    updatePlayerCountOnRevive(eventInfo: PlayerEventInfo): void {
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
}
class AIController {
    shouldRetryMove(eventInfo: PlayerEventInfo): boolean {
        return FLAGS.ENABLE_CUSTOM_AI && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier);
    }

    retryMove(eventInfo: PlayerEventInfo): void {
        this.startScouting(eventInfo.eventPlayer);
    }

    shouldExitVehicle(eventInfo: { eventPlayer: mod.Player; eventVehicle: mod.Vehicle }): boolean {
        return FLAGS.ENABLE_CUSTOM_AI && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier);
    }

    exitVehicle(eventInfo: { eventPlayer: mod.Player; eventVehicle: mod.Vehicle }): void {
        this.startScouting(eventInfo.eventPlayer);
    }

    shouldTargetOnKill(eventInfo: PlayerCombatEventInfo): boolean {
        return FLAGS.ENABLE_CUSTOM_AI && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier) && !mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle);
    }

    targetOnKill(eventInfo: PlayerCombatEventInfo): void {
        this.startScouting(eventInfo.eventPlayer)
        getPlayerState(eventInfo.eventPlayer).aiInAction = false;
    }

    shouldTargetOnKillAssist(eventInfo: PlayerCombatEventInfo): boolean {
        return FLAGS.ENABLE_CUSTOM_AI && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier) && mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer)) && !mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle);
    }

    targetOnKillAssist(eventInfo: PlayerCombatEventInfo): void {
        this.startScouting(eventInfo.eventPlayer)
        getPlayerState(eventInfo.eventPlayer).aiInAction = false;
    }

    shouldScoutOnDeploy(eventInfo: PlayerEventInfo): boolean {
        return FLAGS.ENABLE_CUSTOM_AI && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier);
    }

    async deployScout(eventInfo: PlayerEventInfo): Promise<void> {
        await mod.Wait(0.2)
        if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
            mod.SetPlayerIncomingDamageFactor(eventInfo.eventPlayer, 0.5)
            await this.deploy(eventInfo)
        }
    }

    shouldFindNewObjective(eventInfo: PlayerCapturePointEventInfo): boolean {
        return FLAGS.ENABLE_CUSTOM_AI && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier) && !mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle);
    }

    async findNewObjective(eventInfo: PlayerCapturePointEventInfo): Promise<void> {
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
            this.startScouting(eventInfo.eventPlayer)
        }
    }

    shouldReadyForAttack(eventInfo: PlayerEventInfo): boolean {
        return FLAGS.ENABLE_CUSTOM_AI && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier) && mod.LessThanEqualTo(CONFIG.MAX_CUSTOM_AI, 70);
    }

    async readyForAttack(eventInfo: PlayerEventInfo): Promise<void> {
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
                            this.startScouting(eventInfo.eventPlayer)
                        }
                    }
                }
            }
            await mod.Wait(1)
        }
    }

    shouldTargetDamager(eventInfo: PlayerCombatEventInfo): boolean {
        return FLAGS.ENABLE_CUSTOM_AI && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier) && !getPlayerState(eventInfo.eventPlayer).aiInAction && mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer)) && !mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle);
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
        return FLAGS.ENABLE_CUSTOM_AI && mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier);
    }

    async enterVehicle(eventInfo: { eventPlayer: mod.Player; eventVehicle: mod.Vehicle }): Promise<void> {
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

    spawnAIObjectives(eventInfo: PlayerEventInfo): void {
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
                    this.deployAIVehicle(mod.RandomValueInArray(filterModArray(
                        mod.AllVehicles(),
                        (currentArrayElement: any) => mod.LessThan(
                            mod.CountOf(mod.GetAllPlayersInVehicle(currentArrayElement)),
                            2))), 60, eventInfo)
                }
                if (mod.LessThan(
                    mod.RoundToInteger(mod.RandomReal(0, 5)),
                    5)) {
                    mod.Teleport(eventInfo.eventPlayer, mod.GetObjectPosition(mod.RandomValueInArray(getPlayerState(eventInfo.eventPlayer).aiSpawnPoints)), 1)
                    this.deployAIVehicle(mod.RandomValueInArray(filterModArray(
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

    deployAIVehicle(vehicle: mod.Vehicle, distance: number, eventInfo: PlayerEventInfo): void {
        if (mod.IsPlayerValid(eventInfo.eventPlayer) && mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle))) {
            if (mod.LessThan(
                mod.DistanceBetween(
                    mod.GetVehicleState(vehicle, mod.VehicleStateVector.VehiclePosition),
                    mod.GetObjectPosition(eventInfo.eventPlayer)),
                distance)) {
                mod.AIBattlefieldBehavior(eventInfo.eventPlayer)
                mod.ForcePlayerToSeat(eventInfo.eventPlayer, vehicle, -1)
            }
        }
    }

    async deploy(eventInfo: PlayerEventInfo): Promise<void> {
        this.spawnAIObjectives(eventInfo)
        await mod.Wait(0.2)
        if (mod.Equals(
            mod.RoundToInteger(mod.RandomReal(0, 1)),
            0)) {
            this.deployAIVehicle(mod.RandomValueInArray(filterModArray(
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
        this.startScouting(eventInfo.eventPlayer)
    }

    addAI(): void {
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

    startScouting(player: mod.Player): void {
        if (mod.IsPlayerValid(player) && mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive) && !mod.GetSoldierState(player, mod.SoldierStateBool.IsInVehicle)) {
            if (mod.Equals(
                mod.CountOf(filterModArray(
                    mod.AllCapturePoints(),
                    (currentArrayElement: any) => mod.NotEqualTo(mod.GetTeam(player), mod.GetCurrentOwnerTeam(currentArrayElement)))),
                0)) {
                getPlayerState(player).aiTarget = mod.RandomValueInArray(filterModArray(
                    mod.AllCapturePoints(),
                    (currentArrayElement: any) => mod.Equals(
                        mod.GetTeam(player),
                        mod.GetCurrentOwnerTeam(currentArrayElement))));
                mod.AIDefendPositionBehavior(player, mod.GetObjectPosition(getPlayerState(player).aiTarget!), 0, 30)
            } else {
                getPlayerState(player).aiTarget = mod.RandomValueInArray(filterModArray(
                    mod.AllCapturePoints(),
                    (currentArrayElement: any) => mod.NotEqualTo(mod.GetTeam(player), mod.GetCurrentOwnerTeam(currentArrayElement))));
                mod.AIMoveToBehavior(player, mod.GetObjectPosition(getPlayerState(player).aiTarget!))
            }
            if (mod.GreaterThan(
                mod.DistanceBetween(
                    mod.GetObjectPosition(mod.ClosestPlayerTo(mod.GetObjectPosition(player), getTeamState(mod.GetTeam(player)).otherTeam)),
                    mod.GetObjectPosition(player)),
                30)) {
                mod.AISetMoveSpeed(player, mod.MoveSpeed.Sprint)
            } else {
                mod.AISetMoveSpeed(player, mod.MoveSpeed.InvestigateRun)
            }
        }
    }
}
class ConquestGame {
    shouldUpdateScoreTime(): boolean {
        return isGameOngoing && mod.Equals(
            mod.Modulo(
                mod.RoundToInteger(mod.GetMatchTimeElapsed()),
                2),
            0);
    }

    shouldUpdateScoreTimeOddTick(): boolean {
        return isGameOngoing && mod.Equals(
            mod.Modulo(
                mod.RoundToInteger(mod.GetMatchTimeElapsed()),
                2),
            1);
    }

    shouldTrackScore(): boolean {
        return isGameOngoing && mod.Equals(
            mod.Modulo(
                mod.RoundToInteger(mod.GetMatchTimeElapsed()),
                CONFIG.TICKET_BLEED_SPEED),
            0);
    }

    shouldPlayNearEndMusic(): boolean {
        return isGameOngoing && (mod.LessThanEqualTo(mod.GetMatchTimeRemaining(), 60) ||
            mod.LessThanEqualTo(getTeamState(TEAM_1).score, CONFIG.LOW_TICKET_MUSIC_THRESHOLD) ||
            mod.LessThanEqualTo(getTeamState(TEAM_2).score, CONFIG.LOW_TICKET_MUSIC_THRESHOLD));
    }

    shouldEndGame(): boolean {
        return isGameOngoing && (mod.LessThanEqualTo(mod.GetMatchTimeRemaining(), 1) ||
            mod.LessThanEqualTo(getTeamState(TEAM_1).score, 0) ||
            mod.LessThanEqualTo(getTeamState(TEAM_2).score, 0));
    }

    async updateScoreTimeAndAI(): Promise<void> {
        uiController.updateScoreboard()
        aiController.addAI()
        await mod.Wait(0.1)
        aiController.addAI()
        this.checkConquestAssaultWin()
    }

    async updateScoreTimeAndAISecondaryTick(): Promise<void> {
        uiController.updateScoreboard()
        aiController.addAI()
        await mod.Wait(0.1)
        aiController.addAI()
    }

    trackScoreAndBleed(): void {
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

    playNearEndMusic(): void {
        mod.PlayMusic(mod.MusicEvents.Core_Overtime_Loop)
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

    async setupMap(): Promise<void> {
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
            capturePointController.setupCapturePoint(mod.ValueInArray(mod.AllCapturePoints(), i))
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
        if (FLAGS.CONQUEST_ASSAULT && mod.GreaterThan(
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
                    0)) {
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

function notifyCaptureRule(eventInfo: CapturePointEventInfo) {
    const condition = getCapturePointCondition(eventInfo.eventCapturePoint, CapturePointConditionSlot.NotifyCapture);
    const state = capturePointController.shouldNotifyCapture(eventInfo);
    if (condition.update(state)) {
        capturePointController.onCapturing(eventInfo);
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

function aiScoutOnDeployRule(eventInfo: PlayerEventInfo) {
    const condition = getPlayerCondition(eventInfo.eventPlayer, PlayerConditionSlot.AIScoutOnDeploy);
    const state = aiController.shouldScoutOnDeploy(eventInfo);
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

function initObjectiveLetters() {
    const first = "A".charCodeAt(0);
    const last = "Z".charCodeAt(0);

    flagLetters = mod.EmptyArray();
    for (let code = first; code <= last; code++) {
        const letter = String.fromCharCode(code);
        flagLetters = mod.AppendToArray(flagLetters, letter);
    }
}

function initObjectiveTeamUI() {
    const first = "A".charCodeAt(0);
    const last = "Z".charCodeAt(0);
    const firstSuffix = 1;
    const lastSuffix = 4;

    objectiveTrackingUI = mod.EmptyArray();
    for (let suffix = firstSuffix; suffix <= lastSuffix; suffix++) {
        for (let code = first; code <= last; code++) {
            const letter = String.fromCharCode(code);
            objectiveTrackingUI = mod.AppendToArray(objectiveTrackingUI, letter + suffix);
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
    const eventInfo = { eventPlayer };
    addEquipmentRule(eventInfo);
    aiScoutOnDeployRule(eventInfo);
    aiReadyForAttackRule(eventInfo);
}

export function OnPlayerJoinGame(eventPlayer: mod.Player) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer };
    handlePlayerJoinRule(eventInfo);
}

export function OnPlayerUndeploy(eventPlayer: mod.Player) {
    ensureStateInitialized();
    const eventInfo = { eventPlayer };
    updateDeathOnUndeployRule(eventInfo);
}

export function OnCapturePointCaptured(eventCapturePoint: mod.CapturePoint) {
    ensureStateInitialized();
    const eventInfo = { eventCapturePoint };
    handleCapturePointCapturedRule(eventInfo);
}

export function OnCapturePointCapturing(eventCapturePoint: mod.CapturePoint) {
    ensureStateInitialized();
    const eventInfo = { eventCapturePoint };
    notifyCaptureRule(eventInfo);
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

export function OnPlayerLeaveGame(eventNumber: number) {
    ensureStateInitialized();
    playerController.onLeave(eventNumber);
}
