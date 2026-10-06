"""
This file is intended for unit tests that don't require fixtures or a live
service. Most tests live in tests/symbolicator/
"""

from __future__ import annotations

import re
from copy import deepcopy
from typing import Any
from unittest import mock

import orjson
import pytest

from sentry.attachments import (
    CachedAttachment,
    get_attachments_for_event,
    store_attachments_for_event,
)
from sentry.lang.native.frames import get_frames_for_symbolication
from sentry.lang.native.processing import (
    ELECTRON_FIRST_MODULE_REWRITE_RULES,
    _merge_image,
    get_native_symbolication_functions,
    process_native_stacktraces,
)
from sentry.lang.native.symbolicator import SymbolicatorFunction
from sentry.models.eventerror import EventErrorType
from sentry.objectstore import UsecaseId, get_session
from sentry.stacktraces.processing import find_stacktraces_in_data
from sentry.testutils.helpers.features import Feature
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_objectstore
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


@django_db_all
def test_process_native_flamegraph(cached_flamegraph) -> None:
    data, _, symbolicator = cached_flamegraph
    payload = {
        "version": "1",
        "platform": "cocoa",
        "debug_meta": {
            "images": [
                {
                    "type": "macho",
                    "debug_id": "84a04d24-0e60-3810-a8c0-90a65e2df61a",
                    "image_addr": "0x100000000",
                    "image_size": 8192,
                    "arch": "arm64",
                }
            ]
        },
        "frames": [
            {"instruction_addr": "0x100001000", "addr_mode": "abs", "custom": "retained"},
            {"instruction_addr": "0x100001200", "function": "unresolved"},
        ],
        "trees": [
            {
                "thread_attributed": True,
                "roots": [
                    {
                        "frame_id": 0,
                        "sample_count": 10,
                        "children": [
                            {
                                "frame_id": 0,
                                "sample_count": 6,
                                "children": [{"frame_id": 1, "sample_count": 4}],
                            }
                        ],
                    }
                ],
            }
        ],
        "custom": "retained",
    }
    original = deepcopy(payload)
    store_attachments_for_event(
        symbolicator.project,
        data,
        [
            CachedAttachment(
                type="event.flamegraph",
                name="flamegraph.json",
                content_type="application/json",
                data=orjson.dumps(payload),
            )
        ],
        timeout=60,
    )
    data["debug_meta"] = {"images": [{"type": "elf", "debug_id": "event-image"}]}
    symbolicator.process_payload.return_value = {
        "status": "completed",
        "stacktraces": [
            {
                "frames": [
                    {
                        "function": "outer",
                        "status": "symbolicated",
                        "instruction_addr": "0x100000fff",
                    },
                    {
                        "function": "inlined",
                        "status": "symbolicated",
                        "filename": "Source.swift",
                        "lineno": 42,
                    },
                ]
            },
            {"frames": [{"status": "missing", "instruction_addr": "0x1000011ff"}]},
        ],
    }
    with Feature({"organizations:flamegraph-attachments": True}):
        result = process_native_stacktraces(symbolicator, data)
    symbolicator.process_payload.assert_called_once()
    request = symbolicator.process_payload.call_args.kwargs
    assert request["platform"] == "cocoa"
    assert request["modules"] == payload["debug_meta"]["images"]
    assert request["apply_source_context"] is False
    assert request["stacktraces"] == [
        {
            "frames": [
                {
                    "instruction_addr": "0x100001000",
                    "custom": "retained",
                    "adjust_instruction_addr": False,
                }
            ]
        },
        {
            "frames": [
                {
                    "instruction_addr": "0x100001200",
                    "function": "unresolved",
                    "adjust_instruction_addr": False,
                }
            ]
        },
    ]
    assert result is data
    processed = orjson.loads(next(get_attachments_for_event(data)).load_data(symbolicator.project))
    assert processed["frames"][0]["function"] == "outer"
    assert processed["frames"][0]["instruction_addr"] == "0x100001000"
    assert processed["frames"][0]["addr_mode"] == "abs"
    assert processed["frames"][1] == original["frames"][1]
    assert processed["frames"][2]["function"] == "inlined"
    root = processed["trees"][0]["roots"][0]
    assert root["sample_count"] == 10
    assert root["children"][0]["frame_id"] == 2
    assert root["children"][0]["sample_count"] == 10
    recursive = root["children"][0]["children"][0]
    assert recursive["frame_id"] == 0
    assert recursive["children"][0]["sample_count"] == 6
    assert recursive["children"][0]["children"] == [{"frame_id": 1, "sample_count": 4}]
    assert processed["debug_meta"] == original["debug_meta"]
    assert processed["custom"] == "retained"
    assert processed["_symbolication"]["frames"] == original["frames"]
    assert processed["_symbolication"]["trees"] == original["trees"]


