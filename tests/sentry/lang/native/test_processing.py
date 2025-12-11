"""
This file is intended for unit tests that don't require fixtures or a live
service. Most tests live in tests/symbolicator/
"""

from __future__ import annotations

import re
from typing import Any
from unittest import mock

import pytest

from sentry.lang.native.processing import (
    ELECTRON_FIRST_MODULE_REWRITE_RULES,
    _merge_frame,
    _merge_image,
    get_frames_for_symbolication,
    process_native_stacktraces,
)
from sentry.models.eventerror import EventError
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.safe import get_path


def test_merge_symbolicator_image_empty() -> None:
    data: dict[str, Any] = {}
    _merge_image({}, {}, None, data)
    assert not data.get("errors")


def test_merge_symbolicator_image_basic() -> None:
    raw_image = {"instruction_addr": 0xFEEBEE, "other": "foo"}
    sdk_info = {"sdk_name": "linux"}
    complete_image = {
        "debug_status": "found",
        "unwind_status": "found",
        "other2": "bar",
        "arch": "unknown",
    }

    data: dict[str, Any] = {}

    _merge_image(raw_image, complete_image, sdk_info, data)

    assert not data.get("errors")
    assert raw_image == {
        "debug_status": "found",
        "unwind_status": "found",
        "instruction_addr": 0xFEEBEE,
        "other": "foo",
        "other2": "bar",
    }


def test_merge_symbolicator_image_basic_success() -> None:
    raw_image = {"instruction_addr": 0xFEEBEE, "other": "foo"}
    sdk_info = {"sdk_name": "linux"}
    complete_image = {
        "debug_status": "found",
        "unwind_status": "found",
        "other2": "bar",
        "arch": "foo",
    }
    data: dict[str, Any] = {}

    _merge_image(raw_image, complete_image, sdk_info, data)

    assert not data.get("errors")
    assert raw_image == {
        "debug_status": "found",
        "unwind_status": "found",
        "instruction_addr": 0xFEEBEE,
        "other": "foo",
        "other2": "bar",
        "arch": "foo",
    }


def test_merge_symbolicator_image_remove_unknown_arch() -> None:
    raw_image = {"instruction_addr": 0xFEEBEE}
    sdk_info = {"sdk_name": "linux"}
    complete_image = {"debug_status": "found", "unwind_status": "found", "arch": "unknown"}
    data: dict[str, Any] = {}

    _merge_image(raw_image, complete_image, sdk_info, data)

    assert not data.get("errors")
    assert raw_image == {
        "debug_status": "found",
        "unwind_status": "found",
        "instruction_addr": 0xFEEBEE,
    }


@pytest.mark.parametrize(
    "code_file,error",
    [
        ("/var/containers/Bundle/Application/asdf/foo", EventError.NATIVE_MISSING_DSYM),
        (
            "/var/containers/Bundle/Application/asdf/Frameworks/foo",
            EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM,
        ),
    ],
)
def test_merge_symbolicator_image_errors(code_file: str, error: EventError) -> None:
    raw_image = {"instruction_addr": 0xFEEBEE, "other": "foo", "code_file": code_file}
    sdk_info = {"sdk_name": "macos"}
    complete_image = {
        "debug_status": "found",
        "unwind_status": "missing",
        "other2": "bar",
        "arch": "unknown",
    }
    data: dict[str, Any] = {}

    _merge_image(raw_image, complete_image, sdk_info, data)

    (e,) = data["errors"]

    assert e["image_path"].endswith("/foo")
    assert e["type"] == error

    assert raw_image == {
        "debug_status": "found",
        "unwind_status": "missing",
        "instruction_addr": 0xFEEBEE,
        "other": "foo",
        "other2": "bar",
        "code_file": code_file,
    }


