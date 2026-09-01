"""
Tests for the Unity IL2CPP enhancement rules.

Paths and binary names are taken from real Unity builds of the sentry-unity integration-test
project across Unity 2021.3 through 6000.5, since the IL2CPP output lands in a differently named
binary on every target.
"""

from __future__ import annotations

from typing import Any

import pytest

from sentry.grouping.component import FrameGroupingComponent
from sentry.grouping.enhancer import ENHANCEMENT_BASES

# The Unity rules live in both enhancement bases, so every case is checked against both.
ENHANCEMENT_BASE_IDS = ("all-platforms:2023-01-11", "all-platforms:2026-01-20")

# Desktop: IL2CPP output and the engine ship as separate binaries next to the player.
GAME_ASSEMBLY = "/Applications/Game.app/Contents/Frameworks/GameAssembly.dylib"
UNITY_PLAYER = "/Applications/Game.app/Contents/Frameworks/UnityPlayer.dylib"
SENTRY_PLUGIN = "/Applications/Game.app/Contents/PlugIns/Sentry.dylib"
SENTRY_NATIVE_PLUGIN = "/Applications/Game.app/Contents/PlugIns/libsentry.dylib"
GAME_ASSEMBLY_WIN = "D:\\build\\Game\\GameAssembly.dll"
UNITY_PLAYER_WIN = "D:\\build\\Game\\UnityPlayer.dll"
SENTRY_WIN = "D:\\build\\Game\\sentry.dll"

# iOS: the IL2CPP output is linked into `UnityFramework`, and the engine sits beside it as
# `libiPhone-lib.dylib` (Unity <= 6000.0) or a nested `UnityRuntime.framework` (>= 6000.3).
IOS_BUNDLE = "/var/containers/Bundle/Application/ABC/Game.app"
UNITY_FRAMEWORK = f"{IOS_BUNDLE}/Frameworks/UnityFramework.framework/UnityFramework"
IPHONE_LIB = f"{IOS_BUNDLE}/Frameworks/UnityFramework.framework/libiPhone-lib.dylib"
UNITY_RUNTIME = (
    f"{IOS_BUNDLE}/Frameworks/UnityFramework.framework"
    "/Frameworks/UnityRuntime.framework/UnityRuntime"
)
SENTRY_OBJC = f"{IOS_BUNDLE}/Frameworks/SentryObjC.framework/SentryObjC"
IOS_MAIN_EXECUTABLE = f"{IOS_BUNDLE}/Game"

# Android: the IL2CPP output is `libil2cpp.so`; `libunity.so` and `libgame.so` are the engine.
ANDROID_LIB_DIR = "/data/app/~~abc/com.example.game-xyz/lib/arm64"
LIBIL2CPP = f"{ANDROID_LIB_DIR}/libil2cpp.so"
LIBUNITY = f"{ANDROID_LIB_DIR}/libunity.so"
LIBGAME = f"{ANDROID_LIB_DIR}/libgame.so"

IL2CPP_OUTPUT = "/build/Library/Bee/artifacts/MacStandalonePlayerBuildProgram/il2cppOutput/cpp"
GAME_SOURCE = "/build/samples/Game/Assets/Scripts/PlayerController.cs"


def apply_rules(base_id: str, frame: dict[str, Any]) -> bool | None:
    frames = [frame]
    ENHANCEMENT_BASES[base_id].apply_category_and_updated_in_app_to_frames(frames, "native", {})
    return frames[0].get("in_app")


