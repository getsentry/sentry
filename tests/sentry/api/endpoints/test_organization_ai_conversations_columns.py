from datetime import timedelta
from uuid import uuid4

from django.urls import reverse

from sentry.api.helpers.ai_conversations_columns import (
    CONVERSATION_ID,
    DEFAULT_FIELDS,
    LLM_CALLS,
    TOTAL_TOKENS,
)
from sentry.testutils.helpers.datetime import before_now

from .test_organization_ai_conversations_base import (
    LLM_COST,
    LLM_TOKENS,
    BaseAIConversationsTestCase,
)


class OrganizationAIConversationsColumnsEndpointTest(BaseAIConversationsTestCase):
    view = "sentry-api-0-organization-ai-conversations"

    def do_request(self, query=None, features=None, **kwargs):
        if features is None:
            features = [
                "organizations:gen-ai-conversations",
                "organizations:gen-ai-conversations-columns",
            ]
        query = query or {}
        with self.feature(features):
            return self.client.get(
                reverse(self.view, kwargs={"organization_id_or_slug": self.organization.slug}),
                query,
                format="json",
                **kwargs,
            )

    def _store_basic_conversation(self, conversation_id, now, trace_id=None):
        trace_id = trace_id or uuid4().hex
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=3),
            op="gen_ai.invoke_agent",
            operation_type="invoke_agent",
            agent_name="Support Agent",
            trace_id=trace_id,
        )
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.chat",
            operation_type="ai_client",
            tokens=LLM_TOKENS,
            cost=LLM_COST,
            model="gpt-4o",
            trace_id=trace_id,
            messages=[{"role": "user", "content": "Hello"}],
            response_text="Hi there",
            user_id="u-1",
            user_email="user@example.com",
        )
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.execute_tool",
            operation_type="tool",
            tool_name="search",
            trace_id=trace_id,
        )

    def _time_window(self, now):
        return {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

    def test_default_fields_only(self) -> None:
        now = before_now(days=10).replace(microsecond=0)
        # distinct window per test: spans share a backend across xdist workers
        conversation_id = uuid4().hex
        self._store_basic_conversation(conversation_id, now)

        response = self.do_request(self._time_window(now))
        assert response.status_code == 200, response.data
        assert len(response.data) == 1

        row = response.data[0]
        assert set(row.keys()) == set(DEFAULT_FIELDS)
        assert row[CONVERSATION_ID] == conversation_id
        assert row[LLM_CALLS] == 1
        assert row[TOTAL_TOKENS] == LLM_TOKENS
        assert row["toolCalls"] == 1
        assert row["totalCost"] == LLM_COST
        assert row["errors"] == 0
        assert row["modelsUsed"] == ["gpt-4o"]
        assert row["user"]["email"] == "user@example.com"
        # Enrichment / IO fields are not requested by default.
        assert "toolNames" not in row
        assert "firstInput" not in row

    def test_explicit_field_selection(self) -> None:
        now = before_now(days=11).replace(microsecond=0)
        conversation_id = uuid4().hex
        self._store_basic_conversation(conversation_id, now)

        query = {**self._time_window(now), "field": [CONVERSATION_ID, LLM_CALLS]}
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        row = response.data[0]
        assert set(row.keys()) == {CONVERSATION_ID, LLM_CALLS}

    def test_enrichment_fields(self) -> None:
        now = before_now(days=12).replace(microsecond=0)
        conversation_id = uuid4().hex
        self._store_basic_conversation(conversation_id, now)

        query = {
            **self._time_window(now),
            "field": [CONVERSATION_ID, "toolNames", "flow", "traceIds", "traceCount"],
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        row = response.data[0]
        assert row["toolNames"] == ["search"]
        assert row["flow"] == ["Support Agent"]
        assert len(row["traceIds"]) == 1
        assert row["traceCount"] == 1

    def test_io_fields(self) -> None:
        now = before_now(days=13).replace(microsecond=0)
        conversation_id = uuid4().hex
        self._store_basic_conversation(conversation_id, now)

        query = {
            **self._time_window(now),
            "field": [CONVERSATION_ID, "firstInput", "lastOutput"],
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        row = response.data[0]
        assert row["firstInput"] == "Hello"
        assert row["lastOutput"] == "Hi there"

    def test_duration_and_timestamps(self) -> None:
        now = before_now(days=14).replace(microsecond=0)
        conversation_id = uuid4().hex
        self._store_basic_conversation(conversation_id, now)

        query = {
            **self._time_window(now),
            "field": [CONVERSATION_ID, "startTimestamp", "endTimestamp", "duration"],
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        row = response.data[0]
        assert row["startTimestamp"] > 0
        assert row["endTimestamp"] >= row["startTimestamp"]
        assert row["duration"] == row["endTimestamp"] - row["startTimestamp"]

    def test_sort_by_aggregate(self) -> None:
        now = before_now(days=15).replace(microsecond=0)
        low = uuid4().hex
        high = uuid4().hex
        # low: 1 llm call, high: 3 llm calls
        self._store_basic_conversation(low, now)
        for i in range(3):
            self.store_ai_span(
                conversation_id=high,
                timestamp=now - timedelta(seconds=3 - i),
                op="gen_ai.chat",
                operation_type="ai_client",
                tokens=LLM_TOKENS,
                messages=[{"role": "user", "content": "hi"}],
                response_text="ok",
            )

        query = {
            **self._time_window(now),
            "field": [CONVERSATION_ID, LLM_CALLS],
            "sort": f"-{LLM_CALLS}",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        assert [r[CONVERSATION_ID] for r in response.data] == [high, low]

    def test_aggregate_filter(self) -> None:
        now = before_now(days=16).replace(microsecond=0)
        small = uuid4().hex
        big = uuid4().hex
        self._store_basic_conversation(small, now)  # 1 llm call
        for i in range(3):
            self.store_ai_span(
                conversation_id=big,
                timestamp=now - timedelta(seconds=3 - i),
                op="gen_ai.chat",
                operation_type="ai_client",
                tokens=LLM_TOKENS,
                messages=[{"role": "user", "content": "hi"}],
                response_text="ok",
            )

        query = {
            **self._time_window(now),
            "field": [CONVERSATION_ID, LLM_CALLS],
            "query": "llmCalls:>1",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        assert [r[CONVERSATION_ID] for r in response.data] == [big]

    def test_attribute_filter_passthrough(self) -> None:
        now = before_now(days=17).replace(microsecond=0)
        match = uuid4().hex
        other = uuid4().hex
        self._store_basic_conversation(match, now)
        self.store_ai_span(
            conversation_id=other,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.chat",
            operation_type="ai_client",
            tokens=LLM_TOKENS,
            messages=[{"role": "user", "content": "hi"}],
            response_text="ok",
            user_email="someone@else.com",
        )

        query = {
            **self._time_window(now),
            "field": [CONVERSATION_ID],
            "query": "user.email:user@example.com",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        assert [r[CONVERSATION_ID] for r in response.data] == [match]

    def test_invalid_field_returns_400(self) -> None:
        now = before_now(days=18).replace(microsecond=0)
        query = {**self._time_window(now), "field": ["bogus"]}
        response = self.do_request(query)
        assert response.status_code == 400

    def test_invalid_sort_returns_400(self) -> None:
        now = before_now(days=19).replace(microsecond=0)
        query = {**self._time_window(now), "sort": "conversationId"}
        response = self.do_request(query)
        assert response.status_code == 400

    def test_duration_filter_returns_400(self) -> None:
        now = before_now(days=20).replace(microsecond=0)
        query = {**self._time_window(now), "query": "duration:>5000"}
        response = self.do_request(query)
        assert response.status_code == 400

    def test_requires_columns_feature_falls_back(self) -> None:
        """Without the columns flag the legacy fixed shape is returned."""
        now = before_now(days=21).replace(microsecond=0)
        conversation_id = uuid4().hex
        self._store_basic_conversation(conversation_id, now)

        response = self.do_request(
            self._time_window(now), features=["organizations:gen-ai-conversations"]
        )
        assert response.status_code == 200, response.data
        row = response.data[0]
        # Legacy response always includes the full fixed shape.
        assert "firstInput" in row
        assert "toolNames" in row
