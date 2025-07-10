import pytest

from sentry.replays.usecases.ingest import extract_trace_id


@pytest.mark.parametrize(
    "replay_event,expected",
    [
        ({"trace_ids": ["a"]}, "a"),
        ({"trace_ids": ["a", "a"]}, None),
        ({"trace_ids": []}, None),
        ({}, None),
        (None, None),
    ],
)
def test_extract_trace_id(replay_event, expected):
    """Test "extract_trace_id" function."""
    assert extract_trace_id(replay_event) == expected
