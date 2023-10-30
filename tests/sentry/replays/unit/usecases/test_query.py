from sentry.replays.usecases.query import _make_ordered


def test_make_ordered():
    """Test "_make_ordered" function."""
    # Assert ordered response.
    ordering = _make_ordered(["a", "b"], [{"replay_id": "a"}, {"replay_id": "b"}])
    assert len(ordering) == 2
    assert ordering[0]["replay_id"] == "a"
    assert ordering[1]["replay_id"] == "b"

    # Assert unordered response.
    ordering = _make_ordered(["b", "a"], [{"replay_id": "a"}, {"replay_id": "b"}])
    assert len(ordering) == 2
    assert ordering[0]["replay_id"] == "b"
    assert ordering[1]["replay_id"] == "a"

    # Assert accidental duplicate ordering key.
    ordering = _make_ordered(["b", "a", "a"], [{"replay_id": "a"}, {"replay_id": "b"}])
    assert len(ordering) == 2
    assert ordering[0]["replay_id"] == "b"
    assert ordering[1]["replay_id"] == "a"

    # Assert ordering key was not found.
    ordering = _make_ordered(["b", "a", "c"], [{"replay_id": "a"}, {"replay_id": "b"}])
    assert len(ordering) == 2
    assert ordering[0]["replay_id"] == "b"
    assert ordering[1]["replay_id"] == "a"

    # Assert missing result.
    ordering = _make_ordered(["b", "a"], [{"replay_id": "a"}])
    assert len(ordering) == 1
    assert ordering[0]["replay_id"] == "a"

    # Assert empty results returns no records.
    ordering = _make_ordered(["a"], [])
    assert len(ordering) == 0

    # Assert empty ordering keys returns empty results.
    ordering = _make_ordered([], [{"replay_id": "a"}])
    assert len(ordering) == 0

    ordering = _make_ordered(["a", "a", "b"], [{"replay_id": "a"}, {"replay_id": "b"}])
    assert len(ordering) == 2
