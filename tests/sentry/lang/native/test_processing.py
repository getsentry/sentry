"""
This file is intended for unit tests that don't require fixtures or a live
service. Most tests live in tests/symbolicator/
"""

from __future__ import annotations

import re
from collections.abc import Generator
from copy import deepcopy
from typing import Any
from unittest import mock

import pytest

from sentry.grouping.api import load_grouping_config
from sentry.lang.native.processing import (
    ELECTRON_FIRST_MODULE_REWRITE_RULES,
    _merge_image,
    get_frames_for_symbolication,
    get_native_symbolication_functions,
    process_applecrashreport,
    process_minidump,
    process_native_stacktraces,
)
from sentry.lang.native.symbolicator import SymbolicatorFunction
from sentry.models.eventerror import EventErrorType
from sentry.services.eventstore.models import Event
from sentry.stacktraces.processing import find_stacktraces_in_data
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.event import is_handled
from sentry.utils.safe import get_path

MINIDUMP_PLACEHOLDER = {
    "type": "Minidump",
    "value": "Invalid Minidump",
    "mechanism": {"type": "minidump", "handled": False, "synthetic": True},
}

APPLECRASHREPORT_PLACEHOLDER = {
    "type": "AppleCrashReport",
    "value": "Invalid Apple Crash Report",
    "mechanism": {"type": "applecrashreport", "handled": False, "synthetic": True},
}

NATIVE_EXCEPTION = {
    "type": "EXCEPTION_ACCESS_VIOLATION_WRITE",
    "stacktrace": {"frames": [{"instruction_addr": "0x2a2a3d"}]},
}


@pytest.mark.parametrize(
    ("exceptions", "expected_functions"),
    [
        pytest.param(
            [MINIDUMP_PLACEHOLDER],
            [SymbolicatorFunction.minidump],
            id="simple_minidump",
        ),
        pytest.param(
            [MINIDUMP_PLACEHOLDER, NATIVE_EXCEPTION],
            [SymbolicatorFunction.native, SymbolicatorFunction.minidump],
            id="minidump_with_native_stacktrace",
        ),
        pytest.param(
            [MINIDUMP_PLACEHOLDER, APPLECRASHREPORT_PLACEHOLDER],  # unlikely but allowed
            [SymbolicatorFunction.minidump],
            id="minidump_with_applecrashreport",
        ),
        pytest.param(
            [APPLECRASHREPORT_PLACEHOLDER],
            [SymbolicatorFunction.applecrashreport],
            id="simple_applecrashreport",
        ),
        pytest.param(
            [APPLECRASHREPORT_PLACEHOLDER, NATIVE_EXCEPTION],
            [SymbolicatorFunction.native, SymbolicatorFunction.applecrashreport],
            id="applecrashreport_with_native",
        ),
        pytest.param(
            [NATIVE_EXCEPTION],
            [SymbolicatorFunction.native],
            id="native_stacktrace",
        ),
    ],
)
def test_get_native_symbolication_functions(
    exceptions: list[dict[str, Any]], expected_functions: list[SymbolicatorFunction]
) -> None:
    # Relay sets the platform of minidump/applecrashreport events to "native",
    # so a native platform alone must not schedule a `native` symbolication run.
    data = {
        "platform": "native",
        "event_id": "cc3e6c2bb6b6498097f336d1e6979f4b",
        "exception": {"values": exceptions},
    }
    stacktraces = find_stacktraces_in_data(data)

    functions = list(get_native_symbolication_functions(data, stacktraces))

    assert functions == expected_functions


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
        ("/var/containers/Bundle/Application/asdf/foo", EventErrorType.NATIVE_MISSING_DSYM.value),
        (
            "/var/containers/Bundle/Application/asdf/Frameworks/foo",
            EventErrorType.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM.value,
        ),
    ],
)
def test_merge_symbolicator_image_errors(code_file: str, error: EventErrorType) -> None:
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


@pytest.fixture
def minidump_event() -> dict[str, Any]:
    return {
        "platform": "native",
        "exception": {"values": [{**deepcopy(MINIDUMP_PLACEHOLDER), "thread_id": 2}]},
    }