@django_db_all
@mock.patch("sentry.lang.native.processing.Symbolicator")
def test_cocoa_function_name(mock_symbolicator, default_project) -> None:

    data = {
        "platform": "cocoa",
        "project": default_project.id,
        "event_id": "1",
        "exception": {"values": [{"stacktrace": {"frames": [{"instruction_addr": 0}]}}]},
    }

    mock_symbolicator.return_value = mock_symbolicator
    mock_symbolicator.process_payload.return_value = {
        "status": "completed",
        "stacktraces": [
            {
                "frames": [
                    {
                        "original_index": 0,
                        "function": "thunk for @callee_guaranteed () -> ()",
                    }
                ],
            }
        ],
        "modules": [],
    }

    process_native_stacktraces(mock_symbolicator, data)

    function_name = get_path(data, "exception", "values", 0, "stacktrace", "frames", 0, "function")
    assert function_name == "thunk for closure"


def test_filter_frames() -> None:

    frames = [
        {
            "instruction_addr": None,
        },
        {
            "platform": "not native",
            "instruction_addr": "0xdeadbeef",
        },
        {
            "platform": "cocoa",
        },
    ]

    filtered_frames = get_frames_for_symbolication(frames, {"platform": "native"}, {})

    assert len(filtered_frames) == 0


def test_instruction_addr_adjustment_auto() -> None:
    frames = [
        {"instruction_addr": "0xdeadbeef", "platform": "native"},
        {"instruction_addr": "0xbeefdead", "platform": "native"},
    ]

    processed_frames = get_frames_for_symbolication(frames, None, None, None)

    assert "adjust_instruction_addr" not in processed_frames[0].keys()
    assert "adjust_instruction_addr" not in processed_frames[1].keys()


def test_instruction_addr_adjustment_all() -> None:
    frames = [
        {"instruction_addr": "0xdeadbeef", "platform": "native"},
        {"instruction_addr": "0xbeefdead", "platform": "native"},
    ]

    processed_frames = get_frames_for_symbolication(frames, None, None, "all")

    assert processed_frames[0]["adjust_instruction_addr"]
    assert "adjust_instruction_addr" not in processed_frames[1].keys()


def test_instruction_addr_adjustment_all_but_first() -> None:
    frames = [
        {"instruction_addr": "0xdeadbeef", "platform": "native"},
        {"instruction_addr": "0xbeefdead", "platform": "native"},
    ]

    processed_frames = get_frames_for_symbolication(frames, None, None, "all_but_first")

    assert not processed_frames[0]["adjust_instruction_addr"]
    assert "adjust_instruction_addr" not in processed_frames[1].keys()


def test_instruction_addr_adjustment_none() -> None:
    frames = [
        {"instruction_addr": "0xdeadbeef", "platform": "native"},
        {"instruction_addr": "0xbeefdead", "platform": "native"},
    ]

    processed_frames = get_frames_for_symbolication(frames, None, None, "none")

    assert not processed_frames[0]["adjust_instruction_addr"]
    assert not processed_frames[1]["adjust_instruction_addr"]


def test_rewrite_electron_debug_file() -> None:
    def rewrite(debug_file):
        for rule in ELECTRON_FIRST_MODULE_REWRITE_RULES:
            # Need to patch the regexes and replacement strings here
            # from Rust to Python syntax.
            # In regex: ?<group> -> ?P<group>
            # In replacement: $group -> \g<group>
            from_patched = re.sub("\\?<", "?P<", rule["from"])
            to_patched = re.sub("\\$(\\w+)", "\\\\g<\\1>", rule["to"])
            replaced = re.sub(from_patched, to_patched, debug_file)
            if replaced != debug_file:
                return replaced

        return debug_file

    assert rewrite("/home/My Awesome Crasher") == "/home/electron"
    assert (
        rewrite("/home/My Awesome Crasher Helper (Renderer)") == "/home/Electron Helper (Renderer)"
    )
    assert rewrite("/home/My Awesome Crasher Helper") == "/home/Electron Helper"
    assert (
        rewrite("C:/projects/src/out/Default/myapp.exe.pdb")
        == "C:/projects/src/out/Default/electron.exe.pdb"
    )
    assert (
        rewrite("C:\\projects\\src\\out\\Default\\myapp.exe.pdb")
        == "C:\\projects\\src\\out\\Default\\electron.exe.pdb"
    )
    assert (
        rewrite("C:\\projects\\src\\out\\Default\\myapp-exe-pdb")
        == "C:\\projects\\src\\out\\Default\\electron"
    )
    assert (
        rewrite("/home/************/usr/lib/slack/slack")
        == "/home/************/usr/lib/slack/electron"
    )


