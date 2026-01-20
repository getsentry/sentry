from datetime import timedelta
from typing import Any
from uuid import uuid4

from django.urls import reverse

from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now

from .test_organization_ai_conversations_base import BaseAIConversationsTestCase


class OrganizationAIConversationDetailsEndpointTest(BaseAIConversationsTestCase):
    view = "sentry-api-0-organization-ai-conversation-details"

    def do_request(self, conversation_id, query=None, features=None, **kwargs):
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
        conversation_id = uuid4().hex
        response = self.do_request(conversation_id, features=[])
        assert response.status_code == 404

    def test_no_project(self) -> None:
        conversation_id = uuid4().hex
        response = self.do_request(conversation_id)
        assert response.status_code == 404

    def test_conversation_not_found(self) -> None:
        """Test endpoint returns empty list when no spans match conversation ID"""
        now = before_now(days=10).replace(microsecond=0)
        conversation_id = uuid4().hex
        other_conversation_id = uuid4().hex

        # Store a span with a different conversation ID
        self.store_ai_span(
            conversation_id=other_conversation_id,
            timestamp=now,
            op="gen_ai.chat",
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200, response.data
        assert len(response.data) == 0

    def test_single_trace_conversation(self) -> None:
        """Test returns all spans for a conversation in a single trace"""
        now = before_now(days=20).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        # Store multiple spans in the same conversation and trace
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=3),
            op="gen_ai.invoke_agent",
            operation_type="invoke_agent",
            agent_name="Test Agent",
            trace_id=trace_id,
        )

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.chat",
            operation_type="ai_client",
            tokens=100,
            trace_id=trace_id,
        )

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.execute_tool",
            operation_type="tool",
            trace_id=trace_id,
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200, response.data
        assert len(response.data) == 3

        # Verify all spans belong to the same conversation
        for span in response.data:
            assert span["gen_ai.conversation.id"] == conversation_id

        # Verify all spans have the same trace ID
        trace_ids = {span["trace"] for span in response.data}
        assert len(trace_ids) == 1
        assert trace_id in trace_ids

    def test_multi_trace_conversation(self) -> None:
        """Test returns all spans for a conversation across multiple traces"""
        now = before_now(days=30).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id_1 = uuid4().hex
        trace_id_2 = uuid4().hex

        # Spans in first trace
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=4),
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id_1,
        )

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=3),
            op="gen_ai.execute_tool",
            operation_type="tool",
            trace_id=trace_id_1,
        )

        # Spans in second trace
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id_2,
        )

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.execute_tool",
            operation_type="tool",
            trace_id=trace_id_2,
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200, response.data
        assert len(response.data) == 4

        # Verify spans come from both traces
        trace_ids = {span["trace"] for span in response.data}
        assert trace_ids == {trace_id_1, trace_id_2}

    def test_returns_conversation_attributes(self) -> None:
        """Test that the endpoint returns all AI conversation attributes"""
        now = before_now(days=40).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now,
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id,
            messages=[{"role": "user", "content": "Hello"}],
            response_text="Hi there!",
            tokens=150,
            cost=0.0025,
            user_id="user-123",
            user_email="test@example.com",
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200, response.data
        assert len(response.data) == 1

        span = response.data[0]
        # Verify core span fields
        assert "span_id" in span
        assert span["trace"] == trace_id
        assert "precise.start_ts" in span
        assert "precise.finish_ts" in span
        assert span["span.op"] == "gen_ai.chat"
        assert "span.duration" in span
        assert span["gen_ai.conversation.id"] == conversation_id
        # Verify project fields
        assert "project" in span
        assert span["project.id"] == self.project.id
        # Verify transaction fields
        assert "transaction" in span
        assert "is_transaction" in span
        # Verify AI conversation attributes are included
        assert span["gen_ai.operation.type"] == "ai_client"
        assert span["gen_ai.request.messages"] is not None
        assert span["gen_ai.response.text"] == "Hi there!"
        assert span["gen_ai.usage.total_tokens"] == 150
        assert span["gen_ai.cost.total_tokens"] == 0.0025
        # Verify user attributes are included
        assert span["user.id"] == "user-123"
        assert span["user.email"] == "test@example.com"

    def test_pagination(self) -> None:
        """Test pagination works correctly"""
        now = before_now(days=50).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        # Create 5 spans
        for i in range(5):
            self.store_ai_span(
                conversation_id=conversation_id,
                timestamp=now - timedelta(seconds=i),
                op="gen_ai.chat",
                trace_id=trace_id,
            )

        query: dict[str, Any] = {
            "project": [self.project.id],
            "per_page": "2",
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        # First page
        response = self.do_request(conversation_id, query)
        assert response.status_code == 200, response.data
        assert len(response.data) == 2

        links = parse_link_header(response.headers["Link"])
        next_link = next(link for link in links.values() if link["rel"] == "next")
        assert next_link["results"] == "true"
        assert next_link["cursor"]

        # Second page
        query["cursor"] = next_link["cursor"]
        response = self.do_request(conversation_id, query)
        assert response.status_code == 200, response.data
        assert len(response.data) == 2

        # Third page (last)
        links = parse_link_header(response.headers["Link"])
        next_link = next(link for link in links.values() if link["rel"] == "next")
        query["cursor"] = next_link["cursor"]
        response = self.do_request(conversation_id, query)
        assert response.status_code == 200, response.data
        assert len(response.data) == 1

    def test_span_ordering(self) -> None:
        """Test spans are ordered by timestamp ascending"""
        now = before_now(days=60).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        # Store spans in reverse chronological order
        timestamps = [
            now - timedelta(seconds=1),  # newest
            now - timedelta(seconds=3),  # middle
            now - timedelta(seconds=5),  # oldest
        ]

        for ts in timestamps:
            self.store_ai_span(
                conversation_id=conversation_id,
                timestamp=ts,
                op="gen_ai.chat",
                trace_id=trace_id,
            )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200, response.data
        assert len(response.data) == 3

        # Verify spans are ordered by timestamp ascending (oldest first)
        span_timestamps = [span["precise.start_ts"] for span in response.data]
        assert span_timestamps == sorted(span_timestamps)

    def test_only_returns_matching_conversation(self) -> None:
        """Test that only spans from the requested conversation are returned"""
        now = before_now(days=70).replace(microsecond=0)
        conversation_id_1 = uuid4().hex
        conversation_id_2 = uuid4().hex
        trace_id = uuid4().hex

        # Spans in conversation 1
        self.store_ai_span(
            conversation_id=conversation_id_1,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.chat",
            trace_id=trace_id,
        )

        self.store_ai_span(
            conversation_id=conversation_id_1,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.chat",
            trace_id=trace_id,
        )

        # Spans in conversation 2
        self.store_ai_span(
            conversation_id=conversation_id_2,
            timestamp=now,
            op="gen_ai.chat",
            trace_id=trace_id,
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        # Request conversation 1
        response = self.do_request(conversation_id_1, query)
        assert response.status_code == 200, response.data
        assert len(response.data) == 2

        for span in response.data:
            assert span["gen_ai.conversation.id"] == conversation_id_1

        # Request conversation 2
        response = self.do_request(conversation_id_2, query)
        assert response.status_code == 200, response.data
        assert len(response.data) == 1
        assert response.data[0]["gen_ai.conversation.id"] == conversation_id_2

    def test_returns_tool_attributes(self) -> None:
        """Test that tool spans include gen_ai.tool.name attribute"""
        now = before_now(days=80).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now,
            op="gen_ai.execute_tool",
            operation_type="tool",
            trace_id=trace_id,
            tool_name="search_database",
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200, response.data
        assert len(response.data) == 1

        span = response.data[0]
        assert span["span.op"] == "gen_ai.execute_tool"
        assert span["gen_ai.operation.type"] == "tool"
        assert span["gen_ai.tool.name"] == "search_database"
