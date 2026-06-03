
import * as modlib from 'modlib';

function OngoingGlobal_Initialise_Action() {
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
    mod.SetVariable(FX_ResetingGlobalVar, false)
    mod.SetVariable(CapturePointProgressGlobalVar, mod.EmptyArray())
    mod.SetVariable(UniqueUI_ID_UsedGlobalVar, mod.EmptyArray())
    mod.SetVariable(tempGlobalVar, mod.EmptyArray())
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
    UniquePlayerUI1()
    ObjectiveLetters()
    ObjectiveTeamUI_Array()
    AddBotNames()
    FlagCalls()
}
function OngoingGlobal_Initialise(conditionState: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    OngoingGlobal_Initialise_Action();
}

async function OnGameModeStarted_MapSetup_Action() {
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
    MainUI_ScoreandTime()
    Scoreboard()
    FlagIconsUpdate()
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
    for (let iteratorVar = 0; iteratorVar < mod.CountOf(mod.AllCapturePoints()); iteratorVar += 1) {
        mod.SetVariable(iteratorGlobalVar, iteratorVar);
        CapturePointSetup(mod.ValueInArray(mod.AllCapturePoints(), mod.GetVariable(iteratorGlobalVar)))
    }
    mod.SetUnspawnDelayInSeconds(mod.GetSpawner(901), 300)
    mod.SetUnspawnDelayInSeconds(mod.GetSpawner(902), 300)
    Version()
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
    for (let iterator4Var = 2000; iterator4Var < 2999; iterator4Var += 1) {
        mod.SetVariable(iterator4GlobalVar, iterator4Var);
        mod.EnableVFX(mod.GetVFX(mod.GetVariable(iterator4GlobalVar)), true)
    }
    while (mod.GetVariable(GameOngoingGlobalVar)) {
        for (let iterator3Var = 10; iterator3Var < 0; iterator3Var += -2) {
            mod.SetVariable(iterator3GlobalVar, iterator3Var);
            mod.SetVariable(CapturepointFlashGlobalVar, mod.Divide(
                mod.GetVariable(iterator3GlobalVar),
                10))
            await mod.Wait(0.1)
        }
        for (let iterator3Var = 0; iterator3Var < 10; iterator3Var += 2) {
            mod.SetVariable(iterator3GlobalVar, iterator3Var);
            mod.SetVariable(CapturepointFlashGlobalVar, mod.Divide(
                mod.GetVariable(iterator3GlobalVar),
                10))
            await mod.Wait(0.1)
        }
    }
}
function OnGameModeStarted_MapSetup(conditionState: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    OnGameModeStarted_MapSetup_Action();
}

function OngoingGlobal_Update_Score_and_Time_Condition(): boolean {
    const newState = mod.And(mod.GetVariable(GameOngoingGlobalVar), mod.Equals(
        mod.Modulo(
            mod.RoundToInteger(mod.GetMatchTimeElapsed()),
            2),
        0))
    return newState;
}

async function OngoingGlobal_Update_Score_and_Time_Action() {
    Scoreboard()
    Add_AI()
    await mod.Wait(0.1)
    Add_AI()
    ConquestAssaultWinCheck()
}
function OngoingGlobal_Update_Score_and_Time(conditionState: any) {
    let newState = OngoingGlobal_Update_Score_and_Time_Condition();
    if (!conditionState.update(newState)) {
        return;
    }
    OngoingGlobal_Update_Score_and_Time_Action();
}

function OngoingGlobal_Update_Score_and_Time1_Condition(): boolean {
    const newState = mod.And(mod.GetVariable(GameOngoingGlobalVar), mod.Equals(
        mod.Modulo(
            mod.RoundToInteger(mod.GetMatchTimeElapsed()),
            2),
        1))
    return newState;
}

async function OngoingGlobal_Update_Score_and_Time1_Action() {
    Scoreboard()
    Add_AI()
    await mod.Wait(0.1)
    Add_AI()
}
function OngoingGlobal_Update_Score_and_Time1(conditionState: any) {
    let newState = OngoingGlobal_Update_Score_and_Time1_Condition();
    if (!conditionState.update(newState)) {
        return;
    }
    OngoingGlobal_Update_Score_and_Time1_Action();
}

function OngoingGlobal_Score_tracker_Condition(): boolean {
    const newState = mod.And(mod.GetVariable(GameOngoingGlobalVar), mod.Equals(
        mod.Modulo(
            mod.RoundToInteger(mod.GetMatchTimeElapsed()),
            mod.GetVariable(TicketBleedSpeedGlobalVar)),
        0))
    return newState;
}

function OngoingGlobal_Score_tracker_Action() {
    if (mod.GetVariable(TotalControlTicketBleedGlobalVar)) {
        if (modlib.IsTrueForAll(mod.AllCapturePoints(), (currentArrayElement: any) => mod.Equals(
            mod.GetCurrentOwnerTeam(currentArrayElement),
            mod.GetTeam(1)))) {
            mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar), mod.Subtract(
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)),
                mod.GetVariable(TotalControlBonusGlobalVar)))
        } else if (modlib.IsTrueForAll(mod.AllCapturePoints(), (currentArrayElement: any) => mod.Equals(
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
            mod.CountOf(modlib.FilteredArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.Equals(
                    mod.GetCurrentOwnerTeam(currentArrayElement),
                    mod.GetTeam(2)))),
            mod.CountOf(modlib.FilteredArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.Equals(
                    mod.GetCurrentOwnerTeam(currentArrayElement),
                    mod.GetTeam(1)))))) {
            mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar), mod.Subtract(
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)),
                mod.Subtract(
                    mod.CountOf(modlib.FilteredArray(
                        mod.AllCapturePoints(),
                        (currentArrayElement: any) => mod.Equals(
                            mod.GetCurrentOwnerTeam(currentArrayElement),
                            mod.GetTeam(2)))),
                    mod.CountOf(modlib.FilteredArray(
                        mod.AllCapturePoints(),
                        (currentArrayElement: any) => mod.Equals(
                            mod.GetCurrentOwnerTeam(currentArrayElement),
                            mod.GetTeam(1)))))))
            Scoreboard()
            UIFlashAnimation("LeftFlash1", "RightFlash2")
        }
        if (mod.GreaterThan(
            mod.CountOf(modlib.FilteredArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.Equals(
                    mod.GetCurrentOwnerTeam(currentArrayElement),
                    mod.GetTeam(1)))),
            mod.CountOf(modlib.FilteredArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.Equals(
                    mod.GetCurrentOwnerTeam(currentArrayElement),
                    mod.GetTeam(2)))))) {
            mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar), mod.Subtract(
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)),
                mod.Subtract(
                    mod.CountOf(modlib.FilteredArray(
                        mod.AllCapturePoints(),
                        (currentArrayElement: any) => mod.Equals(
                            mod.GetCurrentOwnerTeam(currentArrayElement),
                            mod.GetTeam(1)))),
                    mod.CountOf(modlib.FilteredArray(
                        mod.AllCapturePoints(),
                        (currentArrayElement: any) => mod.Equals(
                            mod.GetCurrentOwnerTeam(currentArrayElement),
                            mod.GetTeam(2)))))))
            Scoreboard()
            UIFlashAnimation("RightFlash1", "LeftFlash2")
        }
    } else {
        mod.SetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar), mod.Subtract(
            mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)),
            mod.CountOf(modlib.FilteredArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.Equals(
                    mod.GetCurrentOwnerTeam(currentArrayElement),
                    mod.GetTeam(2))))))
        mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar), mod.Subtract(
            mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)),
            mod.CountOf(modlib.FilteredArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.Equals(
                    mod.GetCurrentOwnerTeam(currentArrayElement),
                    mod.GetTeam(1))))))
    }
}
function OngoingGlobal_Score_tracker(conditionState: any) {
    let newState = OngoingGlobal_Score_tracker_Condition();
    if (!conditionState.update(newState)) {
        return;
    }
    OngoingGlobal_Score_tracker_Action();
}

function OnPlayerEarnedKill_Ean_Kill_Condition(eventInfo: any): boolean {
    const newState = mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer));
    return newState;
}

function OnPlayerEarnedKill_Ean_Kill_Action(eventInfo: any) {
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, ScorePlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, ScorePlayerVar)),
        10))
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, ScorePlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, ScorePlayerVar)),
        10))
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, PlayerKillsPlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, PlayerKillsPlayerVar)),
        1))
    UpdatePlayerScoreboard(eventInfo.eventPlayer)
}
function OnPlayerEarnedKill_Ean_Kill(conditionState: any, eventInfo: any) {
    let newState = OnPlayerEarnedKill_Ean_Kill_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerEarnedKill_Ean_Kill_Action(eventInfo);
}

function OnPlayerEarnedKillAssist_Kill_assist_Condition(eventInfo: any): boolean {
    const newState = mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer));
    return newState;
}

function OnPlayerEarnedKillAssist_Kill_assist_Action(eventInfo: any) {
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, ScorePlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, ScorePlayerVar)),
        5))
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, KillAssistsPlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, KillAssistsPlayerVar)),
        1))
    UpdatePlayerScoreboard(eventInfo.eventPlayer)
}
function OnPlayerEarnedKillAssist_Kill_assist(conditionState: any, eventInfo: any) {
    let newState = OnPlayerEarnedKillAssist_Kill_assist_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerEarnedKillAssist_Kill_assist_Action(eventInfo);
}

function OnRevived_Revive_Counter_Action(eventInfo: any) {
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventOtherPlayer, ScorePlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventOtherPlayer, ScorePlayerVar)),
        10))
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventOtherPlayer, RevivesPlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventOtherPlayer, RevivesPlayerVar)),
        1))
    UpdatePlayerScoreboard(eventInfo.eventOtherPlayer)
}
function OnRevived_Revive_Counter(conditionState: any, eventInfo: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    OnRevived_Revive_Counter_Action(eventInfo);
}

