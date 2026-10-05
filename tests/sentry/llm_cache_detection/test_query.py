from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from sentry.llm_cache_detection.detection import (
    AgentLabelSource,
    CallSiteStats,
    DetectionWindow,
)
from sentry.llm_cache_detection.query import (
    AGENT_NAME,
    AVG_INPUT_TOKENS,
    CALL_SITE_GROUPS_LIMIT,
    COUNT,
    COUNT_SAMPLE,
    MODEL,
    OPERATION_NAME,
    SPAN_NAME,
    SUM_CACHE_CREATION_TOKENS,
    SUM_CACHE_READ_TOKENS,
    SUM_INPUT_TOKENS,
    DroppedRowReason,
    _build_group_filter,
    _to_call_sites,
    count_spans_with_cache_attributes,
    fetch_call_site_stats,
    fetch_call_site_warmth,
    fetch_sample_calls,
    fetch_sample_prompts,
)
from tests.sentry.llm_cache_detection.test_utils import make_stats


def make_row(
    *,
    agent_name: str | None = None,
    operation_name: str | None = "generate_content",
    span_name: str | None = "generate_content generate_structured",
    model: str | None = "model-x",
    call_count: int = 10_000,
    sampled_call_count: int | None = None,
    sum_input_tokens: float = 1_000_000,
    avg_input_tokens: float = 100,
) -> dict[str, Any]:
    return {
        AGENT_NAME: agent_name or "",
        OPERATION_NAME: operation_name or "",
        SPAN_NAME: span_name or "",
        MODEL: model or "",
        COUNT: call_count,
        COUNT_SAMPLE: call_count if sampled_call_count is None else sampled_call_count,
        SUM_INPUT_TOKENS: sum_input_tokens,
        SUM_CACHE_READ_TOKENS: 0,
        SUM_CACHE_CREATION_TOKENS: 0,
        AVG_INPUT_TOKENS: avg_input_tokens,
    }


@pytest.mark.parametrize(
    ("stats", "term"),
    [
        # Unescaped, `*` silently degrades an exact match to a wildcard match.
        pytest.param(
            make_stats(span_name="generate_content *"),
            'span.name:"generate_content \\*"',
            id="escapes-wildcard",
        ),
        pytest.param(
            make_stats(agent_label='say "hi" agent'),
            'gen_ai.agent.name:"say \\"hi\\" agent"',
            id="escapes-double-quote",
        ),
        # The grammar preserves a backslash that isn't escaping anything, so
        # these values match exactly and must not be rejected.
        pytest.param(
            make_stats(agent_label="C:\\jobs\\nightly"),
            'gen_ai.agent.name:"C:\\jobs\\nightly"',
            id="keeps-interior-backslashes",
        ),
    ],
)
def test_group_filter_matches_the_value_exactly(stats: CallSiteStats, term: str) -> None:
    group_filter = _build_group_filter(stats)

    assert group_filter is not None
    assert term in group_filter


@pytest.mark.parametrize(
    "value",
    [
        pytest.param("trailing\\", id="trailing-backslash-escapes-the-closing-quote"),
        pytest.param("a\\*b", id="backslash-before-star-always-reads-as-a-wildcard"),
    ],
)
def test_group_filter_none_for_unexpressible_values(value: str) -> None:
    assert _build_group_filter(make_stats(agent_label=value)) is None


def test_group_filter_requires_the_agent_name_to_be_absent_for_a_fallback_label() -> None:
    # Without the absence term the filter would also collect spans that do carry
    # an agent name and happen to share the operation, which are another call site.
    group_filter = _build_group_filter(
        make_stats(
            agent_label="generate_content",
            agent_label_source=AgentLabelSource.OPERATION_NAME,
        )
    )

    assert group_filter is not None
    assert "!has:gen_ai.agent.name" in group_filter
    assert 'gen_ai.operation.name:"generate_content"' in group_filter


def test_unexpressible_value_is_never_queried() -> None:
    stats = make_stats(model="model\\")
    project = MagicMock()
    window = DetectionWindow.ending_now()

    assert count_spans_with_cache_attributes(project, stats, window) is None
    assert fetch_call_site_warmth(project, stats, window) is None
    assert fetch_sample_calls(project, stats, window) == []
    # None rather than an empty list, so the caller can tell a call site it never
    # asked about from one whose spans carry no prompt text.
    assert fetch_sample_prompts(project, stats, window) is None


def test_counts_the_calls_of_rows_missing_part_of_the_key() -> None:
    # Each row is counted once, under the first part of the key it lacks.
    call_sites, dropped_calls = _to_call_sites(
        [
            make_row(agent_name=None, operation_name=None, model=None, call_count=7),
            make_row(agent_name="Summarizer", span_name=None, call_count=5),
            make_row(agent_name="Summarizer", model=None, call_count=3),
            make_row(agent_name="Summarizer", model=None, call_count=2),
        ]
    )

    assert call_sites == []
    assert dropped_calls == {
        DroppedRowReason.NO_LABEL: 7,
        DroppedRowReason.NO_SPAN_NAME: 5,
        DroppedRowReason.NO_MODEL: 5,
    }


@pytest.mark.parametrize(
    ("row_count", "truncated"),
    [(CALL_SITE_GROUPS_LIMIT - 1, False), (CALL_SITE_GROUPS_LIMIT, True)],
)
def test_reports_a_result_cut_off_at_the_row_cap(row_count: int, truncated: bool) -> None:
    rows = [make_row(agent_name=f"agent-{index}") for index in range(row_count)]
    with patch(
        "sentry.llm_cache_detection.query.Spans.run_table_query", return_value={"data": rows}
    ):
        result = fetch_call_site_stats(MagicMock(), DetectionWindow.ending_now())

    assert len(result.call_sites) == row_count
    assert result.truncated is truncated


def test_merges_rows_one_agent_split_across_operation_names() -> None:
    # The operation name is only queried to resolve the fallback, so a named
    # agent reporting two of them is one call site, not two.
    call_sites, _ = _to_call_sites(
        [
            make_row(
                agent_name="Summarizer",
                operation_name="chat",
                call_count=3,
                sum_input_tokens=300,
                avg_input_tokens=100,
            ),
            make_row(
                agent_name="Summarizer",
                operation_name="generate_content",
                call_count=1,
                sum_input_tokens=200,
                avg_input_tokens=200,
            ),
        ]
    )

    assert len(call_sites) == 1
    assert call_sites[0].call_count == 4
    assert call_sites[0].sum_input_tokens == 500
    # Re-weighted by call count rather than averaged again.
    assert call_sites[0].avg_input_tokens == 125
