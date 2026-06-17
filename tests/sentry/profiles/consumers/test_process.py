from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import msgpack
import pytest
from django.utils import timezone

from sentry.profiles.consumers.process.factory import process_profile_message
from sentry.profiles.task import _prepare_frames_from_profile
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json


@override_options({"profiling.killswitch.ingest-profiles": [{"project_id": "2"}]})
@pytest.mark.parametrize("headers", [{}, {"project_id": "1"}])
@patch("sentry.profiles.consumers.process.factory.process_profile_task.delay")
@django_db_all
def test_basic_profile_to_task(process_profile_task: MagicMock, headers: dict[str, str]) -> None:
    message_dict = {
        "organization_id": 1,
        "project_id": 1,
        "key_id": 1,
        "received": int(timezone.now().timestamp()),
        "payload": json.dumps({"platform": "android", "profile": ""}),
    }
    payload = msgpack.packb(message_dict)

    process_profile_message(payload, headers)

    process_profile_task.assert_called_with(
        payload=payload,
        sampled=True,
    )


@patch("sentry.profiles.consumers.process.factory.process_profile_task.delay")
@override_options({"profiling.killswitch.ingest-profiles": [{"project_id": "1"}]})
@django_db_all
def test_killswitch_project(process_profile_task: MagicMock) -> None:
    message_dict = {
        "organization_id": 1,
        "project_id": 1,
        "key_id": 1,
        "received": int(timezone.now().timestamp()),
        "payload": json.dumps({"platform": "android", "profile": ""}),
    }
    payload = msgpack.packb(message_dict)

    process_profile_message(payload, {"project_id": "1"})

    process_profile_task.assert_not_called()


def test_adjust_instruction_addr_sample_format() -> None:
    original_frames = [
        {"instruction_addr": "0xdeadbeef"},
        {"instruction_addr": "0xbeefdead"},
        {"instruction_addr": "0xfeedface"},
    ]
    profile: dict[str, Any] = {
        "version": "1",
        "platform": "cocoa",
        "profile": {
            "frames": original_frames.copy(),
            "stacks": [[1, 0], [0, 1, 2]],
        },
        "debug_meta": {"images": []},
    }

    _, stacktraces, _ = _prepare_frames_from_profile(profile, profile["platform"])
    assert profile["profile"]["stacks"] == [[3, 0], [4, 1, 2]]
    frames = stacktraces[0]["frames"]

    for i in range(3):
        assert frames[i] == original_frames[i]

    assert frames[3] == {"instruction_addr": "0xbeefdead", "adjust_instruction_addr": False}
    assert frames[4] == {"instruction_addr": "0xdeadbeef", "adjust_instruction_addr": False}


def test_adjust_instruction_addr_original_format() -> None:
    profile = {
        "platform": "cocoa",
        "sampled_profile": {
            "samples": [
                {
                    "frames": [
                        {"instruction_addr": "0xdeadbeef", "platform": "native"},
                        {"instruction_addr": "0xbeefdead", "platform": "native"},
                    ],
                }
            ]
        },
        "debug_meta": {"images": []},
    }

    _, stacktraces, _ = _prepare_frames_from_profile(profile, str(profile["platform"]))
    frames = stacktraces[0]["frames"]

    assert not frames[0]["adjust_instruction_addr"]
    assert "adjust_instruction_addr" not in frames[1]