@pytest.mark.parametrize("base_id", ENHANCEMENT_BASE_IDS)
@pytest.mark.parametrize(
    ("frame", "expected"),
    (
        # Game code the IL2CPP line mapping attributed back to its C# source.
        ({"package": GAME_ASSEMBLY, "abs_path": "Assets/Scripts/PlayerController.cs"}, True),
        ({"package": GAME_ASSEMBLY_WIN, "abs_path": "D:/build/Assets/Scripts/Player.cs"}, True),
        ({"package": UNITY_FRAMEWORK, "abs_path": GAME_SOURCE}, True),
        ({"package": LIBIL2CPP, "abs_path": GAME_SOURCE}, True),
        # Packages embedded in the project are the developer's code as well.
        (
            {"package": GAME_ASSEMBLY, "abs_path": "/build/Packages/com.studio.game/Enemy.cs"},
            True,
        ),
        ({"package": UNITY_FRAMEWORK, "abs_path": "/build/Packages/com.studio.game/E.cs"}, True),
        ({"package": LIBIL2CPP, "abs_path": "/build/Packages/com.studio.game/E.cs"}, True),
        # A frame still pointing at generated C++ went unmapped, so it is engine, BCL or runtime
        # code. `__<n>` is IL2CPP's chunk separator, not a game/engine marker -- every assembly is
        # split that way, `Assembly-CSharp` included.
        ({"package": GAME_ASSEMBLY, "abs_path": f"{IL2CPP_OUTPUT}/UnityEngine.UI__3.cpp"}, False),
        ({"package": GAME_ASSEMBLY, "abs_path": f"{IL2CPP_OUTPUT}/mscorlib__8.cpp"}, False),
        ({"package": GAME_ASSEMBLY, "abs_path": f"{IL2CPP_OUTPUT}/mscorlib.cpp"}, False),
        ({"package": GAME_ASSEMBLY, "abs_path": f"{IL2CPP_OUTPUT}/Il2CppMetadataUsage.cpp"}, False),
        ({"package": GAME_ASSEMBLY, "abs_path": f"{IL2CPP_OUTPUT}/Assembly-CSharp__5.cpp"}, False),
        ({"package": UNITY_FRAMEWORK, "abs_path": f"{IL2CPP_OUTPUT}/mscorlib__8.cpp"}, False),
        ({"package": LIBIL2CPP, "abs_path": f"{IL2CPP_OUTPUT}/mscorlib__8.cpp"}, False),
        # Unity's own engine C# ships sources under an `Assets` directory of its own, which would
        # otherwise be restored to in-app by the rule above.
        (
            {
                "package": GAME_ASSEMBLY,
                "abs_path": (
                    "/Users/bokken/build/output/unity/unity/Modules/Physics2D/LowLevel"
                    "/Scripting/Assets/PhysicsLowLevelSettings2D.cs"
                ),
            },
            False,
        ),
        (
            {
                "package": UNITY_FRAMEWORK,
                "abs_path": (
                    "/Users/bokken/build/output/unity/unity/Modules/PhysicsCore2D"
                    "/Scripting/Assets/PhysicsCoreSettings2D.cs"
                ),
            },
            False,
        ),
        # Registry packages are not the developer's code. They miss the restore only by UPM
        # convention, so one shipping an `Assets` directory has to be excluded by rule.
        (
            {
                "package": GAME_ASSEMBLY,
                "abs_path": "/build/Library/PackageCache/com.unity.ugui/Runtime/EventSystem.cs",
            },
            False,
        ),
        (
            {
                "package": GAME_ASSEMBLY,
                "abs_path": "/build/Library/PackageCache/com.unity.ugui/Assets/EventSystem.cs",
            },
            False,
        ),
        (
            {
                "package": UNITY_FRAMEWORK,
                "abs_path": "/build/Library/PackageCache/com.foo.bar/Assets/Samples/Demo.cs",
            },
            False,
        ),
        (
            {
                "package": LIBIL2CPP,
                "abs_path": "/build/Library/PackageCache/com.foo.bar/Assets/Runtime/Thing.cs",
            },
            False,
        ),
        # Frames the line mapping could not attribute to any source.
        ({"package": GAME_ASSEMBLY, "abs_path": "<no-source>"}, False),
        ({"package": GAME_ASSEMBLY}, False),
        ({"package": UNITY_FRAMEWORK}, False),
        ({"package": LIBIL2CPP}, False),
        # The engine ships as its own binary alongside the game on every platform.
        ({"package": UNITY_PLAYER}, False),
        ({"package": UNITY_PLAYER_WIN}, False),
        ({"package": IPHONE_LIB}, False),
        ({"package": UNITY_RUNTIME}, False),
        ({"package": LIBUNITY}, False),
        # `libgame.so` is Unity's Android GameActivity glue, not the developer's game code.
        ({"package": LIBGAME}, False),
        # The generated iOS launch stubs live in the app's own executable, so the bundle rules
        # would otherwise mark them in-app.
        ({"package": IOS_MAIN_EXECUTABLE, "abs_path": "/build/Game/MainApp/main.mm"}, False),
        # The Sentry SDK ships under a different name on each platform.
        (
            {
                "package": SENTRY_PLUGIN,
                "abs_path": "/build/sentry-cocoa/Sources/SentryCrash/SentryCrashCachedData.c",
            },
            False,
        ),
        ({"package": SENTRY_NATIVE_PLUGIN}, False),
        ({"package": SENTRY_OBJC}, False),
        ({"package": SENTRY_WIN}, False),
        ({"package": "/build/Game_Data/Plugins/x86_64/libsentry.so"}, False),
        ({"package": f"{ANDROID_LIB_DIR}/libsentry-android.so"}, False),
    ),
)
def test_in_app_detection(base_id: str, frame: dict[str, Any], expected: bool) -> None:
    assert apply_rules(base_id, frame) is expected


