from datetime import timedelta
from typing import Any
from uuid import uuid4

from django.urls import reverse

from sentry.api.endpoints.organization_ai_conversations import (
    _extract_content_from_parts,
    _extract_first_user_message,
    _get_first_input_message,
    _get_last_output,
)
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now

from .test_organization_ai_conversations_base import (
    LLM_COST,
    LLM_TOKENS,
    BaseAIConversationsTestCase,
)


class TestExtractContentFromParts:
    """Unit tests for _extract_content_from_parts helper function"""

    def test_single_text_part(self):
        msg = {"parts": [{"type": "text", "content": "Hello, world!"}]}
        assert _extract_content_from_parts(msg) == "Hello, world!"

    def test_multiple_text_parts(self):
        msg = {
            "parts": [
                {"type": "text", "content": "First part."},
                {"type": "text", "content": "Second part."},
            ]
        }
        assert _extract_content_from_parts(msg) == "First part.\nSecond part."

    def test_mixed_part_types(self):
        msg = {
            "parts": [
                {"type": "text", "content": "User question"},
                {"type": "tool_call", "id": "123", "name": "weather"},
                {"type": "text", "content": "More text"},
            ]
        }
        # Should only extract text parts
        assert _extract_content_from_parts(msg) == "User question\nMore text"

    def test_empty_parts(self):
        msg: dict[str, Any] = {"parts": []}
        assert _extract_content_from_parts(msg) is None

    def test_no_parts_key(self):
        msg = {"content": "old format"}
        assert _extract_content_from_parts(msg) is None

    def test_parts_not_list(self):
        msg = {"parts": "invalid"}
        assert _extract_content_from_parts(msg) is None

    def test_empty_content(self):
        msg = {"parts": [{"type": "text", "content": ""}]}
        assert _extract_content_from_parts(msg) is None

    def test_missing_content(self):
        msg = {"parts": [{"type": "text"}]}
        assert _extract_content_from_parts(msg) is None


class TestExtractFirstUserMessage:
    """Unit tests for _extract_first_user_message helper function"""

    def test_old_format_content(self):
        messages = '[{"role": "user", "content": "Hello"}]'
        assert _extract_first_user_message(messages) == "Hello"

    def test_new_format_parts(self):
        messages = '[{"role": "user", "parts": [{"type": "text", "content": "Hello"}]}]'
        assert _extract_first_user_message(messages) == "Hello"

    def test_prefers_old_format_when_both_exist(self):
        messages = (
            '[{"role": "user", "content": "Old", "parts": [{"type": "text", "content": "New"}]}]'
        )
        assert _extract_first_user_message(messages) == "Old"

    def test_finds_first_user_message(self):
        messages = '[{"role": "system", "content": "System"}, {"role": "user", "content": "First"}, {"role": "user", "content": "Second"}]'
        assert _extract_first_user_message(messages) == "First"

    def test_returns_none_for_no_user_messages(self):
        messages = (
            '[{"role": "system", "content": "System"}, {"role": "assistant", "content": "Hi"}]'
        )
        assert _extract_first_user_message(messages) is None

    def test_returns_none_for_invalid_json(self):
        messages = "invalid json"
        assert _extract_first_user_message(messages) is None

    def test_returns_none_for_none_input(self):
        assert _extract_first_user_message(None) is None

    def test_returns_none_for_empty_list(self):
        messages = "[]"
        assert _extract_first_user_message(messages) is None


class TestGetFirstInputMessage:
    """Unit tests for _get_first_input_message helper function"""

    def test_prefers_new_format(self):
        row = {
            "gen_ai.input.messages": '[{"role": "user", "parts": [{"type": "text", "content": "New"}]}]',
            "gen_ai.request.messages": '[{"role": "user", "content": "Old"}]',
        }
        assert _get_first_input_message(row) == "New"

    def test_falls_back_to_old_format(self):
        row = {"gen_ai.request.messages": '[{"role": "user", "content": "Old"}]'}
        assert _get_first_input_message(row) == "Old"

    def test_returns_none_when_both_empty(self):
        row: dict[str, Any] = {}
        assert _get_first_input_message(row) is None

    def test_skips_invalid_new_format(self):
        row = {
            "gen_ai.input.messages": "invalid",
            "gen_ai.request.messages": '[{"role": "user", "content": "Old"}]',
        }
        assert _get_first_input_message(row) == "Old"