async function OnPlayerDied_CustomAI_Score_Tracking_Action(eventInfo: any) {
    await mod.Wait(0.1)
    if (mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar))) {
        DisableOutOfBounds(eventInfo)
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
                UpdatePlayerScoreboard(eventInfo.eventPlayer)
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
function OnPlayerDied_CustomAI_Score_Tracking(conditionState: any, eventInfo: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerDied_CustomAI_Score_Tracking_Action(eventInfo);
}

function OnPlayerDeployed_Add_Equipment_Action(eventInfo: any) {
    if (mod.GetVariable(GivePlayersNVGGlobalVar)) {
        mod.AddEquipment(eventInfo.eventPlayer, mod.Gadgets.Mask_NVG)
    }
}
function OnPlayerDeployed_Add_Equipment(conditionState: any, eventInfo: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerDeployed_Add_Equipment_Action(eventInfo);
}

async function OnPlayerJoinGame_Sets_Scoreboard_Action(eventInfo: any) {
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar), -1)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar), false)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar), false)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, IgnoreOOBPlayerVar), false)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_InActionPlayerVar), false)
    await mod.Wait(1)
    if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
        UpdatePlayerScoreboard(eventInfo.eventPlayer)
        if (mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier))) {
            mod.SendErrorReport(mod.Message("Player Joined {}", eventInfo.eventPlayer))
            PlayerUISetup(eventInfo)
            await mod.Wait(5)
            if (mod.GetVariable(GameOngoingGlobalVar)) {
                await mod.Wait(0.1)
                FX_Reset(eventInfo)
            }
        }
    }
}
function OnPlayerJoinGame_Sets_Scoreboard(conditionState: any, eventInfo: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerJoinGame_Sets_Scoreboard_Action(eventInfo);
}

function OnPlayerUndeploy_Death_Update_Condition(eventInfo: any): boolean {
    const newState = mod.GetVariable(GameOngoingGlobalVar);
    return newState;
}

function OnPlayerUndeploy_Death_Update_Action(eventInfo: any) {
    if (mod.GetVariable(PlayerDeathsBleedGlobalVar)) {
        mod.SetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), TeamScoreTeamVar), mod.Subtract(
            mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), TeamScoreTeamVar)),
            1))
    }
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, PlayerDeathsPlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, PlayerDeathsPlayerVar)),
        1))
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar), false)
    UpdatePlayerScoreboard(eventInfo.eventPlayer)
    Scoreboard()
}
function OnPlayerUndeploy_Death_Update(conditionState: any, eventInfo: any) {
    let newState = OnPlayerUndeploy_Death_Update_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerUndeploy_Death_Update_Action(eventInfo);
}

async function OnCapturePointCaptured_On_Capture_Action(eventInfo: any) {
    await mod.Wait(0.2)
    Scoreboard()
    FlagIconsUpdate()
    mod.SetVariable(PlayersOnObjectiveGlobalVar, mod.EmptyArray())
    mod.SetVariable(PlayersOnObjectiveGlobalVar, modlib.FilteredArray(
        mod.GetPlayersOnPoint(eventInfo.eventCapturePoint),
        (currentArrayElement: any) => mod.Equals(
            mod.GetTeam(currentArrayElement),
            mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint))))
    for (let iteratorVar = 0; iteratorVar < mod.CountOf(mod.GetVariable(PlayersOnObjectiveGlobalVar)); iteratorVar += 1) {
        mod.SetVariable(iteratorGlobalVar, iteratorVar);
        ObjectiveCapturedPlayerData(mod.ValueInArray(mod.GetVariable(PlayersOnObjectiveGlobalVar), mod.GetVariable(iteratorGlobalVar)))
        if (mod.GetSoldierState(mod.ValueInArray(mod.GetVariable(PlayersOnObjectiveGlobalVar), mod.GetVariable(iteratorGlobalVar)), mod.SoldierStateBool.IsAISoldier)) {
            AI_Scouting(mod.ValueInArray(mod.GetVariable(PlayersOnObjectiveGlobalVar), mod.GetVariable(iteratorGlobalVar)))
        }
    }
    ObjectiveVehicleSpawn(eventInfo)
    if (mod.GetVariable(EnableVOGlobalVar)) {
        mod.PlayVO(mod.GetVariable(VO1GlobalVar), mod.VoiceOverEvents2D.ObjectiveCaptured, mod.ValueInArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.Subtract(
            mod.GetObjId(eventInfo.eventCapturePoint),
            200)), mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint))
        mod.PlayVO(mod.GetVariable(VO2GlobalVar), mod.VoiceOverEvents2D.ObjectiveCapturedEnemy, mod.ValueInArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.Subtract(
            mod.GetObjId(eventInfo.eventCapturePoint),
            200)), mod.GetVariable(mod.ObjectVariable(mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint), OtherTeamTeamVar)))
    }
}
function OnCapturePointCaptured_On_Capture(conditionState: any, eventInfo: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    OnCapturePointCaptured_On_Capture_Action(eventInfo);
}

function OnCapturePointCapturing_Notify_Capture_Condition(eventInfo: any): boolean {
    const newState = modlib.And(mod.GetVariable(EnableVOGlobalVar), mod.Equals(
        mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint),
        mod.GetTeam(0)), mod.LessThan(mod.GetCaptureProgress(eventInfo.eventCapturePoint), 0.05))
    return newState;
}

async function OnCapturePointCapturing_Notify_Capture_Action(eventInfo: any) {
    FlagIconsUpdate()
    await mod.Wait(0.2)
    Scoreboard()
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
function OnCapturePointCapturing_Notify_Capture(conditionState: any, eventInfo: any) {
    let newState = OnCapturePointCapturing_Notify_Capture_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnCapturePointCapturing_Notify_Capture_Action(eventInfo);
}

function OngoingGlobal_Near_End_Music_Trigger_Condition(): boolean {
    const newState = mod.And(mod.GetVariable(GameOngoingGlobalVar), mod.Or(
        mod.LessThanEqualTo(mod.GetMatchTimeRemaining(), 60),
        mod.Or(
            mod.LessThanEqualTo(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)), mod.GetVariable(LowTicketMusicGlobalVar)),
            mod.LessThanEqualTo(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)), mod.GetVariable(LowTicketMusicGlobalVar)))))
    return newState;
}

function OngoingGlobal_Near_End_Music_Trigger_Action() {
    mod.PlayMusic(mod.MusicEvents.Core_Overtime_Loop)
}
function OngoingGlobal_Near_End_Music_Trigger(conditionState: any) {
    let newState = OngoingGlobal_Near_End_Music_Trigger_Condition();
    if (!conditionState.update(newState)) {
        return;
    }
    OngoingGlobal_Near_End_Music_Trigger_Action();
}

function OngoingGlobal_End_Game_Condition(): boolean {
    const newState = mod.And(mod.GetVariable(GameOngoingGlobalVar), mod.Or(
        mod.LessThanEqualTo(mod.GetMatchTimeRemaining(), 1),
        mod.Or(
            mod.LessThanEqualTo(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)), 0),
            mod.LessThanEqualTo(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)), 0))))
    return newState;
}

async function OngoingGlobal_End_Game_Action() {
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
    Scoreboard()
    mod.SetUIWidgetSize(mod.FindUIWidgetWithName("Timer"), mod.CreateVector(190, 60, 0))
    mod.SetUITextSize(mod.FindUIWidgetWithName("Timer"), 48)
    mod.SetUIWidgetPosition(mod.FindUIWidgetWithName("Timer"), mod.CreateVector(0, 390, 0))
    mod.DeleteUIWidget(mod.FindUIWidgetWithName("Team1LeftBar"))
    mod.DeleteUIWidget(mod.FindUIWidgetWithName("Team1RightBar"))
    mod.DeleteUIWidget(mod.FindUIWidgetWithName("Team2LeftBar"))
    mod.DeleteUIWidget(mod.FindUIWidgetWithName("Team2RightBar"))
    mod.DeleteUIWidget(mod.FindUIWidgetWithName("LeftBarBG"))
    mod.DeleteUIWidget(mod.FindUIWidgetWithName("RightBarBG"))
    for (let iteratorVar = 0; iteratorVar < mod.CountOf(mod.GetVariable(ObjectiveTrackingUIGlobalVar)); iteratorVar += 1) {
        mod.SetVariable(iteratorGlobalVar, iteratorVar);
        mod.DeleteUIWidget(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.GetVariable(iteratorGlobalVar))))
    }
    EndGame_UI("Team1ScoreLeft", mod.GetVariable(ScorePositionLeftGlobalVar))
    EndGame_UI("Team1ScoreRight", mod.GetVariable(ScorePositionRightGlobalVar))
    EndGame_UI("Team2ScoreLeft", mod.GetVariable(ScorePositionLeftGlobalVar))
    EndGame_UI("Team2ScoreRight", mod.GetVariable(ScorePositionRightGlobalVar))
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
function OngoingGlobal_End_Game(conditionState: any) {
    let newState = OngoingGlobal_End_Game_Condition();
    if (!conditionState.update(newState)) {
        return;
    }
    OngoingGlobal_End_Game_Action();
}

function OnPlayerEnterCapturePoint_CapturePoint_UI_Condition(eventInfo: any): boolean {
    const newState = mod.Not(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar)));
    return newState;
}