@django_db_all
@mock.patch("sentry.lang.native.processing.Symbolicator")
def test_il2cpp_symbolication(mock_symbolicator, default_project) -> None:

    data = {
        "event_id": "c87700da71534177b92bd912f21a062f",
        "timestamp": "2022-06-15T10:13:46.963575+00:00",
        "platform": "csharp",
        "project": default_project.id,
        "exception": {
            "values": [
                {
                    "type": "System.InvalidOperationException",
                    "value": "Exception from a lady beetle \ud83d\udc1e",
                    "module": "mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089",
                    "thread_id": 1,
                    "stacktrace": {
                        "frames": [
                            {
                                "function": "Process",
                                "module": "UnityEngine.EventSystems.StandaloneInputModule",
                                "in_app": True,
                                "package": "UnityEngine.UI, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null",
                                "instruction_addr": "0x0095013A",
                            },
                            {
                                "function": "StackTraceExampleA",
                                "module": "BugFarmButtons",
                                "in_app": True,
                                "package": "Assembly-CSharp, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null",
                                "instruction_addr": "0x004820C8",
                            },
                            {
                                "function": "StackTraceExampleB",
                                "module": "BugFarmButtons",
                                "in_app": True,
                                "package": "Assembly-CSharp, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null",
                                "instruction_addr": "0x004820B4",
                            },
                        ]
                    },
                    "mechanism": {"type": "Unity.LogException", "handled": False},
                }
            ]
        },
        "level": "error",
        "debug_meta": {
            "images": [
                {
                    "type": "macho",
                    "image_addr": "0x00001000",
                    "debug_id": "a9669c0c72b33d2c952bd9096f65bc4f",
                    "code_file": "/Users/swatinem/Coding/sentry-unity/samples/unity-of-bugs/Builds/MacOS.app/Contents/Frameworks/GameAssembly.dylib",
                }
            ]
        },
    }

    mock_symbolicator.return_value = mock_symbolicator
    mock_symbolicator.process_payload.return_value = {
        "status": "completed",
        "stacktraces": [
            {
                "frames": [
                    {
                        "status": "symbolicated",
                        "original_index": 0,
                        "instruction_addr": "0x4820b4",
                        "package": "/Users/swatinem/Coding/sentry-unity/samples/unity-of-bugs/Builds/MacOS.app/Contents/Frameworks/GameAssembly.dylib",
                        "lang": "cpp",
                        "symbol": "BugFarmButtons_StackTraceExampleB_m2A05E98E60BAA84184F3674F339A2E47B7E09318",
                        "sym_addr": "0x482060",
                        "function": "BugFarmButtons_StackTraceExampleB_m2A05E98E60BAA84184F3674F339A2E47B7E09318",
                        "filename": "/Users/swatinem/Coding/sentry-unity/samples/unity-of-bugs/Assets/Scripts/BugFarmButtons.cs",
                        "lineno": 51,
                    },
                    {
                        "status": "symbolicated",
                        "original_index": 1,
                        "instruction_addr": "0x4820c7",
                        "package": "/Users/swatinem/Coding/sentry-unity/samples/unity-of-bugs/Builds/MacOS.app/Contents/Frameworks/GameAssembly.dylib",
                        "lang": "cpp",
                        "symbol": "BugFarmButtons_StackTraceExampleA_m3A729DCA84695DB390C9B590F7973541BE497553",
                        "sym_addr": "0x4820c0",
                        "function": "BugFarmButtons_StackTraceExampleA_m3A729DCA84695DB390C9B590F7973541BE497553",
                        "filename": "/Users/swatinem/Coding/sentry-unity/samples/unity-of-bugs/Assets/Scripts/BugFarmButtons.cs",
                        "lineno": 55,
                    },
                    {
                        "status": "symbolicated",
                        "original_index": 2,
                        "instruction_addr": "0x950139",
                        "package": "/Users/swatinem/Coding/sentry-unity/samples/unity-of-bugs/Builds/MacOS.app/Contents/Frameworks/GameAssembly.dylib",
                        "lang": "cpp",
                        "symbol": "StandaloneInputModule_ProcessMouseEvent_mCE1BA96E47D9A4448614CB9DAF5A406754F655DD",
                        "function": "StandaloneInputModule_ProcessMouseEvent_mCE1BA96E47D9A4448614CB9DAF5A406754F655DD",
                        "filename": "/Users/swatinem/Coding/sentry-unity/samples/unity-of-bugs/Library/PackageCache/com.unity.ugui@1.0.0/Runtime/EventSystem/InputModules/StandaloneInputModule.cs",
                        "lineno": 526,
                    },
                    {
                        "status": "symbolicated",
                        "original_index": 2,
                        "instruction_addr": "0x950139",
                        "package": "/Users/swatinem/Coding/sentry-unity/samples/unity-of-bugs/Builds/MacOS.app/Contents/Frameworks/GameAssembly.dylib",
                        "lang": "cpp",
                        "symbol": "StandaloneInputModule_Process_mBD949CC45BBCAB5A0FAF5E24F3BB4C3B22FF3E81",
                        "sym_addr": "0x9500e0",
                        "function": "StandaloneInputModule_Process_mBD949CC45BBCAB5A0FAF5E24F3BB4C3B22FF3E81",
                        "filename": "/Users/swatinem/Coding/sentry-unity/samples/unity-of-bugs/Library/PackageCache/com.unity.ugui@1.0.0/Runtime/EventSystem/InputModules/StandaloneInputModule.cs",
                        "lineno": 280,
                    },
                ]
            }
        ],
        "modules": [
            {
                "debug_status": "found",
                "arch": "x86_64",
                "type": "macho",
                "code_file": "/Users/swatinem/Coding/sentry-unity/samples/unity-of-bugs/Builds/MacOS.app/Contents/Frameworks/GameAssembly.dylib",
                "debug_id": "a9669c0c-72b3-3d2c-952b-d9096f65bc4f",
                "image_addr": "0x1000",
            }
        ],
    }

    process_native_stacktraces(mock_symbolicator, data)

    frame = get_path(data, "exception", "values", 0, "stacktrace", "frames", 3)

    # For il2cpp frames, we want to retain the original `function` and `package`
    # that are coming from the Unity/C# SDK. But we want to have the underlying
    # C++ symbol, and the re-mapped files/lines.
    assert frame["function"] == "StackTraceExampleB"
    assert (
        frame["package"] == "Assembly-CSharp, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null"
    )
    assert (
        frame["symbol"]
        == "BugFarmButtons_StackTraceExampleB_m2A05E98E60BAA84184F3674F339A2E47B7E09318"
    )
    assert (
        frame["filename"]
        == "/Users/swatinem/Coding/sentry-unity/samples/unity-of-bugs/Assets/Scripts/BugFarmButtons.cs"
    )
    assert frame["lineno"] == 51