class TestGetLastOutput:
    """Unit tests for _get_last_output helper function"""

    def test_prefers_new_format_text_part(self):
        row = {
            "gen_ai.output.messages": '[{"role": "assistant", "parts": [{"type": "text", "content": "New"}]}]',
            "gen_ai.response.text": "Old",
        }
        assert _get_last_output(row) == "New"

    def test_prefers_new_format_content(self):
        row = {
            "gen_ai.output.messages": '[{"role": "assistant", "content": "New content"}]',
            "gen_ai.response.text": "Old",
        }
        assert _get_last_output(row) == "New content"

    def test_falls_back_to_old_format(self):
        row = {"gen_ai.response.text": "Old response"}
        assert _get_last_output(row) == "Old response"

    def test_returns_none_when_empty(self):
        row: dict[str, Any] = {}
        assert _get_last_output(row) is None

    def test_finds_last_assistant_message(self):
        row = {
            "gen_ai.output.messages": '[{"role": "assistant", "content": "First"}, {"role": "user", "content": "Question"}, {"role": "assistant", "content": "Last"}]'
        }
        assert _get_last_output(row) == "Last"

    def test_skips_invalid_new_format(self):
        row = {
            "gen_ai.output.messages": "invalid",
            "gen_ai.response.text": "Fallback",
        }
        assert _get_last_output(row) == "Fallback"


