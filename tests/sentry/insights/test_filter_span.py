from sentry.insights import FilterSpan


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