def test_merge_frame_with_revision() -> None:
    """Test that _merge_frame correctly extracts and merges the revision field from symbolicator."""
    new_frame: dict[str, Any] = {}
    symbolicated = {
        "function": "main",
        "abs_path": "//depot/main/src/file.cpp",
        "filename": "file.cpp",
        "lineno": 42,
        "revision": "12345",
        "source_link": "https://perforce.example.com/file.cpp#12345",
    }

    _merge_frame(new_frame, symbolicated, platform="native")

    assert new_frame["function"] == "main"
    assert new_frame["abs_path"] == "//depot/main/src/file.cpp"
    assert new_frame["filename"] == "file.cpp"
    assert new_frame["lineno"] == 42
    assert new_frame["revision"] == "12345"
    assert new_frame["source_link"] == "https://perforce.example.com/file.cpp#12345"


def test_merge_frame_without_revision() -> None:
    """Test that _merge_frame works correctly when revision field is not present."""
    new_frame: dict[str, Any] = {}
    symbolicated = {
        "function": "main",
        "abs_path": "/path/to/file.cpp",
        "filename": "file.cpp",
        "lineno": 42,
    }

    _merge_frame(new_frame, symbolicated, platform="native")

    assert new_frame["function"] == "main"
    assert new_frame["abs_path"] == "/path/to/file.cpp"
    assert new_frame["filename"] == "file.cpp"
    assert new_frame["lineno"] == 42
    assert "revision" not in new_frame