@django_db_all
def test_flamegraph_symbolication_is_idempotent(cached_flamegraph) -> None:
    data, _, symbolicator = cached_flamegraph
    with Feature({"organizations:flamegraph-attachments": True}):
        process_native_stacktraces(symbolicator, data)
        before = next(get_attachments_for_event(data)).load_data(symbolicator.project)
        assert process_native_stacktraces(symbolicator, data) is None
    symbolicator.process_payload.assert_called_once()
    assert next(get_attachments_for_event(data)).load_data(symbolicator.project) == before


def test_route_flamegraph_to_native_symbolication() -> None:
    data = {"platform": "other", "_attachments": [{"type": "event.flamegraph"}]}
    assert get_native_symbolication_functions(data, []) == [SymbolicatorFunction.native]


@pytest.fixture
def cached_flamegraph(default_project):
    payload = {
        "version": "1",
        "platform": "cocoa",
        "frames": [{"instruction_addr": "0x100001000", "data": {"custom": "retained"}}],
        "debug_meta": {
            "images": [{"type": "macho", "debug_id": "84a04d24-0e60-3810-a8c0-90a65e2df61a"}]
        },
        "trees": [{"roots": [{"frame_id": 0, "sample_count": 10}]}],
    }
    data = {
        "platform": "other",
        "project": default_project.id,
        "event_id": "cc3e6c2bb6b6498097f336d1e6979f4b",
    }
    store_attachments_for_event(
        default_project,
        data,
        [
            CachedAttachment(
                type="event.flamegraph",
                name="flamegraph.json",
                content_type="application/json",
                data=orjson.dumps(payload),
            )
        ],
        timeout=60,
    )
    symbolicator = mock.Mock(project=default_project)
    symbolicator.process_payload.return_value = {
        "status": "completed",
        "stacktraces": [
            {
                "frames": [
                    {"status": "symbolicated", "function": "outer"},
                    {"status": "symbolicated", "function": "inner"},
                ]
            }
        ],
    }
    return data, payload, symbolicator


@django_db_all
def test_flamegraph_feature_disabled(cached_flamegraph) -> None:
    data, payload, symbolicator = cached_flamegraph
    with Feature({"organizations:flamegraph-attachments": False}):
        assert process_native_stacktraces(symbolicator, data) is None
    symbolicator.process_payload.assert_not_called()
    assert next(get_attachments_for_event(data)).load_data(symbolicator.project) == orjson.dumps(
        payload
    )


@django_db_all
def test_flamegraph_frame_limit(cached_flamegraph) -> None:
    data, payload, symbolicator = cached_flamegraph
    payload["frames"] *= 2501
    store_attachments_for_event(
        symbolicator.project,
        data,
        [
            CachedAttachment(
                type="event.flamegraph",
                data=orjson.dumps(payload),
            )
        ],
        timeout=60,
    )
    symbolicator.process_payload.return_value = {
        "status": "completed",
        "stacktraces": [{"frames": []}] * 2500,
    }
    with Feature({"organizations:flamegraph-attachments": True}):
        process_native_stacktraces(symbolicator, data)
    assert len(symbolicator.process_payload.call_args.kwargs["stacktraces"]) == 2500
    processed = orjson.loads(next(get_attachments_for_event(data)).load_data(symbolicator.project))
    assert processed["frames"] == payload["frames"]
    assert processed["trees"] == payload["trees"]


@django_db_all
@pytest.mark.parametrize(
    "response",
    [{"status": "failed"}, {"status": "pending"}, {"status": "completed", "stacktraces": []}],
)
def test_flamegraph_failure_preserves_attachment(cached_flamegraph, response) -> None:
    data, payload, symbolicator = cached_flamegraph
    symbolicator.process_payload.return_value = response
    with Feature({"organizations:flamegraph-attachments": True}):
        assert process_native_stacktraces(symbolicator, data) is None
    assert next(get_attachments_for_event(data)).load_data(symbolicator.project) == orjson.dumps(
        payload
    )


