from snuba_sdk.conditions import Condition, Op
from snuba_sdk.expressions import Column

from sentry.replays.usecases.query import _make_ordered, handle_search_filters
from sentry.search.events.filter import parse_search_query
from sentry.search.events.types import ParamsType


def test_make_ordered() -> None:
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


def test_handle_search_filters_with_leading_or_operators() -> None:
    """Test that leading OR operators don't cause IndexError."""
    from sentry.replays.usecases.query.configs.scalar import scalar_search_config
    from sentry.search.events.filter import parse_search_query
    from sentry.replays.usecases.query.configs.scalar import varying_search_config

    # Test case from the bug report: "or or or url:/recommendation/*"
    # This should not raise IndexError
    search_query = "or or or url:/recommendation/*"
    search_filters = parse_search_query(search_query)
    
    # This should not raise an IndexError
    result = handle_search_filters(scalar_search_config, search_filters)
    
    # Should have exactly one condition (the url filter)
    assert len(result) == 1
    
    # Test with just one leading OR
    search_query = "or url:/test/*"
    search_filters = parse_search_query(search_query)
    result = handle_search_filters(scalar_search_config, search_filters)
    assert len(result) == 1
    
    # Test with multiple leading ORs and ANDs
    search_query = "or and or url:/test/*"
    search_filters = parse_search_query(search_query)
    result = handle_search_filters(scalar_search_config, search_filters)
    assert len(result) == 1
