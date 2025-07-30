import pytest

from sentry import eventstore
from sentry.event_manager import EventManager
from sentry.testutils.pytest.fixtures import django_db_all


@pytest.fixture
def make_frames_snapshot(insta_snapshot):
    def inner(data):
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
def test_bad_input(make_frames_snapshot, input):
    make_frames_snapshot(input)


@django_db_all
@pytest.mark.parametrize(
    "x", [float("inf"), float("-inf"), float("nan")], ids=["inf", "neginf", "nan"]
)
def test_context_with_nan(make_frames_snapshot, x):
    make_frames_snapshot({"filename": "x", "vars": {"x": x}})


def test_address_normalization(make_frames_snapshot):
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


@django_db_all
def test_asynchronous_suspension_frame_symbolicated():
    """Test that asynchronous suspension frames are automatically marked as symbolicated."""
    # Test with filename = <asynchronous suspension>
    mgr = EventManager(
        data={
            "stacktrace": {
                "frames": [
                    {
                        "filename": "<asynchronous suspension>",
                        "abs_path": "<asynchronous suspension>",
                        "in_app": False,
                        "data": {"orig_in_app": -1},
                    }
                ]
            }
        }
    )
    mgr.normalize()
    evt = eventstore.backend.create_event(project_id=1, data=mgr.get_data())
    frame = evt.interfaces["stacktrace"].frames[0]

    # Check that the frame has symbolicatorStatus set to "symbolicated"
    api_context = frame.get_api_context()
    assert api_context["symbolicatorStatus"] == "symbolicated"

    # Test with abs_path = <asynchronous suspension> and different filename
    mgr2 = EventManager(
        data={
            "stacktrace": {
                "frames": [
                    {
                        "filename": "some_file.dart",
                        "abs_path": "<asynchronous suspension>",
                        "in_app": False,
                        "data": {"orig_in_app": -1},
                    }
                ]
            }
        }
    )
    mgr2.normalize()
    evt2 = eventstore.backend.create_event(project_id=1, data=mgr2.get_data())
    frame2 = evt2.interfaces["stacktrace"].frames[0]

    # Check that the frame has symbolicatorStatus set to "symbolicated"
    api_context2 = frame2.get_api_context()
    assert api_context2["symbolicatorStatus"] == "symbolicated"
