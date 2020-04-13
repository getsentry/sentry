"""
This file is intended for unit tests that don't require fixtures or a live
service. Most tests live in tests/symbolicator/
"""

from __future__ import absolute_import

import pytest

from sentry.models.eventerror import EventError

from sentry.lang.native.processing import _merge_image


def test_merge_symbolicator_image_empty():
    errors = []
    _merge_image({}, {}, None, errors.append)
    assert not errors


def test_merge_symbolicator_image_basic():
    raw_image = {"instruction_addr": 0xFEEBEE, "other": "foo"}
    sdk_info = {"sdk_name": "linux"}
    complete_image = {
        "debug_status": "found",
        "unwind_status": "found",
        "other2": "bar",
        "arch": "unknown",
    }
    errors = []

    _merge_image(raw_image, complete_image, sdk_info, errors.append)

    assert not errors
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
    errors = []

    _merge_image(raw_image, complete_image, sdk_info, errors.append)

    assert not errors
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
    errors = []

    _merge_image(raw_image, complete_image, sdk_info, errors.append)

    assert not errors
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
    errors = []

    _merge_image(raw_image, complete_image, sdk_info, errors.append)

    (e,) = errors

    assert e.image_name == "foo"
    assert e.type == error

    assert raw_image == {
        "debug_status": "found",
        "unwind_status": "missing",
        "instruction_addr": 0xFEEBEE,
        "other": "foo",
        "other2": "bar",
        "code_file": code_file,
    }
