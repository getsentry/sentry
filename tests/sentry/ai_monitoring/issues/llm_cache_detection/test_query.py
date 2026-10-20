from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from unittest import mock

import pytest

from sentry.ai_monitoring.issues.llm_cache_detection import query as query_module
from sentry.ai_monitoring.issues.llm_cache_detection.detection import (
    AgentLabelSource,
    DetectionWindow,
    ReuseBoundary,
)
from sentry.ai_monitoring.issues.llm_cache_detection.query import (
    AGENT_NAME,
    AVG_INPUT_TOKENS,
    CACHE_CREATION_TOKENS,
    CACHE_READ_TOKENS,
    CACHEABLE_CALL_FILTER,
    CALL_SITE_GROUPS_LIMIT,
    CONVERSATION_FILTER,
    COUNT,
    COUNT_SAMPLE,
    INPUT_TOKENS,
    MODEL,
    SAMPLE_CALLS_LIMIT,
    SPAN_NAME,
    SUM_CACHE_CREATION_TOKENS,
    SUM_CACHE_READ_TOKENS,
    SUM_INPUT_TOKENS,
    TRACE_FALLBACK_FILTER,
    DroppedRowReason,
    _build_group_filter,
    _count_unique,
    _to_call_sites,
    count_spans_with_cache_attributes,
    fetch_call_site_stats,
    fetch_call_site_warmth,
    fetch_sample_calls,
)
from sentry.models.project import Project
from sentry.search.events.types import SnubaRow
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans


def make_row(**changes: object) -> SnubaRow:
    row: SnubaRow = {
        AGENT_NAME: "Reviewer",
        SPAN_NAME: "generate_content",
        MODEL: "model-x",
        COUNT: 100,
        COUNT_SAMPLE: 10,
        _count_unique(ReuseBoundary.CONVERSATION): 5,
        _count_unique(ReuseBoundary.TRACE): 5,
        SUM_INPUT_TOKENS: 10_000,
        SUM_CACHE_READ_TOKENS: 2_000,
        SUM_CACHE_CREATION_TOKENS: 1_000,
        AVG_INPUT_TOKENS: 100,
    }
    row.update(changes)
    return row


def test_to_call_sites_combines_duplicate_rows() -> None:
    rows = [
        make_row(),
        make_row(
            **{
                COUNT: 300,
                COUNT_SAMPLE: 20,
                SUM_INPUT_TOKENS: 90_000,
                SUM_CACHE_READ_TOKENS: 8_000,
                SUM_CACHE_CREATION_TOKENS: 4_000,
                AVG_INPUT_TOKENS: 300,
            }
        ),
        make_row(**{AGENT_NAME: None}),
    ]

    call_sites, dropped_calls = _to_call_sites(rows)

    assert dropped_calls == {DroppedRowReason.NO_LABEL: 100}
    assert len(call_sites) == 1
    stats = call_sites[0]
    assert stats.agent_label_source is AgentLabelSource.AGENT_NAME
    assert stats.call_count == 400
    assert stats.sampled_call_count == 30
    assert stats.unique_reuse_count == 10
    assert stats.repeated_sampled_call_count == 20
    assert stats.sum_input_tokens == 100_000
    assert stats.sum_cache_read_tokens == 10_000
    assert stats.sum_cache_creation_tokens == 5_000
    assert stats.avg_input_tokens == 250


def test_to_call_sites_counts_calls_with_incomplete_keys() -> None:
    rows = [
        make_row(**{AGENT_NAME: None, COUNT: 10}),
        make_row(**{SPAN_NAME: None, COUNT: 20}),
        make_row(**{MODEL: None, COUNT: 30}),
    ]

    call_sites, dropped_calls = _to_call_sites(rows)

    assert call_sites == []
    assert dropped_calls == {
        DroppedRowReason.NO_LABEL: 10,
        DroppedRowReason.NO_SPAN_NAME: 20,
        DroppedRowReason.NO_MODEL: 30,
    }


