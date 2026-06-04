from typing import Any

import pytest

from sentry.event_manager import EventManager
from sentry.services import eventstore
from sentry.testutils.pytest.fixtures import InstaSnapshotter
from tests.sentry.event_manager.interfaces import CustomSnapshotter as CustomSnapshotterBase

SnapshotInput = dict[str, Any]
CustomSnapshotter = CustomSnapshotterBase[SnapshotInput]


@pytest.fixture
def make_user_snapshot(insta_snapshot: InstaSnapshotter) -> CustomSnapshotter:
    def inner(data: SnapshotInput) -> None:
        mgr = EventManager(data={"user": data})
        mgr.normalize()
        evt = eventstore.backend.create_event(project_id=1, data=mgr.get_data())

        interface = evt.interfaces.get("user")

        insta_snapshot(
            {"errors": evt.data.get("errors"), "to_json": interface and interface.to_json()}
        )

    return inner


def test_null_values(make_user_snapshot: CustomSnapshotter) -> None:
    make_user_snapshot({})


def test_serialize_behavior(make_user_snapshot: CustomSnapshotter) -> None:
    make_user_snapshot(dict(id=1, email="lol@example.com", favorite_color="brown"))


def test_invalid_ip_address(make_user_snapshot: CustomSnapshotter) -> None:
    make_user_snapshot(dict(ip_address="abc"))


@pytest.mark.parametrize("email", [1, "foo"])
def test_invalid_email_address(make_user_snapshot: CustomSnapshotter, email: int | str) -> None:
    make_user_snapshot(dict(email=email))


def test_extra_keys(make_user_snapshot: CustomSnapshotter) -> None:
    make_user_snapshot({"extra1": "foo", "data": {"extra2": "bar"}})
