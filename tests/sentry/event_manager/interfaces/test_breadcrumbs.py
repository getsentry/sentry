from typing import Any

import pytest

from sentry.event_manager import EventManager
from sentry.services import eventstore
from sentry.testutils.pytest.fixtures import InstaSnapshotter, django_db_all
from tests.sentry.event_manager.interfaces import CustomSnapshotter as CustomSnapshotterBase

SnapshotInput = dict[str, Any]
CustomSnapshotter = CustomSnapshotterBase[SnapshotInput]


@pytest.fixture
def make_breadcrumbs_snapshot(insta_snapshot: InstaSnapshotter) -> CustomSnapshotter:
    def inner(data: SnapshotInput) -> None:
        mgr = EventManager(data={"breadcrumbs": data})
        mgr.normalize()
        evt = eventstore.backend.create_event(project_id=1, data=mgr.get_data())
        breadcrumbs = evt.interfaces.get("breadcrumbs")

        insta_snapshot(
            {"errors": evt.data.get("errors"), "to_json": breadcrumbs and breadcrumbs.to_json()}
        )

    return inner


def test_simple(make_breadcrumbs_snapshot: CustomSnapshotter) -> None:
    make_breadcrumbs_snapshot(
        dict(
            values=[
                {
                    "type": "message",
                    "timestamp": 1458857193.973275,
                    "data": {"message": "Whats up dawg?"},
                }
            ]
        )
    )


@django_db_all
@pytest.mark.parametrize(
    "input",
    [
        {},
        {"values": []},
        # TODO(markus): The following cases should eventually generate {"values": [None]}
        {"values": [{}]},
        {"values": [{"type": None}]},
        {"values": [None]},
    ],
)
def test_null_values(make_breadcrumbs_snapshot: CustomSnapshotter, input: SnapshotInput) -> None:
    make_breadcrumbs_snapshot(input)


@django_db_all
def test_non_string_keys(make_breadcrumbs_snapshot: CustomSnapshotter) -> None:
    make_breadcrumbs_snapshot(
        dict(
            values=[
                {
                    "type": "message",
                    "timestamp": 1458857193.973275,
                    "data": {"extra": {"foo": "bar"}},
                }
            ]
        )
    )


def test_string_data(make_breadcrumbs_snapshot: CustomSnapshotter) -> None:
    make_breadcrumbs_snapshot(
        dict(
            values=[
                {"type": "message", "timestamp": 1458857193.973275, "data": "must be a mapping"}
            ]
        )
    )
