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

    def test_returns_meta(self) -> None:
        now = before_now(days=5).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        # First span carries no user data; the user must still be resolved from the
        # later ai_client spans that do (any() skips spans without user attributes).
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
            user_id="user-123",
            user_email="test@example.com",
            user_username="testuser",
            user_ip="192.168.1.1",
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

        meta = response.data
        assert meta["errors"] == 1
        assert meta["llmCalls"] == 2
        assert meta["toolCalls"] == 3
        assert meta["totalTokens"] == LLM_TOKENS * 2
        assert meta["inputTokens"] == LLM_INPUT_TOKENS * 2
        assert meta["outputTokens"] == LLM_OUTPUT_TOKENS * 2
        assert meta["totalCost"] == LLM_COST * 2

        # Resolved from the ai_client spans that carry user data, even though the
        # earliest span (the agent span) has none.
        assert meta["user"] == {
            "id": "user-123",
            "email": "test@example.com",
            "username": "testuser",
            "ip_address": "192.168.1.1",
        }

        assert meta["traceIds"] == [trace_id]

        # Per-tool breakdown: call count, total duration, and error flag, ordered by
        # call count descending (matching the Tool Calls hover card).
        tools = meta["tools"]
        assert [tool["name"] for tool in tools] == ["search", "database"]

        by_name = {tool["name"]: tool for tool in tools}
        assert by_name["search"]["calls"] == 2
        assert by_name["search"]["hasError"] is False
        assert by_name["search"]["duration"] >= 0
        assert by_name["database"]["calls"] == 1
        assert by_name["database"]["hasError"] is True

    def test_returns_all_trace_ids(self) -> None:
        now = before_now(days=5).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_ids = [uuid4().hex for _ in range(3)]

        # Multiple spans per trace: the group-by must return each trace once, not per span.
        for trace_id in trace_ids:
            for offset in range(2):
                self.store_ai_span(
                    conversation_id=conversation_id,
                    timestamp=now - timedelta(seconds=offset),
                    op="gen_ai.chat",
                    operation_type="ai_client",
                    tokens=LLM_TOKENS,
                    trace_id=trace_id,
                )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200
        assert sorted(response.data["traceIds"]) == sorted(trace_ids)

    def test_nonexistent_conversation_returns_empty_meta(self) -> None:
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

        meta = response.data
        assert meta["errors"] == 0
        assert meta["llmCalls"] == 0
        assert meta["toolCalls"] == 0
        assert meta["totalTokens"] == 0
        assert meta["totalCost"] == 0
        assert meta["user"] is None
        assert meta["tools"] == []
        assert meta["traceIds"] == []

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
