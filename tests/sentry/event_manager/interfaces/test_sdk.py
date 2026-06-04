from typing import Any

import pytest

from sentry.event_manager import EventManager
from sentry.services import eventstore
from sentry.testutils.pytest.fixtures import InstaSnapshotter
from tests.sentry.event_manager.interfaces import CustomSnapshotter as CustomSnapshotterBase

SnapshotInput = dict[str, Any]
CustomSnapshotter = CustomSnapshotterBase[SnapshotInput]


@pytest.fixture
def make_sdk_snapshot(insta_snapshot: InstaSnapshotter) -> CustomSnapshotter:
    def inner(data: SnapshotInput) -> None:
        mgr = EventManager(data={"sdk": data})
        mgr.normalize()
        evt = eventstore.backend.create_event(project_id=1, data=mgr.get_data())
        sdk_interface = evt.interfaces.get("sdk")
        to_json_data = sdk_interface.to_json() if sdk_interface else None
        insta_snapshot({"errors": evt.data.get("errors"), "to_json": to_json_data})

    return inner


def test_serialize_behavior(make_sdk_snapshot: CustomSnapshotter) -> None:
    make_sdk_snapshot(
        {
            "name": "sentry-java",
            "version": "1.0",
            "integrations": ["log4j"],
            "packages": [{"name": "maven:io.sentry.sentry", "version": "1.7.10"}],
        }
    )


def test_missing_name(make_sdk_snapshot: CustomSnapshotter) -> None:
    make_sdk_snapshot({"version": "1.0"})


def test_missing_version(make_sdk_snapshot: CustomSnapshotter) -> None:
    make_sdk_snapshot({"name": "sentry-unity"})
