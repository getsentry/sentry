from typing import Any

import pytest

from sentry.event_manager import EventManager
from sentry.services import eventstore
from sentry.testutils.pytest.fixtures import InstaSnapshotter
from tests.sentry.event_manager.interfaces import CustomSnapshotter as CustomSnapshotterBase

SnapshotInput = dict[str, Any]
CustomSnapshotter = CustomSnapshotterBase[SnapshotInput]


@pytest.fixture
def make_geo_snapshot(insta_snapshot: InstaSnapshotter) -> CustomSnapshotter:
    def inner(data: SnapshotInput) -> None:
        mgr = EventManager(data={"user": {"id": "123", "geo": data}})
        mgr.normalize()
        evt = eventstore.backend.create_event(project_id=1, data=mgr.get_data())

        interface = evt.interfaces["user"].geo
        insta_snapshot(
            {"errors": evt.data.get("errors"), "to_json": interface and interface.to_json()}
        )

    return inner


def test_serialize_behavior(make_geo_snapshot: CustomSnapshotter) -> None:
    make_geo_snapshot({"country_code": "US", "city": "San Francisco", "region": "CA"})


@pytest.mark.parametrize("input", [{}, {"country_code": None}, {"city": None}, {"region": None}])
def test_null_values(make_geo_snapshot: CustomSnapshotter, input: SnapshotInput) -> None:
    make_geo_snapshot(input)