@django_db_all
@pytest.mark.parametrize(
    "raw", [b"invalid json", b"null", b'{"version":"2"}', b" " * (10 * 1024 * 1024 + 1)]
)
def test_flamegraph_invalid_attachment(cached_flamegraph, raw) -> None:
    data, _, symbolicator = cached_flamegraph
    store_attachments_for_event(
        symbolicator.project,
        data,
        [
            CachedAttachment(
                type="event.flamegraph",
                data=raw,
            )
        ],
        timeout=60,
    )
    with Feature({"organizations:flamegraph-attachments": True}):
        assert process_native_stacktraces(symbolicator, data) is None
    symbolicator.process_payload.assert_not_called()
    assert next(get_attachments_for_event(data)).load_data(symbolicator.project) == raw


@django_db_all
@pytest.mark.parametrize(
    "root",
    [
        {"frame_id": 1, "sample_count": 10},
        {"frame_id": True, "sample_count": 10},
        {"frame_id": 0, "sample_count": 0},
        {"frame_id": 0, "sample_count": True},
        {"frame_id": 0, "sample_count": 9007199254740992},
        {"frame_id": 0, "sample_count": 10, "children": "invalid"},
        {"frame_id": 0, "sample_count": 10, "children": [{"frame_id": 0, "sample_count": 11}]},
    ],
)
def test_flamegraph_invalid_tree_is_not_symbolicated(cached_flamegraph, root) -> None:
    data, payload, symbolicator = cached_flamegraph
    payload["trees"][0]["roots"] = [root]
    raw = orjson.dumps(payload)
    store_attachments_for_event(
        symbolicator.project,
        data,
        [CachedAttachment(type="event.flamegraph", data=raw)],
        timeout=60,
    )
    with Feature({"organizations:flamegraph-attachments": True}):
        assert process_native_stacktraces(symbolicator, data) is None
    symbolicator.process_payload.assert_not_called()
    assert next(get_attachments_for_event(data)).load_data(symbolicator.project) == raw


@django_db_all
def test_flamegraph_reprocessing_uses_original_tables(cached_flamegraph) -> None:
    data, payload, symbolicator = cached_flamegraph
    with Feature({"organizations:flamegraph-attachments": True}):
        process_native_stacktraces(symbolicator, data)
    processed = orjson.loads(next(get_attachments_for_event(data)).load_data(symbolicator.project))
    processed["_symbolication"]["status"] = "pending"
    store_attachments_for_event(
        symbolicator.project,
        data,
        [
            CachedAttachment(
                type="event.flamegraph",
                data=orjson.dumps(processed),
            )
        ],
        timeout=60,
    )
    with Feature({"organizations:flamegraph-attachments": True}):
        process_native_stacktraces(symbolicator, data)
    processed = orjson.loads(next(get_attachments_for_event(data)).load_data(symbolicator.project))
    assert len(processed["frames"]) == 2
    assert processed["trees"] == [
        {
            "roots": [
                {
                    "frame_id": 0,
                    "sample_count": 10,
                    "children": [{"frame_id": 1, "sample_count": 10}],
                }
            ]
        }
    ]
    assert processed["_symbolication"]["frames"] == payload["frames"]
    assert processed["_symbolication"]["trees"] == payload["trees"]
    assert symbolicator.process_payload.call_count == 2


@django_db_all
@requires_objectstore
def test_flamegraph_objectstore_attachment(cached_flamegraph) -> None:
    data, payload, symbolicator = cached_flamegraph
    session = get_session(UsecaseId.ATTACHMENTS, symbolicator.project)
    stored_id = session.put(orjson.dumps(payload))
    store_attachments_for_event(
        symbolicator.project,
        data,
        [
            CachedAttachment(
                type="event.flamegraph",
                name="flamegraph.json",
                content_type="application/json",
                stored_id=stored_id,
                size=len(orjson.dumps(payload)),
                retention_days=7,
            )
        ],
        timeout=60,
    )
    with Feature({"organizations:flamegraph-attachments": True}):
        process_native_stacktraces(symbolicator, data)
    attachment = next(get_attachments_for_event(data))
    assert attachment.stored_id == stored_id
    assert attachment.retention_days == 7
    stored = session.get(stored_id)
    assert stored is not None
    processed = orjson.loads(stored.payload.read())
    assert processed["frames"][0]["function"] == "outer"
    assert processed["frames"][1]["function"] == "inner"
    assert attachment.size == len(orjson.dumps(processed))