@pytest.mark.parametrize("base_id", ENHANCEMENT_BASE_IDS)
@pytest.mark.parametrize(
    ("frame", "expected"),
    (
        # None of these paths are specific to Unity, so without the package qualifier a
        # non-Unity app would lose its in-app frames entirely.
        (
            {
                "package": "/var/containers/Bundle/Application/ABC/MyApp.app/MyApp",
                "abs_path": "<no-source>",
            },
            True,
        ),
        ({"package": "/Users/dev/MyApp.app/Contents/MacOS/MyApp", "abs_path": "<no-source>"}, True),
        (
            {
                "package": "/Users/dev/MyApp.app/Contents/MacOS/MyApp",
                "abs_path": "/build/Library/PackageCache/foo/bar.cs",
            },
            True,
        ),
        (
            {
                "package": "/Users/dev/MyApp.app/Contents/MacOS/MyApp",
                "abs_path": "/src/unity/Modules/Thing.cs",
            },
            True,
        ),
        # ...and must not pull unrelated frames into the app either.
        (
            {
                "package": "/data/app/com.example.app-1/lib/arm64/libnative.so",
                "abs_path": "/build/Assets/loader.cpp",
            },
            None,
        ),
        (
            {
                "package": "/data/app/com.example.app-1/lib/arm64/libnative.so",
                "abs_path": "/build/Packages/com.other.thing/Runtime/Thing.cs",
            },
            None,
        ),
    ),
)
def test_rules_are_scoped_to_the_il2cpp_binary(
    base_id: str, frame: dict[str, Any], expected: bool | None
) -> None:
    assert apply_rules(base_id, frame) is expected


