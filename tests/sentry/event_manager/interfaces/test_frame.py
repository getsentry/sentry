from typing import Any

import pytest

from sentry.event_manager import EventManager
from sentry.services import eventstore
from sentry.testutils.pytest.fixtures import InstaSnapshotter, django_db_all
from tests.sentry.event_manager.interfaces import CustomSnapshotter as CustomSnapshotterBase

SnapshotInput = dict[str, Any]
CustomSnapshotter = CustomSnapshotterBase[SnapshotInput]


@pytest.fixture
def make_frames_snapshot(insta_snapshot: InstaSnapshotter) -> CustomSnapshotter:
    def inner(data: SnapshotInput) -> None:
        mgr = EventManager(data={"stacktrace": {"frames": [data]}})
        mgr.normalize()
        evt = eventstore.backend.create_event(project_id=1, data=mgr.get_data())
        frame = evt.interfaces["stacktrace"].frames[0]

        insta_snapshot({"errors": evt.data.get("errors"), "to_json": frame.to_json()})

    return inner


@django_db_all
@pytest.mark.parametrize(
    "input",
    [
        {"filename": 1},
        {"filename": "foo", "abs_path": 1},
        {"function": 1},
        {"module": 1},
        {"function": "?"},
    ],
)
def test_bad_input(make_frames_snapshot: CustomSnapshotter, input: SnapshotInput) -> None:
    make_frames_snapshot(input)


@django_db_all
@pytest.mark.parametrize(
    "x", [float("inf"), float("-inf"), float("nan")], ids=["inf", "neginf", "nan"]
)
def test_context_with_nan(make_frames_snapshot: CustomSnapshotter, x: float) -> None:
    make_frames_snapshot({"filename": "x", "vars": {"x": x}})


def test_address_normalization(make_frames_snapshot: CustomSnapshotter) -> None:
    make_frames_snapshot(
        {
            "lineno": 1,
            "filename": "blah.c",
            "function": "main",
            "instruction_addr": 123456,
            "symbol_addr": "123450",
            "image_addr": "0x0",
        }
    )
