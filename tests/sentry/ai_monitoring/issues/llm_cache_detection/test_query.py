from __future__ import annotations

from sentry.ai_monitoring.issues.llm_cache_detection.detection import AgentLabelSource
from sentry.ai_monitoring.issues.llm_cache_detection.query import (
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
    DroppedRowReason,
    _to_call_sites,
)
from sentry.search.events.types import SnubaRow


def make_row(**changes: object) -> SnubaRow:
    row: SnubaRow = {
        AGENT_NAME: "Reviewer",
        OPERATION_NAME: "chat",
        SPAN_NAME: "generate_content",
        MODEL: "model-x",
        COUNT: 100,
        COUNT_SAMPLE: 10,
        SUM_INPUT_TOKENS: 10_000,
        SUM_CACHE_READ_TOKENS: 2_000,
        SUM_CACHE_CREATION_TOKENS: 1_000,
        AVG_INPUT_TOKENS: 100,
    }
    row.update(changes)
    return row


def test_to_call_sites_folds_operations_for_named_agent() -> None:
    rows = [
        make_row(),
        make_row(
            **{
                OPERATION_NAME: "tool",
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

    assert dropped_calls == {}
    assert len(call_sites) == 2
    named, fallback = call_sites
    assert named.agent_label_source is AgentLabelSource.AGENT_NAME
    assert named.call_count == 400
    assert named.sampled_call_count == 30
    assert named.sum_input_tokens == 100_000
    assert named.sum_cache_read_tokens == 10_000
    assert named.sum_cache_creation_tokens == 5_000
    assert named.avg_input_tokens == 250
    assert fallback.agent_label_source is AgentLabelSource.OPERATION_NAME
    assert fallback.agent_label == "chat"


def test_to_call_sites_counts_calls_with_incomplete_keys() -> None:
    rows = [
        make_row(**{AGENT_NAME: None, OPERATION_NAME: None, COUNT: 10}),
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
