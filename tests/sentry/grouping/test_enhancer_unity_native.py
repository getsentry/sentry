"""
Tests for Unity IL2CPP enhancement rules on the *native* platform.
"""

from __future__ import annotations

from typing import Any

import pytest

from sentry.grouping.enhancer import ENHANCEMENT_BASES

# The Unity rules live in both enhancement bases, so every case is checked against both.
ENHANCEMENT_BASE_IDS = ("all-platforms:2023-01-11", "all-platforms:2026-01-20")

GAME_ASSEMBLY = "/Applications/Game.app/Contents/Frameworks/GameAssembly.dylib"
UNITY_PLAYER = "/Applications/Game.app/Contents/Frameworks/UnityPlayer.dylib"
SENTRY_PLUGIN = "/Applications/Game.app/Contents/PlugIns/Sentry.dylib"
IL2CPP_OUTPUT = "/build/Library/Bee/artifacts/MacStandalonePlayerBuildProgram/il2cppOutput/cpp"


def apply_rules(base_id: str, frame: dict[str, Any]) -> bool | None:
    frames = [frame]
    ENHANCEMENT_BASES[base_id].apply_category_and_updated_in_app_to_frames(frames, "native", {})
    return frames[0].get("in_app")


@pytest.mark.parametrize("base_id", ENHANCEMENT_BASE_IDS)
@pytest.mark.parametrize(
    ("frame", "expected"),
    (
        # Game code that the IL2CPP line mapping attributed back to its C# source.
        ({"package": GAME_ASSEMBLY, "abs_path": "Assets/Scripts/PlayerController.cs"}, True),
        # Hand-written C++ compiled into the same binary.
        ({"package": GAME_ASSEMBLY, "abs_path": f"{IL2CPP_OUTPUT}/CppPlugin.cpp"}, True),
        # Engine and BCL code, which IL2CPP emits into `<assembly>__<n>.cpp` files.
        ({"package": GAME_ASSEMBLY, "abs_path": f"{IL2CPP_OUTPUT}/UnityEngine.UI__3.cpp"}, False),
        ({"package": GAME_ASSEMBLY, "abs_path": f"{IL2CPP_OUTPUT}/mscorlib__8.cpp"}, False),
        # Packages pulled in by the Unity package manager are not the developer's code.
        (
            {
                "package": GAME_ASSEMBLY,
                "abs_path": "/build/Library/PackageCache/com.unity.ugui/Runtime/EventSystem.cs",
            },
            False,
        ),
        # Frames the line mapping could not attribute to any source.
        ({"package": GAME_ASSEMBLY, "abs_path": "<no-source>"}, False),
        ({"package": GAME_ASSEMBLY}, False),
        # The engine and the SDK ship as their own binaries alongside the game.
        ({"package": UNITY_PLAYER}, False),
        (
            {
                "package": SENTRY_PLUGIN,
                "abs_path": "/build/sentry-cocoa/Sources/SentryCrash/SentryCrashCachedData.c",
            },
            False,
        ),
    ),
)
def test_in_app_detection(base_id: str, frame: dict[str, Any], expected: bool) -> None:
    assert apply_rules(base_id, frame) is expected


@pytest.mark.parametrize("base_id", ENHANCEMENT_BASE_IDS)
@pytest.mark.parametrize(
    ("frame", "expected"),
    (
        # `<no-source>`, `Assets/` and `Library/PackageCache/` are not specific to Unity, so the
        # rules above must not fire for frames outside the IL2CPP binary. Without the package
        # qualifier these apps would lose their in-app frames entirely.
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
        # ...and must not pull unrelated frames into the app either.
        (
            {
                "package": "/data/app/com.example.app-1/lib/arm64/libnative.so",
                "abs_path": "/build/Assets/loader.cpp",
            },
            None,
        ),
    ),
)
def test_rules_are_scoped_to_the_il2cpp_binary(
    base_id: str, frame: dict[str, Any], expected: bool | None
) -> None:
    assert apply_rules(base_id, frame) is expected