@pytest.mark.parametrize(("row_count", "truncated"), [(1, False), (300, True)])
def test_fetch_call_site_stats(row_count: int, truncated: bool) -> None:
    project = mock.Mock(spec=Project)
    project.organization = mock.Mock()
    window = DetectionWindow(
        start=datetime(2026, 1, 1, tzinfo=UTC),
        end=datetime(2026, 1, 8, tzinfo=UTC),
    )
    rows = [make_row()] * row_count

    with mock.patch.object(Spans, "run_table_query", return_value={"data": rows}) as run_query:
        result = fetch_call_site_stats(project, window)

    assert len(result.call_sites) == 1
    assert result.call_sites[0].call_count == row_count * 100
    assert result.call_sites[0].reuse_boundary is ReuseBoundary.CONVERSATION
    assert result.dropped_calls == {}
    assert result.truncated is truncated
    conversation, trace = (call.kwargs for call in run_query.call_args_list)
    assert conversation["params"].start == window.start
    assert conversation["params"].end == window.end
    assert conversation["params"].projects == [project]
    assert CONVERSATION_FILTER in conversation["query_string"]
    assert TRACE_FALLBACK_FILTER in trace["query_string"]
    assert conversation["selected_columns"] == [
        AGENT_NAME,
        SPAN_NAME,
        MODEL,
        COUNT,
        COUNT_SAMPLE,
        _count_unique(ReuseBoundary.CONVERSATION),
        SUM_INPUT_TOKENS,
        SUM_CACHE_READ_TOKENS,
        SUM_CACHE_CREATION_TOKENS,
        AVG_INPUT_TOKENS,
    ]
    assert _count_unique(ReuseBoundary.TRACE) in trace["selected_columns"]
    assert CACHEABLE_CALL_FILTER in conversation["query_string"]
    assert conversation["orderby"] == [f"-{SUM_INPUT_TOKENS}"]
    assert conversation["limit"] == CALL_SITE_GROUPS_LIMIT
    assert conversation["referrer"] == Referrer.ISSUES_LLM_CACHE_DETECTION.value
    assert conversation["sampling_mode"] == "HIGHEST_ACCURACY"


def test_fetch_call_site_stats_keeps_uncovered_trace_fallbacks() -> None:
    project = mock.Mock(spec=Project)
    project.organization = mock.Mock()
    window = DetectionWindow(
        start=datetime(2026, 1, 1, tzinfo=UTC),
        end=datetime(2026, 1, 8, tzinfo=UTC),
    )
    conversation = [make_row(**{MODEL: "covered"})]
    trace = [make_row(**{MODEL: "covered"}), make_row(**{MODEL: "fallback"})]

    with mock.patch.object(
        Spans,
        "run_table_query",
        side_effect=[{"data": conversation}, {"data": trace}],
    ):
        result = fetch_call_site_stats(project, window)

    assert [(stats.model, stats.reuse_boundary) for stats in result.call_sites] == [
        ("covered", ReuseBoundary.CONVERSATION),
        ("fallback", ReuseBoundary.TRACE),
    ]


def test_fetch_call_site_stats_applies_global_limit() -> None:
    project = mock.Mock(spec=Project)
    project.organization = mock.Mock()
    window = DetectionWindow(
        start=datetime(2026, 1, 1, tzinfo=UTC),
        end=datetime(2026, 1, 8, tzinfo=UTC),
    )
    rows = [
        make_row(**{MODEL: "high", SUM_INPUT_TOKENS: 400}),
        make_row(**{MODEL: "low", SUM_INPUT_TOKENS: 100}),
        make_row(**{MODEL: "medium", SUM_INPUT_TOKENS: 300}),
    ]

    with (
        mock.patch.object(query_module, "CALL_SITE_GROUPS_LIMIT", 2),
        mock.patch.object(Spans, "run_table_query", return_value={"data": rows}),
    ):
        result = fetch_call_site_stats(project, window)

    assert [stats.model for stats in result.call_sites] == ["high", "medium"]
    assert result.truncated


def test_build_group_filter() -> None:
    stats = _to_call_sites([make_row()])[0][0]

    assert _build_group_filter(stats) == (
        "gen_ai.operation.type:ai_client "
        "!gen_ai.operation.name:embeddings "
        "has:gen_ai.usage.input_tokens "
        "gen_ai.usage.input_tokens:>=4096 "
        'has:gen_ai.conversation.id !gen_ai.conversation.id:"" '
        'gen_ai.agent.name:"Reviewer" '
        'span.name:"generate_content" '
        'gen_ai.request.model:"model-x"'
    )
    assert _build_group_filter(replace(stats, model="invalid\\")) is None


