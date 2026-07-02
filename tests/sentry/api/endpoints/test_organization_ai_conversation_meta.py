from datetime import timedelta
from typing import Any
from uuid import uuid4

from django.urls import reverse
from rest_framework.response import Response

from sentry.testutils.helpers.datetime import before_now

from .test_organization_ai_conversations_base import (
    LLM_COST,
    LLM_INPUT_TOKENS,
    LLM_OUTPUT_TOKENS,
    LLM_TOKENS,
    BaseAIConversationsTestCase,
)


class OrganizationAIConversationMetaEndpointTest(BaseAIConversationsTestCase):
    view = "sentry-api-0-organization-ai-conversation-meta"

    def do_request(
        self,
        conversation_id: str,
        query: dict[str, Any] | None = None,
        features: list[str] | None = None,
        **kwargs: Any,
    ) -> Response:
        if features is None:
            features = ["organizations:gen-ai-conversations"]

        query = query or {}

        with self.feature(features):
            return self.client.get(
                reverse(
                    self.view,
                    kwargs={
                        "organization_id_or_slug": self.organization.slug,
                        "conversation_id": conversation_id,
                    },
                ),
                query,
                format="json",
                **kwargs,
            )

    def test_no_feature(self) -> None:
        response = self.do_request(uuid4().hex, features=[])
        assert response.status_code == 404

    def test_no_project(self) -> None:
        response = self.do_request(uuid4().hex)
        assert response.status_code == 404

    def test_returns_summary(self) -> None:
        now = before_now(days=5).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=4),
            op="gen_ai.invoke_agent",
            operation_type="invoke_agent",
            agent_name="Support Agent",
            trace_id=trace_id,
        )
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=3),
            op="gen_ai.chat",
            operation_type="ai_client",
            tokens=LLM_TOKENS,
            input_tokens=LLM_INPUT_TOKENS,
            output_tokens=LLM_OUTPUT_TOKENS,
            cost=LLM_COST,
            trace_id=trace_id,
            user_id="user-123",
            user_email="test@example.com",
            user_username="testuser",
            user_ip="192.168.1.1",
        )
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.chat",
            operation_type="ai_client",
            tokens=LLM_TOKENS,
            input_tokens=LLM_INPUT_TOKENS,
            output_tokens=LLM_OUTPUT_TOKENS,
            cost=LLM_COST,
            trace_id=trace_id,
        )
        # "search" called twice (both ok); "database" called once and errored.
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.execute_tool",
            operation_type="tool",
            status="ok",
            trace_id=trace_id,
            tool_name="search",
        )
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(milliseconds=500),
            op="gen_ai.execute_tool",
            operation_type="tool",
            status="ok",
            trace_id=trace_id,
            tool_name="search",
        )
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now,
            op="gen_ai.execute_tool",
            operation_type="tool",
            status="internal_error",
            trace_id=trace_id,
            tool_name="database",
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200

        summary = response.data
        assert summary["errors"] == 1
        assert summary["llmCalls"] == 2
        assert summary["toolCalls"] == 3
        assert summary["totalTokens"] == LLM_TOKENS * 2
        assert summary["inputTokens"] == LLM_INPUT_TOKENS * 2
        assert summary["outputTokens"] == LLM_OUTPUT_TOKENS * 2
        assert summary["totalCost"] == LLM_COST * 2

        # User is taken from the first span (earliest timestamp) that carries one.
        assert summary["user"] == {
            "id": "user-123",
            "email": "test@example.com",
            "username": "testuser",
            "ip_address": "192.168.1.1",
        }

        assert summary["traceIds"] == [trace_id]

        # Per-tool breakdown: call count, total duration, and error flag, ordered by
        # call count descending (matching the Tool Calls hover card).
        tools = summary["tools"]
        assert [tool["name"] for tool in tools] == ["search", "database"]

        by_name = {tool["name"]: tool for tool in tools}
        assert by_name["search"]["calls"] == 2
        assert by_name["search"]["hasError"] is False
        assert by_name["search"]["duration"] >= 0
        assert by_name["database"]["calls"] == 1
        assert by_name["database"]["hasError"] is True

    def test_nonexistent_conversation_returns_empty_summary(self) -> None:
        now = before_now(days=5).replace(microsecond=0)
        other_conversation_id = uuid4().hex

        self.store_ai_span(
            conversation_id=other_conversation_id,
            timestamp=now,
            op="gen_ai.chat",
            operation_type="ai_client",
            tokens=LLM_TOKENS,
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(uuid4().hex, query)
        assert response.status_code == 200

        summary = response.data
        assert summary["errors"] == 0
        assert summary["llmCalls"] == 0
        assert summary["toolCalls"] == 0
        assert summary["totalTokens"] == 0
        assert summary["totalCost"] == 0
        assert summary["user"] is None
        assert summary["tools"] == []
        assert summary["traceIds"] == []

    def test_rejects_range_older_than_retention(self) -> None:
        now = before_now(days=40).replace(microsecond=0)

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(uuid4().hex, query)
        assert response.status_code == 400
        assert "detail" in response.data

    def test_widens_time_window_to_find_conversation(self) -> None:
        timestamp_15d = before_now(days=15).replace(microsecond=0)
        conversation_id = uuid4().hex

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=timestamp_15d,
            op="gen_ai.chat",
            operation_type="ai_client",
            tokens=LLM_TOKENS,
        )

        # A short statsPeriod is probed first, then widened until the conversation is found.
        query = {
            "project": [self.project.id],
            "statsPeriod": "1h",
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200
        assert response.data["llmCalls"] == 1
        assert response.data["totalTokens"] == LLM_TOKENS
