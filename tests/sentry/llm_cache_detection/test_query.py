from __future__ import annotations

from unittest.mock import MagicMock

from sentry.llm_cache_detection.detection import (
    CacheOutcome,
    CallSiteStats,
    resolve_with_cache_presence,
)
from sentry.llm_cache_detection.query import (
    _build_group_filter,
    count_spans_with_cache_attributes,
    fetch_sample_trace_ids,
)


def make_stats(
    *,
    transaction: str = "seer.some_task",
    span_description: str = "generate_content generate_structured",
    model: str = "model-x",
) -> CallSiteStats:
    return CallSiteStats(
        transaction=transaction,
        span_description=span_description,
        model=model,
        call_count=10_000,
        sum_input_tokens=1_000_000,
        sum_cache_read_tokens=0,
        sum_cache_creation_tokens=0,
        avg_input_tokens=100,
    )


def test_group_filter_escapes_wildcard() -> None:
    # Unescaped `*` silently degrades an exact match to a LIKE wildcard match.
    group_filter = _build_group_filter(make_stats(span_description="generate_content *"))

    assert group_filter is not None
    assert 'span.description:"generate_content \\*"' in group_filter


def test_group_filter_escapes_double_quote() -> None:
    group_filter = _build_group_filter(make_stats(transaction='say "hi" task'))

    assert group_filter is not None
    assert 'transaction:"say \\"hi\\" task"' in group_filter


def test_group_filter_none_for_backslash_values() -> None:
    # The search grammar never unescapes `\\`, so a value containing a
    # backslash cannot be expressed as an exact match at all.
    assert _build_group_filter(make_stats(transaction="C:\\jobs\\nightly")) is None


def test_backslash_value_resolves_unknown_without_querying() -> None:
    stats = make_stats(model="model\\x")
    project = MagicMock()

    count = count_spans_with_cache_attributes(project, stats)

    assert count is None
    assert resolve_with_cache_presence(CacheOutcome.NOT_CACHING, count) == CacheOutcome.UNKNOWN
    assert fetch_sample_trace_ids(project, stats) == []
