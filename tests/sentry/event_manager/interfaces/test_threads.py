from typing import Any

import pytest

from sentry.event_manager import EventManager
from sentry.services import eventstore
from sentry.testutils.pytest.fixtures import InstaSnapshotter
from tests.sentry.event_manager.interfaces import CustomSnapshotter as CustomSnapshotterBase

SnapshotInput = dict[str, Any]
CustomSnapshotter = CustomSnapshotterBase[SnapshotInput]


@pytest.fixture
def make_threads_snapshot(insta_snapshot: InstaSnapshotter) -> CustomSnapshotter:
    def inner(data: SnapshotInput) -> None:
        mgr = EventManager(data={"threads": data})
        mgr.normalize()
        evt = eventstore.backend.create_event(project_id=1, data=mgr.get_data())

        interface = evt.interfaces.get("threads")
        insta_snapshot(
            {
                "errors": evt.data.get("errors"),
                "to_json": interface and interface.to_json(),
                "api_context": interface and interface.get_api_context(),
            }
        )

    return inner


basic_payload = dict(
    values=[
        {
            "id": 42,
            "crashed": False,
            "current": True,
            "name": "Main Thread",
            "state": "RUNNABLE",
            "stacktrace": {
                "frames": [
                    {"filename": "foo/baz.c", "function": "main", "lineno": 1, "in_app": True}
                ]
            },
            "raw_stacktrace": {
                "frames": [
                    {"filename": None, "lineno": 1, "function": "<redacted>", "in_app": True}
                ]
            },
            "held_locks": {
                "0x0d3a2f0a": {
                    "type": 8,
                    "address": "0x0d3a2f0a",
                    "package_name": "java.lang",
                    "class_name": "Object",
                    "thread_id": 11,
                },
            },
        }
    ]
)


def test_basics(make_threads_snapshot: CustomSnapshotter) -> None:
    make_threads_snapshot(basic_payload)


@pytest.mark.parametrize(
    "input",
    [
        {"values": [{}]},
        {"values": [{"id": None}]},
        {"values": [{"name": None}]},
        {"values": [{"stacktrace": None}]},
        {"values": [{"state": None}]},
        {"values": [{"held_locks": None}]},
    ],
)
def test_null_values(make_threads_snapshot: CustomSnapshotter, input: SnapshotInput) -> None:
    make_threads_snapshot(input)
