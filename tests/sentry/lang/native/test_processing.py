"""
This file is intended for unit tests that don't require fixtures or a live
service. Most tests live in tests/symbolicator/
"""


from unittest import mock

import pytest

from sentry.lang.native.processing import (
    _merge_image,
    get_frames_for_symbolication,
    process_payload,
)
from sentry.models.eventerror import EventError
from sentry.utils.safe import get_path


def test_merge_symbolicator_image_empty():
    data = {}
    _merge_image({}, {}, None, data)
    assert not data.get("errors")


def test_merge_symbolicator_image_basic():
    raw_image = {"instruction_addr": 0xFEEBEE, "other": "foo"}
    sdk_info = {"sdk_name": "linux"}
    complete_image = {
        "debug_status": "found",
        "unwind_status": "found",
        "other2": "bar",
        "arch": "unknown",
    }

    data = {}

    _merge_image(raw_image, complete_image, sdk_info, data)

    assert not data.get("errors")
    assert raw_image == {
        "debug_status": "found",
        "unwind_status": "found",
        "instruction_addr": 0xFEEBEE,
        "other": "foo",
        "other2": "bar",
    }


def test_merge_symbolicator_image_basic_success():
    raw_image = {"instruction_addr": 0xFEEBEE, "other": "foo"}
    sdk_info = {"sdk_name": "linux"}
    complete_image = {
        "debug_status": "found",
        "unwind_status": "found",
        "other2": "bar",
        "arch": "foo",
    }
    data = {}

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


def test_merge_symbolicator_image_remove_unknown_arch():
    raw_image = {"instruction_addr": 0xFEEBEE}
    sdk_info = {"sdk_name": "linux"}
    complete_image = {"debug_status": "found", "unwind_status": "found", "arch": "unknown"}
    data = {}

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
def test_merge_symbolicator_image_errors(code_file, error):
    raw_image = {"instruction_addr": 0xFEEBEE, "other": "foo", "code_file": code_file}
    sdk_info = {"sdk_name": "macos"}
    complete_image = {
        "debug_status": "found",
        "unwind_status": "missing",
        "other2": "bar",
        "arch": "unknown",
    }
    data = {}

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


@pytest.mark.django_db
@mock.patch("sentry.lang.native.processing.Symbolicator")
def test_cocoa_function_name(mock_symbolicator, default_project):

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

    process_payload(data)

    function_name = get_path(data, "exception", "values", 0, "stacktrace", "frames", 0, "function")
    assert function_name == "thunk for closure"


def test_filter_frames():

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
