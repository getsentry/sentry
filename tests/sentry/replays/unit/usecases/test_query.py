from datetime import UTC, datetime

import pytest
from rest_framework.exceptions import ParseError

from sentry.api.event_search import parse_search_query
from sentry.replays.lib.new_query.fields import FieldProtocol
from sentry.replays.query import replay_url_parser_config
from sentry.replays.usecases.query import (
    _make_ordered,
    handle_search_filters,
    make_full_aggregation_query,
)
from sentry.replays.usecases.query.configs.aggregate import search_config as agg_search_config
from sentry.replays.usecases.query.configs.scalar import scalar_search_config


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


@pytest.mark.parametrize(
    ("query", "message"),
    [
        ("AND user.email:a", "Condition is missing on the left side of 'AND' operator"),
        ("OR user.email:a", "Condition is missing on the left side of 'OR' operator"),
        ("user.email:a AND", "Condition is missing on the right side of 'AND' operator"),
        ("user.email:a OR", "Condition is missing on the right side of 'OR' operator"),
        (
            "user.email:a AND OR user.email:b",
            "Missing condition in between two condition operators: 'AND OR'",
        ),
        (
            "(OR user.email:a) user.email:b",
            "Condition is missing on the left side of 'OR' operator",
        ),
    ],
)
@pytest.mark.parametrize("search_config", [agg_search_config, scalar_search_config])
def test_handle_search_filters_invalid_boolean_operators(
    search_config: dict[str, FieldProtocol], query: str, message: str
) -> None:
    search_filters = parse_search_query(query, config=replay_url_parser_config)

    with pytest.raises(ParseError) as exc_info:
        handle_search_filters(search_config, search_filters)

    assert exc_info.value.detail == message


@pytest.mark.parametrize(
    "query",
    [
        "user.email:a AND user.email:b",
        "user.email:a OR user.email:b",
        "(user.email:a OR user.email:b) AND (user.email:c OR user.email:d)",
        "(user.email:a OR user.email:b) OR (user.email:c user.email:d)",
    ],
)
def test_handle_search_filters_valid_boolean_operators(query: str) -> None:
    search_filters = parse_search_query(query, config=replay_url_parser_config)
    assert handle_search_filters(agg_search_config, search_filters)


@pytest.mark.parametrize(
    ("period_start", "period_end"),
    [
        (datetime(2026, 1, 1, tzinfo=UTC), datetime(9999, 12, 31, 23, 59, 59, tzinfo=UTC)),
        (datetime(1, 1, 1, tzinfo=UTC), datetime(2026, 1, 1, tzinfo=UTC)),
    ],
)
def test_make_full_aggregation_query_out_of_range_dates(
    period_start: datetime, period_end: datetime
) -> None:
    with pytest.raises(ParseError) as exc_info:
        make_full_aggregation_query(
            fields=["id"],
            replay_ids=["a"],
            project_ids=[1],
            period_start=period_start,
            period_end=period_end,
            request_user_id=None,
        )

    assert exc_info.value.detail == "Invalid date range: start or end is out of range"