async function OnPlayerEnterCapturePoint_CapturePoint_UI_Action(eventInfo: any) {
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointPlayerVar), eventInfo.eventCapturePoint)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointStatePlayerVar), mod.GetCaptureProgress(eventInfo.eventCapturePoint))
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, FlagOwnerPlayerVar), mod.GetTeam(3))
    mod.SetVariableAtIndex(tempGlobalVar, mod.GetObjId(eventInfo.eventCapturePoint), modlib.FilteredArray(
        mod.GetPlayersOnPoint(eventInfo.eventCapturePoint),
        (currentArrayElement: any) => mod.IsPlayerValid(currentArrayElement)))
    mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), PlayersOnPointTeamVar), mod.GetObjId(eventInfo.eventCapturePoint), mod.CountOf(modlib.FilteredArray(
        mod.ValueInArray(mod.GetVariable(tempGlobalVar), mod.GetObjId(eventInfo.eventCapturePoint)),
        (currentArrayElement: any) => mod.And(
            mod.GetSoldierState(currentArrayElement, mod.SoldierStateBool.IsAlive),
            mod.Equals(
                mod.GetTeam(currentArrayElement),
                mod.GetTeam(eventInfo.eventPlayer))))))
    mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), OtherTeamTeamVar)), PlayersOnPointTeamVar), mod.GetObjId(eventInfo.eventCapturePoint), mod.CountOf(modlib.FilteredArray(
        mod.ValueInArray(mod.GetVariable(tempGlobalVar), mod.GetObjId(eventInfo.eventCapturePoint)),
        (currentArrayElement: any) => mod.And(
            mod.GetSoldierState(currentArrayElement, mod.SoldierStateBool.IsAlive),
            mod.Equals(
                mod.GetTeam(currentArrayElement),
                mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), OtherTeamTeamVar)))))))
    await mod.Wait(0.05)
    CapturePointUI_Manager(eventInfo.eventCapturePoint, mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointStatePlayerVar)), eventInfo)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar), true)
    if (mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier))) {
        mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar), 9)
        while (mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar))) {
            if (mod.Not(mod.IsPlayerValid(eventInfo.eventPlayer))) {
                break
            }
            if (mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAlive)) {
                PlayerCapturepointUIToggle(true, eventInfo)
                PlayerCapturepointUI(eventInfo)
            } else {
                PlayerCapturepointUIToggle(false, eventInfo)
            }
            mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointStatePlayerVar), mod.GetCaptureProgress(eventInfo.eventCapturePoint))
            mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, FlagOwnerPlayerVar), mod.GetCurrentOwnerTeam(eventInfo.eventCapturePoint))
            while (mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar))) { await mod.Wait(0.1) }
        }
        mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar), -1)
        PlayerCapturepointUIToggle(false, eventInfo)
    }
}
function OnPlayerEnterCapturePoint_CapturePoint_UI(conditionState: any, eventInfo: any) {
    let newState = OnPlayerEnterCapturePoint_CapturePoint_UI_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerEnterCapturePoint_CapturePoint_UI_Action(eventInfo);
}

function OnPlayerExitCapturePoint_Remove_CapturePoint_UI_Condition(eventInfo: any): boolean {
    const newState = mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar));
    return newState;
}

function OnPlayerExitCapturePoint_Remove_CapturePoint_UI_Action(eventInfo: any) {
    mod.SetVariableAtIndex(tempGlobalVar, mod.GetObjId(eventInfo.eventCapturePoint), modlib.FilteredArray(
        mod.GetPlayersOnPoint(eventInfo.eventCapturePoint),
        (currentArrayElement: any) => mod.IsPlayerValid(currentArrayElement)))
    mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), PlayersOnPointTeamVar), mod.GetObjId(eventInfo.eventCapturePoint), mod.CountOf(modlib.FilteredArray(
        mod.ValueInArray(mod.GetVariable(tempGlobalVar), mod.GetObjId(eventInfo.eventCapturePoint)),
        (currentArrayElement: any) => mod.And(
            mod.GetSoldierState(currentArrayElement, mod.SoldierStateBool.IsAlive),
            mod.Equals(
                mod.GetTeam(currentArrayElement),
                mod.GetTeam(eventInfo.eventPlayer))))))
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar), false)
}
function OnPlayerExitCapturePoint_Remove_CapturePoint_UI(conditionState: any, eventInfo: any) {
    let newState = OnPlayerExitCapturePoint_Remove_CapturePoint_UI_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerExitCapturePoint_Remove_CapturePoint_UI_Action(eventInfo);
}

function OnPlayerDied_Update_Player_Count_On_Death_Condition(eventInfo: any): boolean {
    const newState = mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar));
    return newState;
}

function OnPlayerDied_Update_Player_Count_On_Death_Action(eventInfo: any) {
    mod.SetVariableAtIndex(tempGlobalVar, mod.GetObjId(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointPlayerVar))), modlib.FilteredArray(
        mod.GetPlayersOnPoint(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointPlayerVar))),
        (currentArrayElement: any) => mod.IsPlayerValid(currentArrayElement)))
    mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), PlayersOnPointTeamVar), mod.GetObjId(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointPlayerVar))), mod.CountOf(modlib.FilteredArray(
        mod.ValueInArray(mod.GetVariable(tempGlobalVar), mod.GetObjId(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointPlayerVar)))),
        (currentArrayElement: any) => mod.And(
            mod.GetSoldierState(currentArrayElement, mod.SoldierStateBool.IsAlive),
            mod.Equals(
                mod.GetTeam(currentArrayElement),
                mod.GetTeam(eventInfo.eventPlayer))))))
}
function OnPlayerDied_Update_Player_Count_On_Death(conditionState: any, eventInfo: any) {
    let newState = OnPlayerDied_Update_Player_Count_On_Death_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerDied_Update_Player_Count_On_Death_Action(eventInfo);
}

function OnRevived_Update_Player_Count_When_Revived_Condition(eventInfo: any): boolean {
    const newState = mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OnPointPlayerVar));
    return newState;
}

function OnRevived_Update_Player_Count_When_Revived_Action(eventInfo: any) {
    mod.SetVariableAtIndex(tempGlobalVar, mod.GetObjId(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointPlayerVar))), modlib.FilteredArray(
        mod.GetPlayersOnPoint(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointPlayerVar))),
        (currentArrayElement: any) => mod.IsPlayerValid(currentArrayElement)))
    mod.SetVariableAtIndex(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), PlayersOnPointTeamVar), mod.GetObjId(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointPlayerVar))), mod.CountOf(modlib.FilteredArray(
        mod.ValueInArray(mod.GetVariable(tempGlobalVar), mod.GetObjId(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CapturePointPlayerVar)))),
        (currentArrayElement: any) => mod.And(
            mod.GetSoldierState(currentArrayElement, mod.SoldierStateBool.IsAlive),
            mod.Equals(
                mod.GetTeam(currentArrayElement),
                mod.GetTeam(eventInfo.eventPlayer))))))
}
function OnRevived_Update_Player_Count_When_Revived(conditionState: any, eventInfo: any) {
    let newState = OnRevived_Update_Player_Count_When_Revived_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnRevived_Update_Player_Count_When_Revived_Action(eventInfo);
}

async function OnPlayerInteract_Team_Switcher_and_Repel_Logic_Action(eventInfo: any) {
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
            UpdatePlayerScoreboard(eventInfo.eventPlayer)
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
        RepelLogic(mod.Divide(
            mod.DistanceBetween(
                mod.GetObjectPosition(eventInfo.eventPlayer),
                mod.GetObjectPosition(mod.GetSpatialObject(mod.Add(
                    mod.GetObjId(eventInfo.eventInteractPoint),
                    50)))),
            8), eventInfo)
    }
}
function OnPlayerInteract_Team_Switcher_and_Repel_Logic(conditionState: any, eventInfo: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerInteract_Team_Switcher_and_Repel_Logic_Action(eventInfo);
}

function OnPlayerEnterAreaTrigger_EnterArea_Condition(eventInfo: any): boolean {
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

function OnPlayerEnterAreaTrigger_EnterArea_Action(eventInfo: any) {
    if (mod.Not(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar)))) {
        OutOfBounds(eventInfo)
    }
}
function OnPlayerEnterAreaTrigger_EnterArea(conditionState: any, eventInfo: any) {
    let newState = OnPlayerEnterAreaTrigger_EnterArea_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerEnterAreaTrigger_EnterArea_Action(eventInfo);
}

function OnPlayerExitAreaTrigger_Exit_Area_Condition(eventInfo: any): boolean {
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

function OnPlayerExitAreaTrigger_Exit_Area_Action(eventInfo: any) {
    DisableOutOfBounds(eventInfo)
}
function OnPlayerExitAreaTrigger_Exit_Area(conditionState: any, eventInfo: any) {
    let newState = OnPlayerExitAreaTrigger_Exit_Area_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerExitAreaTrigger_Exit_Area_Action(eventInfo);
}

function OngoingGlobal_VO_Low_Time_Condition(): boolean {
    const newState = modlib.And(mod.GetVariable(GameOngoingGlobalVar), mod.GetVariable(EnableVOGlobalVar), mod.LessThanEqualTo(mod.GetMatchTimeRemaining(), 300));
    return newState;
}

function OngoingGlobal_VO_Low_Time_Action() {
    mod.PlayVO(mod.GetVariable(VO5GlobalVar), mod.VoiceOverEvents2D.TimeLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
    mod.PlayVO(mod.GetVariable(VO6GlobalVar), mod.VoiceOverEvents2D.TimeLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
}
function OngoingGlobal_VO_Low_Time(conditionState: any) {
    let newState = OngoingGlobal_VO_Low_Time_Condition();
    if (!conditionState.update(newState)) {
        return;
    }
    OngoingGlobal_VO_Low_Time_Action();
}

function OngoingGlobal_VO_Winning_Condition(): boolean {
    const newState = modlib.And(mod.GetVariable(GameOngoingGlobalVar), mod.GetVariable(EnableVOGlobalVar), mod.GreaterThan(
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)),
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar))))
    return newState;
}

function OngoingGlobal_VO_Winning_Action() {
    mod.PlayVO(mod.GetVariable(VO5GlobalVar), mod.VoiceOverEvents2D.ProgressMidWinning, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
    mod.PlayVO(mod.GetVariable(VO6GlobalVar), mod.VoiceOverEvents2D.ProgressMidLosing, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
}
function OngoingGlobal_VO_Winning(conditionState: any) {
    let newState = OngoingGlobal_VO_Winning_Condition();
    if (!conditionState.update(newState)) {
        return;
    }
    OngoingGlobal_VO_Winning_Action();
}

function OngoingGlobal_VO_Winning1_Condition(): boolean {
    const newState = modlib.And(mod.GetVariable(GameOngoingGlobalVar), mod.GetVariable(EnableVOGlobalVar), mod.GreaterThan(
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)),
        mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar))))
    return newState;
}