@pytest.fixture
def minidump_symbolicator() -> Generator[mock.Mock]:
    symbolicator = mock.Mock()
    symbolicator.process_minidump.return_value = {
        "status": "completed",
        "crashed": True,
        "crash_reason": "EXCEPTION_BREAKPOINT",
        "modules": [],
        "stacktraces": [
            {
                "thread_id": 1,
                "thread_name": "watchdog",
                "is_requesting": True,
                "frames": [{"function": "watchdog", "instruction_addr": "0x1000"}],
                "registers": {"rip": "0x1000"},
            },
            {
                "thread_id": 2,
                "thread_name": "main",
                "is_requesting": False,
                "frames": [
                    {"function": "hang", "instruction_addr": "0x2000"},
                    {"function": "main", "instruction_addr": "0x3000"},
                ],
                "registers": {"rip": "0x2000"},
            },
        ],
    }
    with mock.patch(
        "sentry.lang.native.processing.get_event_attachment", return_value=mock.sentinel.minidump
    ):
        yield symbolicator


@pytest.mark.parametrize(
    "preferred,actual",
    [(2, 2), ("2", 2), ("0002", 2), (0, "0"), ("0", 0), (2, "2"), (2**64 - 1, str(2**64 - 1))],
)
def test_minidump_select_thread(
    minidump_event: dict[str, Any],
    minidump_symbolicator: mock.Mock,
    preferred: int | str,
    actual: int | str,
) -> None:
    minidump_event["exception"]["values"][0]["thread_id"] = preferred
    minidump_symbolicator.process_minidump.return_value["stacktraces"][1]["thread_id"] = actual
    additional_exception = {"type": "std::runtime_error", "value": "example", "thread_id": 2}
    minidump_event["exception"]["values"].append(deepcopy(additional_exception))
    minidump_event["fingerprint"] = ["custom"]
    original_response = deepcopy(minidump_symbolicator.process_minidump.return_value)

    process_minidump(minidump_symbolicator, minidump_event)

    exception, retained = minidump_event["exception"]["values"]
    assert exception["thread_id"] == actual
    assert [frame["function"] for frame in exception["stacktrace"]["frames"]] == ["main", "hang"]
    assert exception["stacktrace"]["registers"] == {"rip": "0x2000"}
    assert exception["type"] == "EXCEPTION_BREAKPOINT"
    assert exception["mechanism"] == MINIDUMP_PLACEHOLDER["mechanism"]
    watchdog, main = minidump_event["threads"]["values"]
    assert watchdog["stacktrace"]["frames"][0]["function"] == "watchdog"
    assert watchdog["stacktrace"]["registers"] == {"rip": "0x1000"}
    assert "crashed" not in watchdog
    assert main == {"id": actual, "name": "main", "crashed": True}
    assert retained == additional_exception
    assert minidump_event["fingerprint"] == ["custom"]
    assert minidump_symbolicator.process_minidump.return_value == original_response
    assert not minidump_event.get("errors")


def test_minidump_select_snapshot_thread(
    minidump_event: dict[str, Any], minidump_symbolicator: mock.Mock
) -> None:
    response = minidump_symbolicator.process_minidump.return_value
    response["crashed"] = False
    response.pop("crash_reason")
    response["stacktraces"][0]["is_requesting"] = False

    process_minidump(minidump_symbolicator, minidump_event)

    exception = minidump_event["exception"]["values"][0]
    assert exception["thread_id"] == 2
    assert exception["type"] == "Minidump"
    assert not exception.get("value")
    assert exception["stacktrace"]["frames"][-1]["function"] == "hang"
    assert minidump_event["threads"]["values"][1] == {"id": 2, "name": "main", "current": True}
    assert "crashed" not in minidump_event["threads"]["values"][0]
    assert minidump_event["level"] == "info"


def test_minidump_legacy_selection(
    minidump_event: dict[str, Any], minidump_symbolicator: mock.Mock
) -> None:
    minidump_event["exception"]["values"].append({"type": "Other", "thread_id": 2})
    legacy = deepcopy(minidump_event)
    legacy["exception"]["values"][0].pop("thread_id")
    minidump_event["exception"]["values"][0]["thread_id"] = None

    process_minidump(minidump_symbolicator, legacy)
    process_minidump(minidump_symbolicator, minidump_event)

    assert minidump_event == legacy
    assert legacy["exception"]["values"][0]["thread_id"] == 1


