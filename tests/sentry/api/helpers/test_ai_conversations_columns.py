import pytest
from rest_framework.exceptions import ParseError

from sentry.api.helpers.ai_conversations_columns import (
    CONVERSATION_ID,
    DEFAULT_FIELDS,
    END_TIMESTAMP,
    LLM_CALLS,
    TOTAL_TOKENS,
    build_id_query_string,
    resolve_requested_fields,
    resolve_sort,
)


class TestResolveRequestedFields:
    def test_defaults_when_empty(self) -> None:
        assert resolve_requested_fields([]) == list(DEFAULT_FIELDS)

    def test_forces_conversation_id(self) -> None:
        resolved = resolve_requested_fields([LLM_CALLS])
        assert resolved[0] == CONVERSATION_ID
        assert LLM_CALLS in resolved

    def test_dedupes_preserving_order(self) -> None:
        resolved = resolve_requested_fields([LLM_CALLS, TOTAL_TOKENS, LLM_CALLS])
        assert resolved == [CONVERSATION_ID, LLM_CALLS, TOTAL_TOKENS]

    def test_rejects_unknown_field(self) -> None:
        with pytest.raises(ParseError):
            resolve_requested_fields(["nope"])


class TestResolveSort:
    def test_default(self) -> None:
        assert resolve_sort(None) == (END_TIMESTAMP, True)

    def test_ascending(self) -> None:
        assert resolve_sort([TOTAL_TOKENS]) == (TOTAL_TOKENS, False)

    def test_descending(self) -> None:
        assert resolve_sort([f"-{LLM_CALLS}"]) == (LLM_CALLS, True)

    def test_rejects_unsortable(self) -> None:
        with pytest.raises(ParseError):
            resolve_sort([CONVERSATION_ID])


class TestBuildIdQueryString:
    def test_translates_aggregate_alias(self) -> None:
        result = build_id_query_string("totalTokens:>1000")
        assert (
            "sum_if(gen_ai.usage.total_tokens,gen_ai.operation.type,equals,ai_client):>1000"
            in result
        )

    def test_leaves_attribute_filter_untouched(self) -> None:
        result = build_id_query_string("user.email:test@example.com")
        assert "user.email:test@example.com" in result

    def test_rejects_duration_filter(self) -> None:
        with pytest.raises(ParseError):
            build_id_query_string("duration:>5000")