function OngoingGlobal_VO_Winning1_Action() {
    mod.PlayVO(mod.GetVariable(VO5GlobalVar), mod.VoiceOverEvents2D.ProgressMidWinning, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
    mod.PlayVO(mod.GetVariable(VO6GlobalVar), mod.VoiceOverEvents2D.ProgressMidLosing, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
}
function OngoingGlobal_VO_Winning1(conditionState: any) {
    let newState = OngoingGlobal_VO_Winning1_Condition();
    if (!conditionState.update(newState)) {
        return;
    }
    OngoingGlobal_VO_Winning1_Action();
}

function OngoingGlobal_VO_Low_Tickets_Condition(): boolean {
    const newState = modlib.And(mod.GetVariable(GameOngoingGlobalVar), mod.GetVariable(EnableVOGlobalVar), mod.LessThanEqualTo(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(1), TeamScoreTeamVar)), mod.GetVariable(LowTicketMusicGlobalVar)));
    return newState;
}

function OngoingGlobal_VO_Low_Tickets_Action() {
    mod.PlayVO(mod.GetVariable(VO5GlobalVar), mod.VoiceOverEvents2D.PlayerCountFriendlyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
    mod.PlayVO(mod.GetVariable(VO6GlobalVar), mod.VoiceOverEvents2D.PlayerCountEnemyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
}
function OngoingGlobal_VO_Low_Tickets(conditionState: any) {
    let newState = OngoingGlobal_VO_Low_Tickets_Condition();
    if (!conditionState.update(newState)) {
        return;
    }
    OngoingGlobal_VO_Low_Tickets_Action();
}

function OngoingGlobal_VO_Low_Tickets1_Condition(): boolean {
    const newState = modlib.And(mod.GetVariable(GameOngoingGlobalVar), mod.GetVariable(EnableVOGlobalVar), mod.LessThanEqualTo(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar)), mod.GetVariable(LowTicketMusicGlobalVar)));
    return newState;
}

function OngoingGlobal_VO_Low_Tickets1_Action() {
    mod.PlayVO(mod.GetVariable(VO5GlobalVar), mod.VoiceOverEvents2D.PlayerCountFriendlyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(2))
    mod.PlayVO(mod.GetVariable(VO6GlobalVar), mod.VoiceOverEvents2D.PlayerCountEnemyLow, mod.VoiceOverFlags.Alpha, mod.GetTeam(1))
}
function OngoingGlobal_VO_Low_Tickets1(conditionState: any) {
    let newState = OngoingGlobal_VO_Low_Tickets1_Condition();
    if (!conditionState.update(newState)) {
        return;
    }
    OngoingGlobal_VO_Low_Tickets1_Action();
}

async function OngoingCapturePoint_Capture_Times_Action(eventInfo: any) {
    while (!mod.GetVariable(GameOngoingGlobalVar)) { await mod.Wait(999) }
    if (mod.GetVariable(ConquestAssaultGlobalVar)) {
        mod.SetCapturePointOwner(eventInfo.eventCapturePoint, mod.GetTeam(2))
    }
    await mod.Wait(mod.RandomReal(0, 1))
    mod.SetVariableAtIndex(CapturePointProgressGlobalVar, mod.GetObjId(eventInfo.eventCapturePoint), mod.GetCaptureProgress(eventInfo.eventCapturePoint))
    mod.SetVariableAtIndex(tempGlobalVar, mod.GetObjId(eventInfo.eventCapturePoint), mod.EmptyArray())
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
            CapturePointUI_Manager(eventInfo.eventCapturePoint, mod.ValueInArray(mod.GetVariable(CapturePointProgressGlobalVar), mod.GetObjId(eventInfo.eventCapturePoint)), eventInfo)
        }
        mod.SetVariableAtIndex(CapturePointProgressGlobalVar, mod.GetObjId(eventInfo.eventCapturePoint), mod.GetCaptureProgress(eventInfo.eventCapturePoint))
        await mod.Wait(0.1)
    }
}
function OngoingCapturePoint_Capture_Times(conditionState: any, eventInfo: any) {
    let newState = true;
    if (!conditionState.update(newState)) {
        return;
    }
    OngoingCapturePoint_Capture_Times_Action(eventInfo);
}

function OnPlayerDeployed_AI_Scout_Condition(eventInfo: any): boolean {
    const newState = mod.And(mod.GetVariable(EnableCustomAIGlobalVar), mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier));
    return newState;
}

async function OnPlayerDeployed_AI_Scout_Action(eventInfo: any) {
    await mod.Wait(0.2)
    if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
        mod.SetPlayerIncomingDamageFactor(eventInfo.eventPlayer, 0.5)
        AI_Deploy(eventInfo)
    }
}
function OnPlayerDeployed_AI_Scout(conditionState: any, eventInfo: any) {
    let newState = OnPlayerDeployed_AI_Scout_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerDeployed_AI_Scout_Action(eventInfo);
}

function OnPlayerEnterCapturePoint_AI_Find_New_Objective_Condition(eventInfo: any): boolean {
    const newState = modlib.And(mod.GetVariable(EnableCustomAIGlobalVar), mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier), mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle)));
    return newState;
}

async function OnPlayerEnterCapturePoint_AI_Find_New_Objective_Action(eventInfo: any) {
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
        AI_Scouting(eventInfo.eventPlayer)
    }
}
function OnPlayerEnterCapturePoint_AI_Find_New_Objective(conditionState: any, eventInfo: any) {
    let newState = OnPlayerEnterCapturePoint_AI_Find_New_Objective_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerEnterCapturePoint_AI_Find_New_Objective_Action(eventInfo);
}

function OnPlayerDeployed_AI_Ready_For_Attack_Condition(eventInfo: any): boolean {
    const newState = modlib.And(mod.GetVariable(EnableCustomAIGlobalVar), mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier), mod.LessThanEqualTo(mod.GetVariable(MaxCustomAIGlobalVar), 70));
    return newState;
}

async function OnPlayerDeployed_AI_Ready_For_Attack_Action(eventInfo: any) {
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
                        AI_Scouting(eventInfo.eventPlayer)
                    }
                }
            }
        }
        await mod.Wait(1)
    }
}
function OnPlayerDeployed_AI_Ready_For_Attack(conditionState: any, eventInfo: any) {
    let newState = OnPlayerDeployed_AI_Ready_For_Attack_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerDeployed_AI_Ready_For_Attack_Action(eventInfo);
}

function OnPlayerDamaged_AI_Target_Shooter_Condition(eventInfo: any): boolean {
    const newState = modlib.And(mod.GetVariable(EnableCustomAIGlobalVar), mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier), mod.Not(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_InActionPlayerVar))), mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer)), mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle)));
    return newState;
}

async function OnPlayerDamaged_AI_Target_Shooter_Action(eventInfo: any) {
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_InActionPlayerVar), true)
    mod.AIDefendPositionBehavior(eventInfo.eventPlayer, mod.GetObjectPosition(eventInfo.eventPlayer), 0, 15)
    mod.AISetMoveSpeed(eventInfo.eventPlayer, mod.MoveSpeed.InvestigateRun)
    mod.AISetTarget(eventInfo.eventPlayer, eventInfo.eventOtherPlayer)
    await mod.Wait(10)
    if (mod.IsPlayerValid(eventInfo.eventPlayer)) {
        if (mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_InActionPlayerVar))) {
            AI_Scouting(eventInfo.eventPlayer)
            mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_InActionPlayerVar), false)
        }
    }
}
function OnPlayerDamaged_AI_Target_Shooter(conditionState: any, eventInfo: any) {
    let newState = OnPlayerDamaged_AI_Target_Shooter_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerDamaged_AI_Target_Shooter_Action(eventInfo);
}

function OnPlayerExitVehicle_AI_Exit_Vehicle_Condition(eventInfo: any): boolean {
    const newState = mod.And(mod.GetVariable(EnableCustomAIGlobalVar), mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier));
    return newState;
}

function OnPlayerExitVehicle_AI_Exit_Vehicle_Action(eventInfo: any) {
    AI_Scouting(eventInfo.eventPlayer)
}
function OnPlayerExitVehicle_AI_Exit_Vehicle(conditionState: any, eventInfo: any) {
    let newState = OnPlayerExitVehicle_AI_Exit_Vehicle_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerExitVehicle_AI_Exit_Vehicle_Action(eventInfo);
}

function OnPlayerEnterVehicle_AI_Enter_Vehicle_Condition(eventInfo: any): boolean {
    const newState = mod.And(mod.GetVariable(EnableCustomAIGlobalVar), mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier));
    return newState;
}

async function OnPlayerEnterVehicle_AI_Enter_Vehicle_Action(eventInfo: any) {
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
function OnPlayerEnterVehicle_AI_Enter_Vehicle(conditionState: any, eventInfo: any) {
    let newState = OnPlayerEnterVehicle_AI_Enter_Vehicle_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerEnterVehicle_AI_Enter_Vehicle_Action(eventInfo);
}

function OnAIMoveToFailed_AI_Retry_Move_Condition(eventInfo: any): boolean {
    const newState = mod.And(mod.GetVariable(EnableCustomAIGlobalVar), mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier));
    return newState;
}

function OnAIMoveToFailed_AI_Retry_Move_Action(eventInfo: any) {
    AI_Scouting(eventInfo.eventPlayer)
}
function OnAIMoveToFailed_AI_Retry_Move(conditionState: any, eventInfo: any) {
    let newState = OnAIMoveToFailed_AI_Retry_Move_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnAIMoveToFailed_AI_Retry_Move_Action(eventInfo);
}

function OnPlayerEarnedKill_AI_Target_Shooter_Condition(eventInfo: any): boolean {
    const newState = modlib.And(mod.GetVariable(EnableCustomAIGlobalVar), mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier), mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle)));
    return newState;
}

function OnPlayerEarnedKill_AI_Target_Shooter_Action(eventInfo: any) {
    AI_Scouting(eventInfo.eventPlayer)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_InActionPlayerVar), false)
}
function OnPlayerEarnedKill_AI_Target_Shooter(conditionState: any, eventInfo: any) {
    let newState = OnPlayerEarnedKill_AI_Target_Shooter_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerEarnedKill_AI_Target_Shooter_Action(eventInfo);
}