def test_fetch_call_site_warmth() -> None:
    project = mock.Mock(spec=Project)
    project.organization = mock.Mock()
    window = DetectionWindow(
        start=datetime(2026, 1, 1, tzinfo=UTC),
        end=datetime(2026, 1, 8, tzinfo=UTC),
    )
    stats = _to_call_sites([make_row()])[0][0]
    unique_count = _count_unique(ReuseBoundary.CONVERSATION)
    processed = mock.Mock(
        timeseries=[
            {"time": 0, COUNT: 10, unique_count: 1},
            {"time": 300, COUNT: 0, unique_count: 0},
        ],
        sample_count=[{COUNT: 2}],
    )
    query_result = mock.Mock(data={"processed_timeseries": processed})

    with mock.patch.object(Spans, "run_timeseries_query", return_value=query_result) as run_query:
        warmth = fetch_call_site_warmth(project, stats, window)

    assert warmth is not None
    assert warmth.total_call_count == 10
    assert warmth.total_sample_count == 2
    assert warmth.warm_call_count == 5
    kwargs = run_query.call_args.kwargs
    assert kwargs["params"].granularity_secs == 300
    assert kwargs["y_axes"] == [COUNT, unique_count]
    assert kwargs["referrer"] == Referrer.ISSUES_LLM_CACHE_DETECTION.value


def test_count_spans_with_cache_attributes() -> None:
    project = mock.Mock(spec=Project)
    window = DetectionWindow(
        start=datetime(2026, 1, 1, tzinfo=UTC),
        end=datetime(2026, 1, 8, tzinfo=UTC),
    )
    stats = _to_call_sites([make_row()])[0][0]

    with mock.patch.object(
        query_module, "_run_spans_query", return_value={"data": [{COUNT: 7}]}
    ) as run_query:
        count = count_spans_with_cache_attributes(project, stats, window)

    assert count == 7
    kwargs = run_query.call_args.kwargs
    assert kwargs["selected_columns"] == [COUNT]
    assert kwargs["orderby"] is None
    assert kwargs["limit"] == 1
    assert f"(has:{CACHE_READ_TOKENS} OR has:{CACHE_CREATION_TOKENS})" in kwargs["query_string"]


def test_fetch_sample_calls_returns_one_call_per_trace() -> None:
    project = mock.Mock(spec=Project)
    window = DetectionWindow(
        start=datetime(2026, 1, 1, tzinfo=UTC),
        end=datetime(2026, 1, 8, tzinfo=UTC),
    )
    stats = _to_call_sites([make_row()])[0][0]
    rows = [
        {
            "trace": "trace-a",
            "id": "span-1",
            "timestamp": "2026-01-07T00:00:00Z",
            INPUT_TOKENS: 4_000,
            CACHE_READ_TOKENS: 100,
        },
        {"trace": "trace-a", "id": "span-2", "timestamp": "2026-01-06T00:00:00Z"},
        {"trace": "trace-b", "id": "span-3", "timestamp": "2026-01-05T00:00:00Z"},
        {"trace": "trace-c", "id": "span-4"},
    ]

    with mock.patch.object(
        query_module, "_run_spans_query", return_value={"data": rows}
    ) as run_query:
        samples = fetch_sample_calls(project, stats, window)

    assert samples is not None
    assert [(sample.trace_id, sample.span_id) for sample in samples] == [
        ("trace-a", "span-1"),
        ("trace-b", "span-3"),
    ]
    assert samples[0].input_tokens == 4_000
    assert samples[0].cache_read_tokens == 100
    assert samples[0].cache_creation_tokens == 0
    kwargs = run_query.call_args.kwargs
    assert kwargs["selected_columns"] == [
        "trace",
        "id",
        "timestamp",
        INPUT_TOKENS,
        CACHE_READ_TOKENS,
        CACHE_CREATION_TOKENS,
    ]
    assert kwargs["orderby"] == [f"-{INPUT_TOKENS}"]
    assert kwargs["limit"] == SAMPLE_CALLS_LIMIT * 3


def test_to_call_sites_treats_missing_token_aggregates_as_zero() -> None:
    row = make_row(
        **{
            SUM_INPUT_TOKENS: None,
            SUM_CACHE_READ_TOKENS: None,
            SUM_CACHE_CREATION_TOKENS: None,
            AVG_INPUT_TOKENS: None,
        }
    )

    call_sites, _ = _to_call_sites([row])

    assert call_sites[0].sum_input_tokens == 0
    assert call_sites[0].sum_cache_read_tokens == 0
    assert call_sites[0].sum_cache_creation_tokens == 0
    assert call_sites[0].avg_input_tokens == 0
