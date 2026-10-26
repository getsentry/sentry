from typing import Any

import pytest

from sentry.constants import InsightModules
from sentry.insights import FilterSpan, modules


def test_from_span_attributes_sets_transaction_op_when_is_transaction() -> None:
    result = FilterSpan.from_span_attributes(
        {
            "sentry.op": {"type": "string", "value": "pageload"},
            "sentry.category": {"type": "string", "value": "http"},
            "sentry.description": {"type": "string", "value": "/checkout"},
            "sentry.is_segment": {"type": "boolean", "value": True},
            "gen_ai.operation.name": {"type": "string", "value": "chat"},
        }
    )

    assert result == FilterSpan(
        op="pageload",
        category="http",
        description="/checkout",
        transaction_op="pageload",
        gen_ai_op_name="chat",
    )


def test_from_span_attributes_sets_transaction_op_none_when_not_transaction() -> None:
    result = FilterSpan.from_span_attributes(
        {
            "sentry.op": {"type": "string", "value": "http.client"},
            "sentry.category": {"type": "string", "value": "http"},
            "sentry.description": {"type": "string", "value": "GET /api"},
            "sentry.is_segment": {"type": "boolean", "value": False},
            "gen_ai.operation.name": {"type": "string", "value": "chat"},
        }
    )

    assert result == FilterSpan(
        op="http.client",
        category="http",
        description="GET /api",
        transaction_op=None,
        gen_ai_op_name="chat",
    )


def test_from_span_attributes_uses_explicit_is_segment_over_missing_attribute() -> None:
    result = FilterSpan.from_span_attributes(
        {
            "sentry.op": {"type": "string", "value": "pageload"},
            "sentry.category": {"type": "string", "value": "http"},
            "sentry.description": {"type": "string", "value": "/checkout"},
            "gen_ai.operation.name": {"type": "string", "value": "chat"},
        },
        is_segment=True,
    )

    assert result.transaction_op == "pageload"


@pytest.mark.parametrize(
    "attributes",
    [
        {
            "span.op": {"type": "string", "value": "http.client"},
            "span.category": {"type": "string", "value": "http"},
        },
        {"span.op": "http.client", "span.category": "http"},
        {
            "sentry.op": {"type": "string", "value": "http.client"},
            "span.op": {"type": "string", "value": "db"},
            "sentry.category": {"type": "string", "value": "http"},
            "span.category": {"type": "string", "value": "db"},
        },
    ],
)
def test_from_span_attributes_resolves_deprecated_names(attributes: dict[str, Any]) -> None:
    result = FilterSpan.from_span_attributes(attributes, is_segment=True)

    assert result == FilterSpan(
        op="http.client",
        category="http",
        description=None,
        transaction_op="http.client",
        gen_ai_op_name=None,
    )
    assert modules([result]) == {InsightModules.HTTP}


def test_from_span_attributes_rejects_invalid_types() -> None:
    result = FilterSpan.from_span_attributes(
        {
            "sentry.op": {"value": 42},
            "span.op": {"value": "http.client"},
            "sentry.category": {"value": False},
            "sentry.description": {"value": ["description"]},
            "sentry.is_segment": {"value": "false"},
            "gen_ai.operation.name": {"value": 42},
        }
    )

    assert result == FilterSpan(None, None, None, None, None)


def test_modules_detects_screen_load_from_ui_load_segment() -> None:
    spans = [
        FilterSpan.from_span_attributes(
            {"sentry.op": {"type": "string", "value": "ui.load"}},
            is_segment=True,
        )
    ]

    assert InsightModules.SCREEN_LOAD in modules(spans)


def test_modules_does_not_detect_screen_load_from_navigation_segment() -> None:
    spans = [
        FilterSpan.from_span_attributes(
            {"sentry.op": {"type": "string", "value": "navigation"}},
            is_segment=True,
        )
    ]

    assert InsightModules.SCREEN_LOAD not in modules(spans)


def test_modules_detects_screen_load_from_display_span_op() -> None:
    spans = [
        FilterSpan.from_span_attributes(
            {"sentry.op": {"type": "string", "value": "ui.load.initial_display"}},
            is_segment=False,
        )
    ]

    assert InsightModules.SCREEN_LOAD in modules(spans)