@pytest.fixture
def multiple_flamegraphs(cached_flamegraph):
    data, payload, symbolicator = cached_flamegraph
    second = deepcopy(payload)
    second["debug_meta"]["images"][0]["debug_id"] = "502fc0a5-1ec1-3e47-9998-684fa139dca7"
    store_attachments_for_event(
        symbolicator.project,
        data,
        [
            CachedAttachment(type="event.flamegraph", data=orjson.dumps(payload)),
            CachedAttachment(type="event.attachment", name="other.txt", data=b"unchanged"),
            CachedAttachment(type="event.flamegraph", data=orjson.dumps(second)),
        ],
        timeout=60,
    )
    return data, payload, second, symbolicator


@django_db_all
def test_flamegraph_multiple_attachments(multiple_flamegraphs) -> None:
    data, first, second, symbolicator = multiple_flamegraphs
    with Feature({"organizations:flamegraph-attachments": True}):
        assert process_native_stacktraces(symbolicator, data) is data
    assert symbolicator.process_payload.call_count == 2
    first_request, second_request = symbolicator.process_payload.call_args_list
    assert first_request.kwargs["modules"] == first["debug_meta"]["images"]
    assert second_request.kwargs["modules"] == second["debug_meta"]["images"]
    first_attachment, other_attachment, second_attachment = get_attachments_for_event(data)
    first_processed = orjson.loads(first_attachment.load_data(symbolicator.project))
    second_processed = orjson.loads(second_attachment.load_data(symbolicator.project))
    assert first_processed["frames"][0]["function"] == "outer"
    assert second_processed["frames"][0]["function"] == "outer"
    assert first_processed["_symbolication"]["status"] == "completed"
    assert second_processed["_symbolication"]["status"] == "completed"
    assert other_attachment.load_data(symbolicator.project) == b"unchanged"


@django_db_all
@requires_objectstore
def test_flamegraph_checkpoints_do_not_rewrite_processed_objects(multiple_flamegraphs) -> None:
    data, first, second, symbolicator = multiple_flamegraphs
    session = get_session(UsecaseId.ATTACHMENTS, symbolicator.project)
    first_id = session.put(orjson.dumps(first))
    second_id = session.put(orjson.dumps(second))
    store_attachments_for_event(
        symbolicator.project,
        data,
        [
            CachedAttachment(type="event.flamegraph", stored_id=first_id),
            CachedAttachment(type="event.flamegraph", stored_id=second_id),
        ],
        timeout=60,
    )
    with (
        Feature({"organizations:flamegraph-attachments": True}),
        mock.patch("sentry.attachments.base.get_session", return_value=session),
        mock.patch.object(session, "put", wraps=session.put) as put,
    ):
        assert process_native_stacktraces(symbolicator, data) is data
    assert put.call_count == 2
    assert [call.kwargs["key"] for call in put.call_args_list] == [first_id, second_id]


@django_db_all
def test_flamegraph_checkpoint_survives_later_timeout(multiple_flamegraphs) -> None:
    from sentry.tasks.symbolication import SymbolicationTimeout

    data, _, second, symbolicator = multiple_flamegraphs
    symbolicator.process_payload.side_effect = [
        symbolicator.process_payload.return_value,
        SymbolicationTimeout(),
    ]
    with Feature({"organizations:flamegraph-attachments": True}):
        with pytest.raises(SymbolicationTimeout):
            process_native_stacktraces(symbolicator, data)
    assert symbolicator.process_payload.call_count == 2
    first_attachment, other_attachment, second_attachment = get_attachments_for_event(data)
    first_processed = orjson.loads(first_attachment.load_data(symbolicator.project))
    assert first_processed["frames"][0]["function"] == "outer"
    assert first_processed["_symbolication"]["status"] == "completed"
    assert other_attachment.load_data(symbolicator.project) == b"unchanged"
    assert second_attachment.load_data(symbolicator.project) == orjson.dumps(second)


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