function OnPlayerEarnedKillAssist_AI_Target_Shooter_Condition(eventInfo: any): boolean {
    const newState = modlib.And(mod.GetVariable(EnableCustomAIGlobalVar), mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAISoldier), mod.NotEqualTo(mod.GetTeam(eventInfo.eventPlayer), mod.GetTeam(eventInfo.eventOtherPlayer)), mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle)));
    return newState;
}

function OnPlayerEarnedKillAssist_AI_Target_Shooter_Action(eventInfo: any) {
    AI_Scouting(eventInfo.eventPlayer)
    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_InActionPlayerVar), false)
}
function OnPlayerEarnedKillAssist_AI_Target_Shooter(conditionState: any, eventInfo: any) {
    let newState = OnPlayerEarnedKillAssist_AI_Target_Shooter_Condition(eventInfo);
    if (!conditionState.update(newState)) {
        return;
    }
    OnPlayerEarnedKillAssist_AI_Target_Shooter_Action(eventInfo);
}

function Scoreboard() {


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
function UpdatePlayerScoreboard(Player: any) {


    mod.SetScoreboardPlayerValues(Player, mod.GetVariable(mod.ObjectVariable(Player, ScorePlayerVar)), mod.GetVariable(mod.ObjectVariable(Player, PlayerKillsPlayerVar)), mod.GetVariable(mod.ObjectVariable(Player, PlayerDeathsPlayerVar)), mod.GetVariable(mod.ObjectVariable(Player, KillAssistsPlayerVar)), mod.GetVariable(mod.ObjectVariable(Player, CapturesPlayerVar)))
}
function CapturePointSetup(Objective: any) {


    mod.SetCapturePointCapturingTime(Objective, mod.GetVariable(FlagCaptureTimeGlobalVar))
    mod.SetCapturePointNeutralizationTime(Objective, mod.GetVariable(FlagNeutralTimeGlobalVar))
    mod.EnableGameModeObjective(Objective, true)
    mod.SetMaxCaptureMultiplier(Objective, 3)
}
function ObjectiveVehicleSpawn(eventInfo: any) {


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
function ObjectiveCapturedPlayerData(Player: any) {


    mod.SetVariable(mod.ObjectVariable(Player, CapturesPlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(Player, CapturesPlayerVar)),
        1))
    mod.SetVariable(mod.ObjectVariable(Player, ScorePlayerVar), mod.Add(
        mod.GetVariable(mod.ObjectVariable(Player, ScorePlayerVar)),
        50))
    UpdatePlayerScoreboard(Player)
    mod.PlaySound(mod.GetVariable(CapturedSoundGlobalVar), 0.7, Player)
}
function AppendToArray(Value: string) {


    mod.SetVariable(AppendGlobalVar, mod.AppendToArray(mod.GetVariable(AppendGlobalVar), Value))
}
function UniquePlayerUI1() {


    mod.SetVariable(ID_PoolGlobalVar, mod.EmptyArray())
    mod.SetVariable(AppendGlobalVar, mod.EmptyArray())
    AppendToArray("1")
    AppendToArray("2")
    AppendToArray("3")
    AppendToArray("4")
    AppendToArray("5")
    AppendToArray("6")
    AppendToArray("7")
    AppendToArray("8")
    AppendToArray("9")
    AppendToArray("10")
    AppendToArray("11")
    AppendToArray("12")
    AppendToArray("13")
    AppendToArray("14")
    AppendToArray("15")
    AppendToArray("16")
    AppendToArray("17")
    AppendToArray("18")
    AppendToArray("19")
    AppendToArray("20")
    AppendToArray("21")
    AppendToArray("22")
    AppendToArray("23")
    AppendToArray("24")
    AppendToArray("25")
    AppendToArray("26")
    AppendToArray("27")
    AppendToArray("28")
    AppendToArray("29")
    AppendToArray("30")
    AppendToArray("31")
    AppendToArray("32")
    AppendToArray("33")
    AppendToArray("34")
    AppendToArray("35")
    AppendToArray("36")
    AppendToArray("37")
    AppendToArray("38")
    AppendToArray("39")
    AppendToArray("40")
    AppendToArray("41")
    AppendToArray("42")
    AppendToArray("43")
    AppendToArray("44")
    AppendToArray("45")
    AppendToArray("46")
    AppendToArray("47")
    AppendToArray("48")
    AppendToArray("49")
    AppendToArray("50")
    AppendToArray("51")
    AppendToArray("52")
    AppendToArray("53")
    AppendToArray("54")
    AppendToArray("55")
    AppendToArray("56")
    AppendToArray("57")
    AppendToArray("58")
    AppendToArray("59")
    AppendToArray("60")
    AppendToArray("61")
    AppendToArray("62")
    AppendToArray("63")
    AppendToArray("64")
    AppendToArray("65")
    AppendToArray("66")
    AppendToArray("67")
    AppendToArray("68")
    AppendToArray("70")
    AppendToArray("71")
    AppendToArray("72")
    AppendToArray("73")
    AppendToArray("74")
    AppendToArray("75")
    AppendToArray("76")
    AppendToArray("77")
    AppendToArray("78")
    AppendToArray("79")
    AppendToArray("80")
    AppendToArray("81")
    AppendToArray("82")
    AppendToArray("83")
    AppendToArray("84")
    AppendToArray("85")
    AppendToArray("86")
    AppendToArray("87")
    AppendToArray("106")
    AppendToArray("89")
    AppendToArray("90")
    AppendToArray("91")
    AppendToArray("92")
    AppendToArray("93")
    AppendToArray("94")
    AppendToArray("95")
    AppendToArray("96")
    AppendToArray("97")
    AppendToArray("98")
    AppendToArray("99")
    AppendToArray("100")
    AppendToArray("101")
    AppendToArray("102")
    AppendToArray("103")
    AppendToArray("104")
    AppendToArray("105")
    mod.SetVariable(ID_PoolGlobalVar, mod.GetVariable(AppendGlobalVar))
}
function ObjectiveUI(Label: string, eventInfo: any) {


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
function MainUI_ScoreandTime() {


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
    UI_ScoreSetup("Team1ScoreLeft", "Team1ScoreRight", "Team1LeftBar", "Team1RightBar", mod.GetTeam(1))
    UI_ScoreSetup("Team2ScoreLeft", "Team2ScoreRight", "Team2LeftBar", "Team2RightBar", mod.GetTeam(2))
    for (let iteratorVar = 0; iteratorVar < mod.CountOf(mod.AllCapturePoints()); iteratorVar += 1) {
        mod.SetVariable(iteratorGlobalVar, iteratorVar);
        mod.AddUIText(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.GetVariable(iteratorGlobalVar)), mod.CreateVector(mod.Multiply(mod.Subtract(
            mod.GetVariable(iteratorGlobalVar),
            mod.Divide(
                mod.Subtract(
                    mod.CountOf(mod.AllCapturePoints()),
                    1),
                2)), 50), 90, 0), mod.CreateVector(30, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Blur, mod.Message(mod.ValueInArray(mod.GetVariable(FlagLettersGlobalVar), mod.GetVariable(iteratorGlobalVar))), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(1))
        mod.AddUIText(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
            52,
            mod.GetVariable(iteratorGlobalVar))), mod.CreateVector(mod.Multiply(mod.Subtract(
                mod.GetVariable(iteratorGlobalVar),
                mod.Divide(
                    mod.Subtract(
                        mod.CountOf(mod.AllCapturePoints()),
                        1),
                    2)), 50), 90, 0), mod.CreateVector(30, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.OutlineThin, mod.Message(""), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(1))
        mod.AddUIText(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
            26,
            mod.GetVariable(iteratorGlobalVar))), mod.CreateVector(mod.Multiply(mod.Subtract(
                mod.GetVariable(iteratorGlobalVar),
                mod.Divide(
                    mod.Subtract(
                        mod.CountOf(mod.AllCapturePoints()),
                        1),
                    2)), 50), 90, 0), mod.CreateVector(30, 30, 0), mod.UIAnchor.TopCenter, mod.FindUIWidgetWithName("container"), true, 0, mod.CreateVector(0, 0, 0), 0.8, mod.UIBgFill.Blur, mod.Message(mod.ValueInArray(mod.GetVariable(FlagLettersGlobalVar), mod.GetVariable(iteratorGlobalVar))), 24, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI, mod.GetTeam(2))
        mod.AddUIText(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
            78,
            mod.GetVariable(iteratorGlobalVar))), mod.CreateVector(mod.Multiply(mod.Subtract(
                mod.GetVariable(iteratorGlobalVar),
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
function EndGame_UI(UI: string, Position: any) {


    mod.SetUIWidgetSize(mod.FindUIWidgetWithName(UI), mod.CreateVector(160, 70, 0))
    mod.SetUITextSize(mod.FindUIWidgetWithName(UI), 64)
    mod.SetUIWidgetPosition(mod.FindUIWidgetWithName(UI), Position)
}
function UI_ScoreSetup(LeftScore: string, RightScore: string, LeftBar: string, RightBar: string, Team: any) {


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
function ObjectiveLetters() {


    mod.SetVariable(FlagLettersGlobalVar, mod.EmptyArray())
    mod.SetVariable(AppendGlobalVar, mod.EmptyArray())
    AppendToArray("A")
    AppendToArray("B")
    AppendToArray("C")
    AppendToArray("D")
    AppendToArray("E")
    AppendToArray("F")
    AppendToArray("G")
    AppendToArray("H")
    AppendToArray("I")
    AppendToArray("J")
    AppendToArray("K")
    AppendToArray("L")
    AppendToArray("M")
    AppendToArray("N")
    AppendToArray("O")
    AppendToArray("P")
    AppendToArray("Q")
    AppendToArray("R")
    AppendToArray("S")
    AppendToArray("T")
    AppendToArray("U")
    AppendToArray("V")
    AppendToArray("W")
    AppendToArray("X")
    AppendToArray("Y")
    AppendToArray("Z")
    mod.SetVariable(FlagLettersGlobalVar, mod.GetVariable(AppendGlobalVar))
}
function ObjectiveTeamUI_Array() {


    mod.SetVariable(ObjectiveTrackingUIGlobalVar, mod.EmptyArray())
    mod.SetVariable(AppendGlobalVar, mod.EmptyArray())
    AppendToArray("A1")
    AppendToArray("B1")
    AppendToArray("C1")
    AppendToArray("D1")
    AppendToArray("E1")
    AppendToArray("F1")
    AppendToArray("G1")
    AppendToArray("H1")
    AppendToArray("I1")
    AppendToArray("J1")
    AppendToArray("K1")
    AppendToArray("L1")
    AppendToArray("M1")
    AppendToArray("N1")
    AppendToArray("O1")
    AppendToArray("P1")
    AppendToArray("Q1")
    AppendToArray("R1")
    AppendToArray("S1")
    AppendToArray("T1")
    AppendToArray("U1")
    AppendToArray("V1")
    AppendToArray("W1")
    AppendToArray("X1")
    AppendToArray("Y1")
    AppendToArray("Z1")
    AppendToArray("A2")
    AppendToArray("B2")
    AppendToArray("C2")
    AppendToArray("D2")
    AppendToArray("E2")
    AppendToArray("F2")
    AppendToArray("G2")
    AppendToArray("H2")
    AppendToArray("I2")
    AppendToArray("J2")
    AppendToArray("K2")
    AppendToArray("L2")
    AppendToArray("M2")
    AppendToArray("N2")
    AppendToArray("O2")
    AppendToArray("P2")
    AppendToArray("Q2")
    AppendToArray("R2")
    AppendToArray("S2")
    AppendToArray("T2")
    AppendToArray("U2")
    AppendToArray("V2")
    AppendToArray("W2")
    AppendToArray("X2")
    AppendToArray("Y2")
    AppendToArray("Z2")
    AppendToArray("A3")
    AppendToArray("B3")
    AppendToArray("C3")
    AppendToArray("D3")
    AppendToArray("E3")
    AppendToArray("F3")
    AppendToArray("G3")
    AppendToArray("H3")
    AppendToArray("I3")
    AppendToArray("J3")
    AppendToArray("K3")
    AppendToArray("L3")
    AppendToArray("M3")
    AppendToArray("N3")
    AppendToArray("O3")
    AppendToArray("P3")
    AppendToArray("Q3")
    AppendToArray("R3")
    AppendToArray("S3")
    AppendToArray("T3")
    AppendToArray("U3")
    AppendToArray("V3")
    AppendToArray("W3")
    AppendToArray("X3")
    AppendToArray("Y3")
    AppendToArray("Z3")
    AppendToArray("A4")
    AppendToArray("B4")
    AppendToArray("C4")
    AppendToArray("D4")
    AppendToArray("E4")
    AppendToArray("F4")
    AppendToArray("G4")
    AppendToArray("H4")
    AppendToArray("I4")
    AppendToArray("J4")
    AppendToArray("K4")
    AppendToArray("L4")
    AppendToArray("M4")
    AppendToArray("N4")
    AppendToArray("O4")
    AppendToArray("P4")
    AppendToArray("Q4")
    AppendToArray("R4")
    AppendToArray("S4")
    AppendToArray("T4")
    AppendToArray("U4")
    AppendToArray("V4")
    AppendToArray("W4")
    AppendToArray("X4")
    AppendToArray("Y4")
    AppendToArray("Z4")
    mod.SetVariable(ObjectiveTrackingUIGlobalVar, mod.GetVariable(AppendGlobalVar))
}
function Add_AI() {


    if (mod.GetVariable(EnableCustomAIGlobalVar)) {
        if (mod.LessThan(
            mod.CountOf(mod.AllPlayers()),
            mod.GetVariable(MaxCustomAIGlobalVar))) {
            if (mod.GreaterThan(
                mod.CountOf(modlib.FilteredArray(
                    mod.AllPlayers(),
                    (currentArrayElement: any) => mod.Equals(
                        mod.GetTeam(currentArrayElement),
                        mod.GetTeam(1)))),
                mod.CountOf(modlib.FilteredArray(
                    mod.AllPlayers(),
                    (currentArrayElement: any) => mod.Equals(
                        mod.GetTeam(currentArrayElement),
                        mod.GetTeam(2)))))) {
                mod.SpawnAIFromAISpawner(mod.GetSpawner(902), mod.Message(mod.ValueInArray(mod.GetVariable(BotNamesGlobalVar), mod.GetVariable(nameIndexGlobalVar))), mod.GetTeam(2))
            } else {
                mod.SpawnAIFromAISpawner(mod.GetSpawner(901), mod.Message(mod.ValueInArray(mod.GetVariable(BotNamesGlobalVar), mod.GetVariable(nameIndexGlobalVar))), mod.GetTeam(1))
            }
            mod.SetVariable(nameIndexGlobalVar, mod.Add(
                mod.GetVariable(nameIndexGlobalVar),
                1))
            if (mod.Equals(
                mod.GetVariable(nameIndexGlobalVar),
                mod.CountOf(mod.GetVariable(BotNamesGlobalVar)))) {
                mod.SetVariable(nameIndexGlobalVar, 0)
            }
        } else {
        }
    }
}
function AddBotNames() {


    mod.SetVariable(BotNamesGlobalVar, mod.EmptyArray())
    mod.SetVariable(AppendGlobalVar, mod.EmptyArray())
    AppendToArray("andy6170 (Bot)")
    AppendToArray("TheOzzy (Bot)")
    AppendToArray("Mancour (Bot)")
    AppendToArray("gala_vs (Bot)")
    AppendToArray("BattlefieldDad (Bot)")
    AppendToArray("Matavatar (Bot)")
    AppendToArray("ToughKarma (Bot)")
    AppendToArray("extermin8or_ (Bot)")
    AppendToArray("Draco25240 (Bot)")
    AppendToArray("CodeName_Deus (Bot)")
    AppendToArray("TonisGaming (Bot)")
    AppendToArray("SCKGaming (Bot)")
    AppendToArray("HybridBeard0 (Bot)")
    AppendToArray("ClaraTheRed (Bot)")
    AppendToArray("PrincessTeacup (Bot)")
    AppendToArray("Haze (Bot)")
    AppendToArray("Renette (Bot)")
    AppendToArray("BT Zero (Bot)")
    AppendToArray("Thirsty Wizard (Bot)")
    AppendToArray("SwarmFly (Bot)")
    AppendToArray("Sheer Iceman (Bot)")
    AppendToArray("Daniel VNZ (Bot)")
    AppendToArray("Languorian (Bot)")
    AppendToArray("zbmts (Bot)")
    AppendToArray("Joshua (Bot)")
    AppendToArray("Richard (Bot)")
    AppendToArray("Dirteebreaks (Bot)")
    AppendToArray("Mystfit (Bot)")
    AppendToArray("Shorty (Bot)")
    AppendToArray("tango (Bot)")
    AppendToArray("Beam (Bot)")
    AppendToArray("C¥pher (Bot)")
    AppendToArray("ThirdEyeAgent (Bot)")
    AppendToArray("floris12fs (Bot)")
    AppendToArray("oleole56 (Bot)")
    AppendToArray("LadyArsenic (Bot)")
    AppendToArray("Akira72 (Bot)")
    AppendToArray("KieranP (Bot)")
    AppendToArray("warcreator (Bot)")
    AppendToArray("Cytochrome2 (Bot)")
    AppendToArray("LT D.A.L.E. (Bot)")
    AppendToArray("Kale (Bot)")
    AppendToArray("OutlawSkot33 (Bot)")
    AppendToArray("F4rus (Bot)")
    AppendToArray("TabbedScamper (Bot)")
    AppendToArray("reni2 (Bot)")
    AppendToArray("AP_Atipoya (Bot)")
    AppendToArray("m1kedeluca_ (Bot)")
    AppendToArray("Ariistuujj (Bot)")
    AppendToArray("Marcus (DJsparco) (Bot)")
    AppendToArray("Hope (Bot)")
    AppendToArray("pompom (Bot)")
    AppendToArray("mindflexor (Bot)")
    AppendToArray("Robert5974 (Bot)")
    AppendToArray("Ricelletis (Bot)")
    AppendToArray("cczzcx (Bot)")
    AppendToArray("Fobia_BGa (Bot)")
    AppendToArray("Nodone (Bot)")
    AppendToArray("Crush (Bot)")
    AppendToArray("EIGuimaraes (Bot)")
    AppendToArray("Bennen (Bot)")
    AppendToArray("Mary (Bot)")
    AppendToArray("dzonzla_ (Bot)")
    AppendToArray("L0gan-M-Sc0tt (Bot)")
    AppendToArray("FaithWalker (Bot)")
    AppendToArray("SgtHamster (Bot)")
    AppendToArray("LoganTheBrawler (Bot)")
    mod.SetVariable(BotNamesGlobalVar, mod.GetVariable(AppendGlobalVar))
}
function AI_ObjectiveSpawn(eventInfo: any) {


    if (mod.Not(mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsInVehicle))) {
        mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_SpawnPlayerVar), mod.EmptyArray())
        mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_SpawnPlayerVar), modlib.FilteredArray(
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
                AI_DeployVehicle(mod.RandomValueInArray(modlib.FilteredArray(
                    mod.AllVehicles(),
                    (currentArrayElement: any) => mod.LessThan(
                        mod.CountOf(mod.GetAllPlayersInVehicle(currentArrayElement)),
                        2))), 60, eventInfo)
            }
            if (mod.LessThan(
                mod.RoundToInteger(mod.RandomReal(0, 5)),
                5)) {
                mod.Teleport(eventInfo.eventPlayer, mod.GetObjectPosition(mod.RandomValueInArray(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, AI_SpawnPlayerVar)))), 1)
                AI_DeployVehicle(mod.RandomValueInArray(modlib.FilteredArray(
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
function FlagCalls() {


    mod.SetVariable(FlagAnnounceGlobalVar, mod.EmptyArray())
    mod.SetVariable(FlagAnnounceGlobalVar, mod.AppendToArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.VoiceOverFlags.Alpha))
    mod.SetVariable(FlagAnnounceGlobalVar, mod.AppendToArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.VoiceOverFlags.Bravo))
    mod.SetVariable(FlagAnnounceGlobalVar, mod.AppendToArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.VoiceOverFlags.Charlie))
    mod.SetVariable(FlagAnnounceGlobalVar, mod.AppendToArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.VoiceOverFlags.Delta))
    mod.SetVariable(FlagAnnounceGlobalVar, mod.AppendToArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.VoiceOverFlags.Echo))
    mod.SetVariable(FlagAnnounceGlobalVar, mod.AppendToArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.VoiceOverFlags.Foxtrot))
    mod.SetVariable(FlagAnnounceGlobalVar, mod.AppendToArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.VoiceOverFlags.Golf))
    mod.SetVariable(FlagAnnounceGlobalVar, mod.AppendToArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.VoiceOverFlags.Hotel))
    mod.SetVariable(FlagAnnounceGlobalVar, mod.AppendToArray(mod.GetVariable(FlagAnnounceGlobalVar), mod.VoiceOverFlags.India))
}
async function UIFlashAnimation(Team1UI: string, Team2UI: string) {


    mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(Team1UI), 1)
    mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(Team2UI), 1)
    for (let iterator2Var = 10; iterator2Var < 100; iterator2Var += 10) {
        mod.SetVariable(iterator2GlobalVar, iterator2Var);
        mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(Team1UI), mod.Subtract(
            1,
            mod.Divide(
                mod.GetVariable(iterator2GlobalVar),
                100)))
        mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(Team2UI), mod.Subtract(
            1,
            mod.Divide(
                mod.GetVariable(iterator2GlobalVar),
                100)))
        await mod.Wait(0.033)
    }
    mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(Team1UI), 0)
    mod.SetUIWidgetBgAlpha(mod.FindUIWidgetWithName(Team2UI), 0)
}
async function OutOfBounds(eventInfo: any) {

    const newState = modlib.And(mod.Not(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, IgnoreOOBPlayerVar))), mod.Not(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar))), mod.GetSoldierState(eventInfo.eventPlayer, mod.SoldierStateBool.IsAlive));
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
        PlayerOOBToggleIUI(true, eventInfo)
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
        PlayerOOBToggleIUI(false, eventInfo)
        mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, CaptureTickPlayerVar), -1)
    }
}
function DisableOutOfBounds(eventInfo: any) {

    const newState = mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar));
    return newState;

    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, OutOfBoundsPlayerVar), false)
    mod.SkipManDown(eventInfo.eventPlayer, false)
}
function AI_DeployVehicle(Vehicle: any, Distance: number, eventInfo: any) {

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
function AI_Scouting(Player: any) {

    const newState = modlib.And(mod.IsPlayerValid(Player), mod.GetSoldierState(Player, mod.SoldierStateBool.IsAlive), mod.Not(mod.GetSoldierState(Player, mod.SoldierStateBool.IsInVehicle)));
    return newState;

    if (mod.Equals(
        mod.CountOf(modlib.FilteredArray(
            mod.AllCapturePoints(),
            (currentArrayElement: any) => mod.NotEqualTo(mod.GetTeam(Player), mod.GetCurrentOwnerTeam(currentArrayElement)))),
        0)) {
        mod.SetVariable(mod.ObjectVariable(Player, AI_TargetPlayerVar), mod.RandomValueInArray(modlib.FilteredArray(
            mod.AllCapturePoints(),
            (currentArrayElement: any) => mod.Equals(
                mod.GetTeam(Player),
                mod.GetCurrentOwnerTeam(currentArrayElement)))))
        mod.AIDefendPositionBehavior(Player, mod.GetObjectPosition(mod.GetVariable(mod.ObjectVariable(Player, AI_TargetPlayerVar))), 0, 30)
    } else {
        mod.SetVariable(mod.ObjectVariable(Player, AI_TargetPlayerVar), mod.RandomValueInArray(modlib.FilteredArray(
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
function FlagIconsUpdate() {


    for (let iteratorVar = 0; iteratorVar < mod.CountOf(mod.AllCapturePoints()); iteratorVar += 1) {
        mod.SetVariable(iteratorGlobalVar, iteratorVar);
        if (mod.Equals(
            mod.GetCurrentOwnerTeam(mod.GetCapturePoint(mod.Add(
                200,
                mod.GetVariable(iteratorGlobalVar)))),
            mod.GetTeam(1))) {
            mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.GetVariable(iteratorGlobalVar))), mod.GetVariable(FriendlyTextColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.GetVariable(iteratorGlobalVar))), mod.GetVariable(FriendlyBGColourGlobalVar))
            mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                mod.GetVariable(iteratorGlobalVar),
                26))), mod.GetVariable(EnemyTextColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                mod.GetVariable(iteratorGlobalVar),
                26))), mod.GetVariable(EnemyBGColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                mod.GetVariable(iteratorGlobalVar),
                52))), mod.GetVariable(FriendlyTextColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                mod.GetVariable(iteratorGlobalVar),
                78))), mod.GetVariable(EnemyTextColourGlobalVar))
        } else if (mod.Equals(
            mod.GetCurrentOwnerTeam(mod.GetCapturePoint(mod.Add(
                200,
                mod.GetVariable(iteratorGlobalVar)))),
            mod.GetTeam(2))) {
            mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.GetVariable(iteratorGlobalVar))), mod.GetVariable(EnemyTextColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.GetVariable(iteratorGlobalVar))), mod.GetVariable(EnemyBGColourGlobalVar))
            mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                mod.GetVariable(iteratorGlobalVar),
                26))), mod.GetVariable(FriendlyTextColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                mod.GetVariable(iteratorGlobalVar),
                26))), mod.GetVariable(FriendlyBGColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                mod.GetVariable(iteratorGlobalVar),
                52))), mod.GetVariable(EnemyTextColourGlobalVar))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                mod.GetVariable(iteratorGlobalVar),
                78))), mod.GetVariable(FriendlyTextColourGlobalVar))
        } else {
            mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.GetVariable(iteratorGlobalVar))), mod.CreateVector(0.9, 0.9, 0.9))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.GetVariable(iteratorGlobalVar))), mod.CreateVector(0, 0, 0))
            mod.SetUITextColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                mod.GetVariable(iteratorGlobalVar),
                26))), mod.CreateVector(0.9, 0.9, 0.9))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                mod.GetVariable(iteratorGlobalVar),
                26))), mod.CreateVector(0, 0, 0))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                mod.GetVariable(iteratorGlobalVar),
                52))), mod.CreateVector(0.9, 0.9, 0.9))
            mod.SetUIWidgetBgColor(mod.FindUIWidgetWithName(mod.ValueInArray(mod.GetVariable(ObjectiveTrackingUIGlobalVar), mod.Add(
                mod.GetVariable(iteratorGlobalVar),
                78))), mod.CreateVector(0.9, 0.9, 0.9))
        }
    }
}
function Version() {


    mod.AddUIText("ver", mod.CreateVector(10, 2, 0), mod.CreateVector(300, 30, 0), mod.UIAnchor.BottomLeft, mod.GetUIRoot(), true, 0, mod.CreateVector(0, 0, 0), 1, mod.UIBgFill.None, mod.Message("ViperStudiosAndy | andy6170 | Conquest Template V10"), 12, mod.CreateVector(1, 1, 1), 0.3, mod.UIAnchor.Center, mod.UIDepth.AboveGameUI)
}
function PlayerCapturepointUI(eventInfo: any) {


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
    ObjectiveUI(mod.ValueInArray(mod.GetVariable(mod.ObjectVariable(mod.GetTeam(eventInfo.eventPlayer), Cap_MessageTeamVar)), mod.GetObjId(eventInfo.eventCapturePoint)), eventInfo)
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
function PlayerCapturepointUIToggle(Enable: boolean, eventInfo: any) {


    mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("ObjText", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), Enable)
    mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("ObjCounter", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), Enable)
    mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("ObjProgress", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), Enable)
    mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("ObjProgressBG", mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))), Enable)
}
function PlayerUISetup(eventInfo: any) {


    mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar), mod.ValueInArray(mod.GetVariable(ID_PoolGlobalVar), 0))
    if (modlib.IsTrueForAny(
        mod.GetVariable(UniqueUI_ID_UsedGlobalVar),
        (currentArrayElement: any) => mod.Equals(
            currentArrayElement,
            mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))))) {
        mod.DeleteUIWidget(mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))))
        mod.SetVariable(UniqueUI_ID_UsedGlobalVar, modlib.FilteredArray(
            mod.GetVariable(UniqueUI_ID_UsedGlobalVar),
            (currentArrayElement: any) => mod.NotEqualTo(currentArrayElement, mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))))
    }
    mod.SetVariable(ID_PoolGlobalVar, modlib.FilteredArray(
        mod.GetVariable(ID_PoolGlobalVar),
        (currentArrayElement: any) => mod.NotEqualTo(currentArrayElement, mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)))))
    mod.SetVariable(UniqueUI_ID_UsedGlobalVar, mod.AppendToArray(mod.GetVariable(UniqueUI_ID_UsedGlobalVar), mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))))
    mod.AddUIContainer(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar)), mod.CreateVector(0, 0, 0), mod.CreateVector(10000, 10000, 0), mod.UIAnchor.TopCenter, eventInfo.eventPlayer)
    mod.SetUIWidgetBgFill(mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))), mod.UIBgFill.None)
    mod.SetUIWidgetDepth(mod.FindUIWidgetWithName(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, UniqueIDPlayerVar))), mod.UIDepth.AboveGameUI)
    if (mod.LessThanEqualTo(mod.CountOf(mod.GetVariable(ID_PoolGlobalVar)), 1)) {
        UniquePlayerUI1()
        for (let iterator4Var = 0; iterator4Var < mod.CountOf(mod.AllPlayers()); iterator4Var += 1) {
            mod.SetVariable(iterator4GlobalVar, iterator4Var);
            mod.SetVariable(ID_PoolGlobalVar, modlib.FilteredArray(
                mod.GetVariable(ID_PoolGlobalVar),
                (currentArrayElement: any) => mod.NotEqualTo(currentArrayElement, mod.GetVariable(mod.ObjectVariable(mod.ValueInArray(mod.AllPlayers(), mod.GetVariable(iterator4GlobalVar)), UniqueIDPlayerVar)))))
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
function CapturePointUI_Manager(Flag: any, OldProggress: number, eventInfo: any) {


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
async function RepelLogic(Time: number, eventInfo: any) {


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
async function FX_Reset(eventInfo: any) {


    while (mod.GetVariable(FX_ResetingGlobalVar)) {
        await mod.Wait(1)
    }
    mod.SetVariable(FX_ResetingGlobalVar, true)
    for (let iteratorVar = 2000; iteratorVar < 2999; iteratorVar += 1) {
        mod.SetVariable(mod.ObjectVariable(eventInfo.eventPlayer, iteratorPlayerVar), iteratorVar);
        mod.EnableVFX(mod.GetVFX(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, iteratorPlayerVar))), false)
        mod.EnableVFX(mod.GetVFX(mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, iteratorPlayerVar))), true)
        if (mod.Equals(
            mod.RoundToInteger(mod.Modulo(
                mod.GetVariable(mod.ObjectVariable(eventInfo.eventPlayer, iteratorPlayerVar)),
                5)),
            0)) {
            await mod.Wait(0.066)
        }
    }
    mod.SetVariable(FX_ResetingGlobalVar, false)
}
async function AI_Deploy(eventInfo: any) {


    AI_ObjectiveSpawn(eventInfo)
    await mod.Wait(0.2)
    if (mod.Equals(
        mod.RoundToInteger(mod.RandomReal(0, 1)),
        0)) {
        AI_DeployVehicle(mod.RandomValueInArray(modlib.FilteredArray(
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
    AI_Scouting(eventInfo.eventPlayer)
}
function ConquestAssaultWinCheck() {

    const newState = modlib.And(mod.GetVariable(ConquestAssaultGlobalVar), mod.GreaterThan(
        mod.GetMatchTimeElapsed(),
        10), mod.Equals(
            mod.CountOf(modlib.FilteredArray(
                mod.AllCapturePoints(),
                (currentArrayElement: any) => mod.NotEqualTo(mod.GetTeam(2), mod.GetCurrentOwnerTeam(currentArrayElement)))),
            0), mod.Equals(
                mod.CountOf(modlib.FilteredArray(
                    mod.AllPlayers(),
                    (currentArrayElement: any) => mod.NotEqualTo(mod.Equals(
                        mod.GetTeam(2),
                        mod.GetTeam(currentArrayElement)), mod.GetSoldierState(currentArrayElement, mod.SoldierStateBool.IsAlive)))),
                0))
    return newState;

    mod.SetVariable(mod.ObjectVariable(mod.GetTeam(2), TeamScoreTeamVar), 0)
}
function PlayerOOBToggleIUI(Enable: boolean, eventInfo: any) {


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
const FX_ResetingGlobalVar = mod.GlobalVariable(17)
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
    const eventInfo = {};
    let eventNum = 0;
    OngoingGlobal_Initialise(modlib.getGlobalCondition(eventNum++));
    OngoingGlobal_Update_Score_and_Time(modlib.getGlobalCondition(eventNum++));
    OngoingGlobal_Update_Score_and_Time1(modlib.getGlobalCondition(eventNum++));
    OngoingGlobal_Score_tracker(modlib.getGlobalCondition(eventNum++));
    OngoingGlobal_Near_End_Music_Trigger(modlib.getGlobalCondition(eventNum++));
    OngoingGlobal_End_Game(modlib.getGlobalCondition(eventNum++));
    OngoingGlobal_VO_Low_Time(modlib.getGlobalCondition(eventNum++));
    OngoingGlobal_VO_Winning(modlib.getGlobalCondition(eventNum++));
    OngoingGlobal_VO_Winning1(modlib.getGlobalCondition(eventNum++));
    OngoingGlobal_VO_Low_Tickets(modlib.getGlobalCondition(eventNum++));
    OngoingGlobal_VO_Low_Tickets1(modlib.getGlobalCondition(eventNum++));
}

export function OnGameModeStarted() {
    const eventInfo = {};
    let eventNum = 11;
    OnGameModeStarted_MapSetup(modlib.getGlobalCondition(eventNum++));
}

export function OnPlayerEarnedKill(eventPlayer: mod.Player, eventOtherPlayer: mod.Player, eventDeathType: mod.DeathType, eventWeaponUnlock: mod.WeaponUnlock) {
    const eventInfo = { eventPlayer, eventOtherPlayer, eventDeathType, eventWeaponUnlock };
    let eventNum = 0;
    OnPlayerEarnedKill_Ean_Kill(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
    OnPlayerEarnedKill_AI_Target_Shooter(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerEarnedKillAssist(eventPlayer: mod.Player, eventOtherPlayer: mod.Player) {
    const eventInfo = { eventPlayer, eventOtherPlayer };
    let eventNum = 2;
    OnPlayerEarnedKillAssist_Kill_assist(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
    OnPlayerEarnedKillAssist_AI_Target_Shooter(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnRevived(eventPlayer: mod.Player, eventOtherPlayer: mod.Player) {
    const eventInfo = { eventPlayer, eventOtherPlayer };
    let eventNum = 4;
    OnRevived_Revive_Counter(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
    OnRevived_Update_Player_Count_When_Revived(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerDied(eventPlayer: mod.Player, eventOtherPlayer: mod.Player, eventDeathType: mod.DeathType, eventWeaponUnlock: mod.WeaponUnlock) {
    const eventInfo = { eventPlayer, eventOtherPlayer, eventDeathType, eventWeaponUnlock };
    let eventNum = 6;
    OnPlayerDied_CustomAI_Score_Tracking(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
    OnPlayerDied_Update_Player_Count_On_Death(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerDeployed(eventPlayer: mod.Player) {
    const eventInfo = { eventPlayer };
    let eventNum = 8;
    OnPlayerDeployed_Add_Equipment(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
    OnPlayerDeployed_AI_Scout(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
    OnPlayerDeployed_AI_Ready_For_Attack(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerJoinGame(eventPlayer: mod.Player) {
    const eventInfo = { eventPlayer };
    let eventNum = 11;
    OnPlayerJoinGame_Sets_Scoreboard(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerUndeploy(eventPlayer: mod.Player) {
    const eventInfo = { eventPlayer };
    let eventNum = 12;
    OnPlayerUndeploy_Death_Update(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnCapturePointCaptured(eventCapturePoint: mod.CapturePoint) {
    const eventInfo = { eventCapturePoint };
    let eventNum = 0;
    OnCapturePointCaptured_On_Capture(modlib.getCapturePointCondition(eventCapturePoint, eventNum++), eventInfo);
}

export function OnCapturePointCapturing(eventCapturePoint: mod.CapturePoint) {
    const eventInfo = { eventCapturePoint };
    let eventNum = 1;
    OnCapturePointCapturing_Notify_Capture(modlib.getCapturePointCondition(eventCapturePoint, eventNum++), eventInfo);
}

export function OnPlayerEnterCapturePoint(eventPlayer: mod.Player, eventCapturePoint: mod.CapturePoint) {
    const eventInfo = { eventPlayer, eventCapturePoint };
    let eventNum = 13;
    OnPlayerEnterCapturePoint_CapturePoint_UI(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
    OnPlayerEnterCapturePoint_AI_Find_New_Objective(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerExitCapturePoint(eventPlayer: mod.Player, eventCapturePoint: mod.CapturePoint) {
    const eventInfo = { eventPlayer, eventCapturePoint };
    let eventNum = 15;
    OnPlayerExitCapturePoint_Remove_CapturePoint_UI(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerInteract(eventPlayer: mod.Player, eventInteractPoint: mod.InteractPoint) {
    const eventInfo = { eventPlayer, eventInteractPoint };
    let eventNum = 16;
    OnPlayerInteract_Team_Switcher_and_Repel_Logic(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerEnterAreaTrigger(eventPlayer: mod.Player, eventAreaTrigger: mod.AreaTrigger) {
    const eventInfo = { eventPlayer, eventAreaTrigger };
    let eventNum = 17;
    OnPlayerEnterAreaTrigger_EnterArea(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerExitAreaTrigger(eventPlayer: mod.Player, eventAreaTrigger: mod.AreaTrigger) {
    const eventInfo = { eventPlayer, eventAreaTrigger };
    let eventNum = 18;
    OnPlayerExitAreaTrigger_Exit_Area(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OngoingCapturePoint(eventCapturePoint: mod.CapturePoint) {
    const eventInfo = { eventCapturePoint: eventCapturePoint };
    let eventNum = 2;
    OngoingCapturePoint_Capture_Times(modlib.getCapturePointCondition(eventCapturePoint, eventNum++), eventInfo);
}

export function OnPlayerDamaged(eventPlayer: mod.Player, eventOtherPlayer: mod.Player, eventDamageType: mod.DamageType, eventWeaponUnlock: mod.WeaponUnlock) {
    const eventInfo = { eventPlayer, eventOtherPlayer, eventDamageType, eventWeaponUnlock };
    let eventNum = 19;
    OnPlayerDamaged_AI_Target_Shooter(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerExitVehicle(eventPlayer: mod.Player, eventVehicle: mod.Vehicle) {
    const eventInfo = { eventPlayer, eventVehicle };
    let eventNum = 20;
    OnPlayerExitVehicle_AI_Exit_Vehicle(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnPlayerEnterVehicle(eventPlayer: mod.Player, eventVehicle: mod.Vehicle) {
    const eventInfo = { eventPlayer, eventVehicle };
    let eventNum = 21;
    OnPlayerEnterVehicle_AI_Enter_Vehicle(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}

export function OnAIMoveToFailed(eventPlayer: mod.Player) {
    const eventInfo = { eventPlayer };
    let eventNum = 22;
    OnAIMoveToFailed_AI_Retry_Move(modlib.getPlayerCondition(eventPlayer, eventNum++), eventInfo);
}
