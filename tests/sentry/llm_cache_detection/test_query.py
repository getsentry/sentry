from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

from sentry.llm_cache_detection.detection import (
    AgentLabelSource,
    CacheOutcome,
    CallSiteStats,
    DetectionWindow,
    resolve_with_cache_presence,
    resolve_with_warmth,
)
from sentry.llm_cache_detection.query import (
    AGENT_NAME,
    AVG_INPUT_TOKENS,
    COUNT,
    COUNT_SAMPLE,
    MODEL,
    OPERATION_NAME,
    SPAN_NAME,
    SUM_CACHE_CREATION_TOKENS,
    SUM_CACHE_READ_TOKENS,
    SUM_INPUT_TOKENS,
    _build_group_filter,
    _to_call_sites,
    count_spans_with_cache_attributes,
    fetch_call_site_warmth,
    fetch_sample_calls,
    fetch_sample_prompts,
)


def make_stats(
    *,
    agent_label: str = "Lightweight RCA",
    agent_label_source: AgentLabelSource = AgentLabelSource.AGENT_NAME,
    span_name: str = "generate_content generate_structured",
    model: str = "model-x",
) -> CallSiteStats:
    return CallSiteStats(
        agent_label=agent_label,
        agent_label_source=agent_label_source,
        span_name=span_name,
        model=model,
        call_count=10_000,
        sampled_call_count=10_000,
        sum_input_tokens=1_000_000,
        sum_cache_read_tokens=0,
        sum_cache_creation_tokens=0,
        avg_input_tokens=100,
    )


def make_row(
    *,
    agent_name: str | None = None,
    operation_name: str | None = "generate_content",
    span_name: str = "generate_content generate_structured",
    model: str = "model-x",
    call_count: int = 10_000,
    sampled_call_count: int | None = None,
    sum_input_tokens: float = 1_000_000,
    avg_input_tokens: float = 100,
) -> dict[str, Any]:
    return {
        AGENT_NAME: agent_name or "",
        OPERATION_NAME: operation_name or "",
        SPAN_NAME: span_name,
        MODEL: model,
        COUNT: call_count,
        COUNT_SAMPLE: call_count if sampled_call_count is None else sampled_call_count,
        SUM_INPUT_TOKENS: sum_input_tokens,
        SUM_CACHE_READ_TOKENS: 0,
        SUM_CACHE_CREATION_TOKENS: 0,
        AVG_INPUT_TOKENS: avg_input_tokens,
    }


def test_group_filter_escapes_wildcard() -> None:
    # Unescaped `*` silently degrades an exact match to a LIKE wildcard match.
    group_filter = _build_group_filter(make_stats(span_name="generate_content *"))

    assert group_filter is not None
    assert 'span.name:"generate_content \\*"' in group_filter


def test_group_filter_escapes_double_quote() -> None:
    group_filter = _build_group_filter(make_stats(agent_label='say "hi" agent'))

    assert group_filter is not None
    assert 'gen_ai.agent.name:"say \\"hi\\" agent"' in group_filter


def test_group_filter_keeps_interior_backslashes_verbatim() -> None:
    # The grammar preserves a backslash that isn't escaping anything, so these
    # values match exactly and must not be rejected.
    group_filter = _build_group_filter(make_stats(agent_label="C:\\jobs\\nightly"))

    assert group_filter is not None
    assert 'gen_ai.agent.name:"C:\\jobs\\nightly"' in group_filter


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


def test_unexpressible_value_resolves_unknown_without_querying() -> None:
    stats = make_stats(model="model\\")
    project = MagicMock()
    window = DetectionWindow.ending_now()

    count = count_spans_with_cache_attributes(project, stats, window)
    warmth = fetch_call_site_warmth(project, stats, window)

    assert count is None
    assert resolve_with_cache_presence(CacheOutcome.NOT_CACHING, count) == CacheOutcome.UNKNOWN
    assert warmth is None
    assert resolve_with_warmth(CacheOutcome.NOT_CACHING, warmth) == CacheOutcome.INELIGIBLE
    assert fetch_sample_calls(project, stats, window) == []
    # None rather than an empty list, so the caller can tell a call site it never
    # asked about from one whose spans carry no prompt text.
    assert fetch_sample_prompts(project, stats, window) is None


def test_falls_back_to_the_operation_name_per_row() -> None:
    # One (span.name, model) pair holding both named and unnamed spans is the
    # case a per-group fallback would get wrong.
    call_sites = _to_call_sites(
        [
            make_row(agent_name="Lightweight RCA"),
            make_row(agent_name=None),
        ]
    )

    assert {(site.agent_label, site.agent_label_source) for site in call_sites} == {
        ("Lightweight RCA", AgentLabelSource.AGENT_NAME),
        ("generate_content", AgentLabelSource.OPERATION_NAME),
    }


def test_drops_a_row_naming_neither_an_agent_nor_an_operation() -> None:
    assert _to_call_sites([make_row(agent_name=None, operation_name=None)]) == []


def test_merges_rows_one_agent_split_across_operation_names() -> None:
    # The operation name is only queried to resolve the fallback, so a named
    # agent reporting two of them is one call site, not two.
    call_sites = _to_call_sites(
        [
            make_row(
                agent_name="Lightweight RCA",
                operation_name="chat",
                call_count=3,
                sum_input_tokens=300,
                avg_input_tokens=100,
            ),
            make_row(
                agent_name="Lightweight RCA",
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