class OrganizationAIConversationsEndpointTest(BaseAIConversationsTestCase):
    view = "sentry-api-0-organization-ai-conversations"

    def do_request(self, query=None, features=None, **kwargs):
        if features is None:
            features = ["organizations:gen-ai-conversations"]

        query = query or {}

        with self.feature(features):
            return self.client.get(
                reverse(
                    self.view,
                    kwargs={"organization_id_or_slug": self.organization.slug},
                ),
                query,
                format="json",
                **kwargs,
            )

    def test_no_feature(self) -> None:
        response = self.do_request(features=[])
        assert response.status_code == 404

    def test_no_project(self) -> None:
        response = self.do_request()
        assert response.status_code == 404

    def test_no_conversations(self) -> None:
        """Test endpoint returns empty list when there are no spans with gen_ai.conversation.id"""
        now = before_now(days=10).replace(microsecond=0)

        span = self.create_span(
            {"description": "test", "sentry_tags": {"status": "ok"}},
            start_ts=now,
        )
        self.store_spans([span])

        query = {
            "project": [self.project.id],
            "start": now.isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data
        assert len(response.data) == 0

    def test_single_conversation_single_trace(self) -> None:
        """Test a conversation with all spans in a single trace"""
        now = before_now(days=20).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        first_messages = [{"role": "user", "content": "Hello, I need help"}]
        last_response_text = "Here is the final answer"

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=4),
            op="gen_ai.invoke_agent",
            operation_type="invoke_agent",
            description="Customer Support Agent",
            agent_name="Customer Support Agent",
            trace_id=trace_id,
        )

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=3),
            op="gen_ai.chat",
            operation_type="ai_client",
            tokens=LLM_TOKENS,
            cost=LLM_COST,
            trace_id=trace_id,
            messages=first_messages,
            response_text="Let me help you with that",
        )

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.execute_tool",
            operation_type="tool",
            trace_id=trace_id,
        )

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.invoke_agent",
            operation_type="invoke_agent",
            description="Response Generator",
            agent_name="Response Generator",
            trace_id=trace_id,
        )

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now,
            op="gen_ai.chat",
            status="internal_error",
            operation_type="ai_client",
            tokens=LLM_TOKENS,
            cost=LLM_COST,
            trace_id=trace_id,
            messages=[{"role": "user", "content": "Thanks"}],
            response_text=last_response_text,
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        assert conversation["conversationId"] == conversation_id
        assert conversation["errors"] == 1
        assert conversation["llmCalls"] == 2
        assert conversation["toolCalls"] == 1
        assert conversation["totalTokens"] == LLM_TOKENS * 2
        assert conversation["totalCost"] == LLM_COST * 2
        assert conversation["traceCount"] == 1
        assert conversation["startTimestamp"] > 0
        assert conversation["endTimestamp"] > 0
        assert conversation["endTimestamp"] >= conversation["startTimestamp"]
        assert conversation["flow"] == ["Customer Support Agent", "Response Generator"]
        assert len(conversation["traceIds"]) == 1
        assert conversation["traceIds"][0] == trace_id
        # firstInput: first user message content from first ai_client span
        # lastOutput: gen_ai.response.text from last ai_client span
        assert conversation["firstInput"] == "Hello, I need help"
        assert conversation["lastOutput"] == last_response_text

    def test_conversation_spanning_multiple_traces(self) -> None:
        """Test a conversation with spans across multiple traces"""
        now = before_now(days=30).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id_1 = uuid4().hex
        trace_id_2 = uuid4().hex

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=3),
            op="gen_ai.invoke_agent",
            operation_type="invoke_agent",
            description="Research Agent",
            agent_name="Research Agent",
            trace_id=trace_id_1,
        )

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.chat",
            operation_type="ai_client",
            tokens=LLM_TOKENS,
            cost=LLM_COST,
            trace_id=trace_id_1,
        )

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.invoke_agent",
            operation_type="invoke_agent",
            description="Summarization Agent",
            agent_name="Summarization Agent",
            trace_id=trace_id_2,
        )

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now,
            op="gen_ai.chat",
            operation_type="ai_client",
            tokens=LLM_TOKENS,
            cost=LLM_COST,
            trace_id=trace_id_2,
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        assert conversation["conversationId"] == conversation_id
        assert conversation["errors"] == 0
        assert conversation["llmCalls"] == 2
        assert conversation["toolCalls"] == 0
        assert conversation["totalTokens"] == LLM_TOKENS * 2
        assert conversation["totalCost"] == LLM_COST * 2
        assert conversation["traceCount"] == 2
        assert conversation["flow"] == ["Research Agent", "Summarization Agent"]
        assert len(conversation["traceIds"]) == 2
        assert set(conversation["traceIds"]) == {trace_id_1, trace_id_2}

    def test_multiple_conversations(self) -> None:
        """Test multiple conversations are returned correctly"""
        now = before_now(days=40).replace(microsecond=0)
        conversation_id_1 = uuid4().hex
        conversation_id_2 = uuid4().hex

        self.store_ai_span(
            conversation_id=conversation_id_1,
            timestamp=now - timedelta(minutes=2),
            op="gen_ai.chat",
            operation_type="ai_client",
            tokens=LLM_TOKENS,
            cost=LLM_COST,
        )

        self.store_ai_span(
            conversation_id=conversation_id_2,
            timestamp=now - timedelta(minutes=1),
            op="gen_ai.chat",
            operation_type="ai_client",
            tokens=LLM_TOKENS,
            cost=LLM_COST,
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 2

        assert response.data[0]["conversationId"] == conversation_id_2
        assert response.data[1]["conversationId"] == conversation_id_1

    def test_pagination(self) -> None:
        """Test pagination works correctly"""
        now = before_now(days=50).replace(microsecond=0)

        for i in range(3):
            conversation_id = uuid4().hex
            span = self.create_span(
                {
                    "description": "test",
                    "sentry_tags": {"status": "ok", "op": "gen_ai.chat"},
                    "data": {
                        "gen_ai.conversation.id": conversation_id,
                    },
                },
                start_ts=now - timedelta(minutes=i),
            )
            self.store_spans([span])

        query = {
            "project": [self.project.id],
            "per_page": "2",
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 2

        links = parse_link_header(response.headers["Link"])
        next_link = next(link for link in links.values() if link["rel"] == "next")
        assert next_link["results"] == "true"
        assert next_link["cursor"]

        query["cursor"] = next_link["cursor"]
        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

    def test_zero_values(self) -> None:
        """Test conversations with zero values for metrics and no agent spans"""
        now = before_now(days=60).replace(microsecond=0)
        conversation_id = uuid4().hex

        span = self.create_span(
            {
                "description": "test",
                "sentry_tags": {"status": "ok", "op": "gen_ai.chat"},
                "data": {
                    "gen_ai.conversation.id": conversation_id,
                },
            },
            start_ts=now,
        )
        self.store_spans([span])

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data
        assert len(response.data) == 1

        conversation = response.data[0]
        assert conversation["conversationId"] == conversation_id
        assert conversation["errors"] == 0
        assert conversation["llmCalls"] == 0
        assert conversation["toolCalls"] == 0
        assert conversation["totalTokens"] == 0
        assert conversation["totalCost"] == 0.0
        assert conversation["flow"] == []
        assert len(conversation["traceIds"]) == 1
        assert conversation["firstInput"] is None
        assert conversation["lastOutput"] is None
        assert conversation["user"] is None

    def test_mixed_error_statuses(self) -> None:
        """Test that various error statuses are counted correctly"""
        now = before_now(days=70).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        statuses = [
            "ok",
            "cancelled",
            "unknown",
            "internal_error",
            "resource_exhausted",
            "invalid_argument",
        ]

        for i, span_status in enumerate(statuses):
            self.store_ai_span(
                conversation_id=conversation_id,
                timestamp=now - timedelta(seconds=i),
                op="gen_ai.chat",
                status=span_status,
                trace_id=trace_id,
            )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        assert conversation["errors"] == 3

    def test_flow_ordering(self) -> None:
        """Test that flow agents are ordered by timestamp"""
        now = before_now(days=80).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        agents = [
            ("Agent A", now - timedelta(seconds=5)),
            ("Agent B", now - timedelta(seconds=3)),
            ("Agent C", now - timedelta(seconds=1)),
        ]

        for agent_name, timestamp in agents:
            self.store_ai_span(
                conversation_id=conversation_id,
                timestamp=timestamp,
                op="gen_ai.invoke_agent",
                operation_type="invoke_agent",
                description=agent_name,
                agent_name=agent_name,
                trace_id=trace_id,
            )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        assert conversation["flow"] == ["Agent A", "Agent B", "Agent C"]

    def test_complete_conversation_data_across_time_range(self) -> None:
        """Test that conversations show complete data even when spans are outside time range"""
        now = before_now(days=15).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        old_span_time = now - timedelta(days=7)
        recent_span_time = now - timedelta(minutes=10)

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=old_span_time,
            op="gen_ai.chat",
            operation_type="ai_client",
            tokens=100,
            cost=0.01,
            trace_id=trace_id,
        )

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=recent_span_time,
            op="gen_ai.chat",
            operation_type="ai_client",
            tokens=50,
            cost=0.005,
            trace_id=trace_id,
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=2)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        assert conversation["conversationId"] == conversation_id
        assert conversation["llmCalls"] == 1
        assert conversation["totalTokens"] == 50
        assert conversation["totalCost"] == 0.005

    def test_first_input_last_output(self) -> None:
        """Test firstInput and lastOutput are correctly populated from ai_client spans"""
        now = before_now(days=90).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        first_user_content = "What is the weather?"
        last_response_text = "The weather is sunny!"

        # First ai_client span with input
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=3),
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id,
            messages=[{"role": "user", "content": first_user_content}],
            response_text="Let me check...",
        )

        # Middle ai_client span
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id,
            messages=[
                {"role": "user", "content": "What is the weather?"},
                {"role": "assistant", "content": "Let me check..."},
                {"role": "user", "content": "Thanks"},
            ],
            response_text="Processing your request...",
        )

        # Last ai_client span with output
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id,
            messages=[{"role": "user", "content": "Any updates?"}],
            response_text=last_response_text,
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        # firstInput: first user message content from first ai_client span
        # lastOutput: gen_ai.response.text from last ai_client span
        assert conversation["firstInput"] == first_user_content
        assert conversation["lastOutput"] == last_response_text

    def test_first_input_last_output_no_ai_client_spans(self) -> None:
        """Test firstInput and lastOutput are None when no ai_client spans exist"""
        now = before_now(days=91).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        # Only invoke_agent spans, no ai_client spans
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.invoke_agent",
            agent_name="Test Agent",
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

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        assert conversation["firstInput"] is None
        assert conversation["lastOutput"] is None

    def test_query_filter(self) -> None:
        """Test that query parameter filters conversations"""
        now = before_now(days=30).replace(microsecond=0)
        conversation_id_1 = uuid4().hex
        conversation_id_2 = uuid4().hex

        # Conversation 1 with specific agent
        self.store_ai_span(
            conversation_id=conversation_id_1,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.invoke_agent",
            agent_name="WeatherBot",
        )

        # Conversation 2 with different agent
        self.store_ai_span(
            conversation_id=conversation_id_2,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.invoke_agent",
            agent_name="NewsBot",
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
            "query": "gen_ai.agent.name:WeatherBot",
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["conversationId"] == conversation_id_1

    def test_conversation_with_user_data(self) -> None:
        """Test that user data is extracted from spans and returned in the response"""
        now = before_now(days=100).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        # First span with user data (earliest timestamp)
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=3),
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id,
            user_id="user-123",
            user_email="test@example.com",
            user_username="testuser",
            user_ip="192.168.1.1",
        )

        # Second span with different user data (should not override first)
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id,
            user_id="user-456",
            user_email="other@example.com",
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        # User should be from the first span (earliest timestamp)
        assert conversation["user"] is not None
        assert conversation["user"]["id"] == "user-123"
        assert conversation["user"]["email"] == "test@example.com"
        assert conversation["user"]["username"] == "testuser"
        assert conversation["user"]["ip_address"] == "192.168.1.1"

    def test_conversation_with_partial_user_data(self) -> None:
        """Test that user is returned even with partial user data"""
        now = before_now(days=101).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        # Span with only email
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id,
            user_email="partial@example.com",
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        assert conversation["user"] is not None
        assert conversation["user"]["id"] is None
        assert conversation["user"]["email"] == "partial@example.com"
        assert conversation["user"]["username"] is None
        assert conversation["user"]["ip_address"] is None

    def test_new_format_input_output_messages(self) -> None:
        """Test that new format gen_ai.input.messages and gen_ai.output.messages are parsed correctly"""
        now = before_now(days=102).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        first_user_content = "What is the weather today?"
        last_response_text = "It's sunny and warm!"

        # New format with parts array
        input_messages = [
            {
                "role": "user",
                "parts": [{"type": "text", "content": first_user_content}],
            }
        ]
        output_messages = [
            {
                "role": "assistant",
                "parts": [{"type": "text", "content": last_response_text}],
            }
        ]

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id,
            input_messages=input_messages,
            output_messages=output_messages,
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        assert conversation["firstInput"] == first_user_content
        assert conversation["lastOutput"] == last_response_text

    def test_new_format_with_multiple_text_parts(self) -> None:
        """Test that multiple text parts are concatenated correctly"""
        now = before_now(days=103).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        # New format with multiple text parts
        input_messages = [
            {
                "role": "user",
                "parts": [
                    {"type": "text", "content": "First part."},
                    {"type": "text", "content": "Second part."},
                ],
            }
        ]
        output_messages = [
            {
                "role": "assistant",
                "parts": [
                    {"type": "text", "content": "Response part one."},
                    {"type": "text", "content": "Response part two."},
                ],
            }
        ]

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id,
            input_messages=input_messages,
            output_messages=output_messages,
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        # Multiple text parts should be concatenated with newline
        assert conversation["firstInput"] == "First part.\nSecond part."
        assert conversation["lastOutput"] == "Response part one.\nResponse part two."

    def test_new_format_priority_over_old_format(self) -> None:
        """Test that new format attributes take priority over old format when both exist"""
        now = before_now(days=104).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        old_user_content = "Old format user message"
        old_response_text = "Old format response"
        new_user_content = "New format user message"
        new_response_text = "New format response"

        # Old format
        old_messages = [{"role": "user", "content": old_user_content}]

        # New format with parts array
        input_messages = [
            {
                "role": "user",
                "parts": [{"type": "text", "content": new_user_content}],
            }
        ]
        output_messages = [
            {
                "role": "assistant",
                "parts": [{"type": "text", "content": new_response_text}],
            }
        ]

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id,
            messages=old_messages,  # Old format
            response_text=old_response_text,  # Old format
            input_messages=input_messages,  # New format (should take priority)
            output_messages=output_messages,  # New format (should take priority)
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        # New format should take priority
        assert conversation["firstInput"] == new_user_content
        assert conversation["lastOutput"] == new_response_text

    def test_new_format_parts_structure(self) -> None:
        """Test that new format with parts structure works correctly"""
        now = before_now(days=105).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        user_content = "Weather in Paris?"
        response_content = "It's rainy, 57°F"

        input_messages = [
            {
                "role": "user",
                "parts": [{"type": "text", "content": user_content}],
            }
        ]
        output_messages = [
            {
                "role": "assistant",
                "parts": [{"type": "text", "content": response_content}],
            }
        ]

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id,
            input_messages=input_messages,
            output_messages=output_messages,
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]["firstInput"] == user_content
        assert response.data[0]["lastOutput"] == response_content

    def test_tool_names_populated(self) -> None:
        """Test that toolNames is populated with distinct tool names from tool spans"""
        now = before_now(days=106).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=4),
            op="gen_ai.execute_tool",
            operation_type="tool",
            trace_id=trace_id,
            tool_name="weather_api",
        )

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=3),
            op="gen_ai.execute_tool",
            operation_type="tool",
            trace_id=trace_id,
            tool_name="calculator",
        )

        # Duplicate tool call should not create duplicate entry
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.execute_tool",
            operation_type="tool",
            trace_id=trace_id,
            tool_name="weather_api",
        )

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.execute_tool",
            operation_type="tool",
            trace_id=trace_id,
            tool_name="search",
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        # toolNames should be sorted and distinct
        assert conversation["toolNames"] == ["calculator", "search", "weather_api"]
        assert conversation["toolCalls"] == 4
        assert conversation["toolErrors"] == 0

    def test_tool_errors_counted(self) -> None:
        """Test that toolErrors counts only failed tool spans"""
        now = before_now(days=107).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        # Successful tool call
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=4),
            op="gen_ai.execute_tool",
            operation_type="tool",
            status="ok",
            trace_id=trace_id,
            tool_name="weather_api",
        )

        # Failed tool call
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=3),
            op="gen_ai.execute_tool",
            operation_type="tool",
            status="internal_error",
            trace_id=trace_id,
            tool_name="database_query",
        )

        # Another failed tool call
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.execute_tool",
            operation_type="tool",
            status="resource_exhausted",
            trace_id=trace_id,
            tool_name="external_api",
        )

        # Successful tool call
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.execute_tool",
            operation_type="tool",
            status="ok",
            trace_id=trace_id,
            tool_name="calculator",
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        assert conversation["toolCalls"] == 4
        assert conversation["toolErrors"] == 2
        assert set(conversation["toolNames"]) == {
            "weather_api",
            "database_query",
            "external_api",
            "calculator",
        }

    def test_empty_tool_names_when_no_tool_calls(self) -> None:
        """Test that toolNames is empty when there are no tool calls"""
        now = before_now(days=108).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        # Only LLM calls, no tool calls
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id,
        )

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.invoke_agent",
            operation_type="invoke_agent",
            agent_name="Test Agent",
            trace_id=trace_id,
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        assert conversation["toolNames"] == []
        assert conversation["toolCalls"] == 0
        assert conversation["toolErrors"] == 0