@pytest.mark.parametrize("base_id", ENHANCEMENT_BASE_IDS)
@pytest.mark.parametrize(
    ("frame", "expected"),
    (
        # The launch stubs live in the app's own executable, so there is no IL2CPP binary to
        # qualify on. A non-Unity iOS app keeping a `MainApp/main.mm` loses that frame.
        (
            {
                "package": "/var/containers/Bundle/Application/ABC/MyApp.app/MyApp",
                "abs_path": "/Users/dev/MyApp/MainApp/main.mm",
            },
            False,
        ),
        (
            {
                "package": "/var/containers/Bundle/Application/ABC/MyApp.app/MyApp",
                "abs_path": "/Users/dev/MyApp/AppDelegate.mm",
            },
            True,
        ),
        # There is no matcher for "the rest of this stack is IL2CPP", so a non-Unity app shipping
        # the name loses the frame wherever an SDK marked it in-app. Accepted: `libgame.so` is a
        # real Unity Android binary that shows up in crashes.
        (
            {
                "package": "/data/app/com.example.game-1/lib/arm64/libgame.so",
                "abs_path": "/src/game.cpp",
                "in_app": True,
            },
            False,
        ),
        (
            {
                "package": "/data/app/com.example.game-1/lib/arm64/libcore.so",
                "abs_path": "/src/game.cpp",
                "in_app": True,
            },
            True,
        ),
        # Unity's `baselib` is a static archive linked into the player, never a module of its
        # own, so a `**/baselib.*` rule could only match somebody else's library. There is none.
        (
            {
                "package": "C:/Program Files/MyApp/baselib.dll",
                "abs_path": "/src/x.cpp",
                "in_app": True,
            },
            True,
        ),
    ),
)
def test_engine_rules_are_deliberately_not_scoped(
    base_id: str, frame: dict[str, Any], expected: bool | None
) -> None:
    """Pin the reach of the `-app` rules that carry no IL2CPP qualifier.

    Unlike the `+app` restores, these cannot be qualified. The reach onto non-Unity apps is
    accepted rather than unnoticed, so a flip here is a decision to revisit, not a silent change.
    """
    assert apply_rules(base_id, frame) is expected


UNITY_CORE = "UnityEngine.CoreModule, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null"
GAME_ASSEMBLY_CSHARP = "Assembly-CSharp, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null"

# A managed Unity coroutine stack, outermost frame first. Which frames below `InvokeMoveNext`
# get captured differs by platform, so they must not contribute or one crash becomes several.
COROUTINE_STACK = [
    ({"function": "Start", "package": GAME_ASSEMBLY_CSHARP, "in_app": True}, False),
    ({"function": "StartCoroutine", "package": UNITY_CORE, "in_app": False}, False),
    ({"function": "StartCoroutineManaged2", "package": UNITY_CORE, "in_app": False}, False),
    (
        {"function": "StartCoroutineManaged2_Injected", "package": UNITY_CORE, "in_app": False},
        False,
    ),
    ({"function": "InvokeMoveNext", "package": UNITY_CORE, "in_app": False}, True),
    ({"function": "ExceptionCapture", "package": GAME_ASSEMBLY_CSHARP, "in_app": True}, True),
    ({"function": "DoSomeWork", "package": GAME_ASSEMBLY_CSHARP, "in_app": True}, True),
    ({"function": "ThrowException", "package": GAME_ASSEMBLY_CSHARP, "in_app": True}, True),
]


@pytest.mark.parametrize("base_id", ENHANCEMENT_BASE_IDS)
def test_unity_coroutine_starter_does_not_contribute(base_id: str) -> None:
    frames = [dict(frame) for frame, _ in COROUTINE_STACK]
    components = [FrameGroupingComponent(values=[], in_app=True, contributes=True) for _ in frames]
    ENHANCEMENT_BASES[base_id].assemble_stacktrace_component(
        "app", components, frames, "csharp", None
    )
    assert [c.contributes for c in components] == [expected for _, expected in COROUTINE_STACK]


@pytest.mark.parametrize("base_id", ENHANCEMENT_BASE_IDS)
def test_unity_coroutine_rule_leaves_other_platforms_alone(base_id: str) -> None:
    # Every C# iterator has an `InvokeMoveNext`, so the rule must not silence an unrelated
    # app's callers.
    frames = [
        {"function": "Main", "package": "MyApp, Version=1.0.0.0", "in_app": True},
        {"function": "InvokeMoveNext", "package": "MyApp, Version=1.0.0.0", "in_app": True},
        {"function": "Boom", "package": "MyApp, Version=1.0.0.0", "in_app": True},
    ]
    components = [FrameGroupingComponent(values=[], in_app=True, contributes=True) for _ in frames]
    ENHANCEMENT_BASES[base_id].assemble_stacktrace_component(
        "app", components, frames, "csharp", None
    )
    assert [c.contributes for c in components] == [True, True, True]