def test_applecrashreport_ignores_minidump_selection(
    minidump_event: dict[str, Any], minidump_symbolicator: mock.Mock
) -> None:
    minidump_event["exception"]["values"] = [
        {**deepcopy(APPLECRASHREPORT_PLACEHOLDER), "thread_id": 2}
    ]
    minidump_symbolicator.process_applecrashreport.return_value = (
        minidump_symbolicator.process_minidump.return_value
    )

    process_applecrashreport(minidump_symbolicator, minidump_event)

    assert minidump_event["exception"]["values"][0]["thread_id"] == 1


@pytest.mark.parametrize("requesting,crash_reason", [(True, "EXCEPTION_BREAKPOINT"), (False, "")])
@pytest.mark.parametrize("preferred", [2, None])
@django_db_all
def test_minidump_groups_by_selected_stack(
    minidump_event: dict[str, Any],
    minidump_symbolicator: mock.Mock,
    requesting: bool,
    crash_reason: str,
    preferred: int | None,
) -> None:
    response = minidump_symbolicator.process_minidump.return_value
    response["stacktraces"][0]["is_requesting"] = requesting
    response["crashed"] = requesting
    response["crash_reason"] = crash_reason
    minidump_event["threads"] = {"values": [{"id": 2, "crashed": False}]}
    minidump_event["exception"]["values"][0]["thread_id"] = preferred
    first = deepcopy(minidump_event)
    first["exception"]["values"][0].pop("thread_id")
    second = deepcopy(minidump_event)

    process_minidump(minidump_symbolicator, first)
    process_minidump(minidump_symbolicator, second)

    config = load_grouping_config()
    first_event = Event(event_id="a" * 32, project_id=1, data=first)
    second_event = Event(event_id="b" * 32, project_id=1, data=second)
    first_hashes = {
        variant.get_hash() for variant in first_event.get_grouping_variants(config).values()
    } - {None}
    second_hashes = {
        variant.get_hash() for variant in second_event.get_grouping_variants(config).values()
    } - {None}
    assert first_hashes
    assert second_hashes
    assert first_hashes.isdisjoint(second_hashes) is (preferred is not None)


def test_minidump_does_not_reuse_other_thread_registers(
    minidump_event: dict[str, Any], minidump_symbolicator: mock.Mock
) -> None:
    minidump_event["exception"]["values"][0]["stacktrace"] = {
        "registers": {"rip": "0x1000"},
        "frames": [],
    }
    minidump_symbolicator.process_minidump.return_value["stacktraces"][1].pop("registers")

    process_minidump(minidump_symbolicator, minidump_event)

    exception = minidump_event["exception"]["values"][0]
    assert exception["thread_id"] == 2
    assert "registers" not in exception["stacktrace"]


@pytest.mark.parametrize(
    "attributes,level,handled",
    [
        ({"current": True, "crashed": False, "main": True}, "error", True),
        ({"crashed": False}, "error", True),
        ({"crashed": True}, "fatal", False),
    ],
)
def test_minidump_preserves_event_attributes(
    minidump_event: dict[str, Any],
    minidump_symbolicator: mock.Mock,
    attributes: dict[str, bool],
    level: str,
    handled: bool,
) -> None:
    minidump_event["level"] = level
    minidump_event["exception"]["values"][0]["mechanism"]["handled"] = handled
    minidump_event["threads"] = {
        "values": [
            {"id": 1, "crashed": True},
            {"id": "2", **attributes},
        ]
    }

    minidump_symbolicator.process_minidump.return_value["crashed"] = not attributes["crashed"]

    process_minidump(minidump_symbolicator, minidump_event)

    watchdog, main = minidump_event["threads"]["values"]
    assert not watchdog.get("crashed")
    assert not watchdog.get("current")
    assert main == {"id": 2, "name": "main", **attributes}
    exception = minidump_event["exception"]["values"][0]
    assert exception["thread_id"] == 2
    assert exception["stacktrace"]["frames"][-1]["function"] == "hang"
    assert minidump_event["level"] == level
    assert is_handled(minidump_event) is handled
