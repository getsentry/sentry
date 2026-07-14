from datetime import timedelta
from typing import Any
from unittest.mock import MagicMock, patch
from uuid import uuid4

from django.urls import reverse
from urllib3.exceptions import ReadTimeoutError

from sentry.issues.grouptype import PerformanceFileIOMainThreadGroupType
from sentry.issues.ingest import save_issue_occurrence
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data
from sentry.utils.snuba_rpc import SnubaRPCTimeout

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
        now = before_now(days=10).replace(microsecond=0)
        conversation_id = uuid4().hex
        other_conversation_id = uuid4().hex

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
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_single_trace_conversation(self) -> None:
        now = before_now(days=20).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

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
        assert response.status_code == 200
        assert len(response.data) == 3

        for span in response.data:
            assert span["gen_ai.conversation.id"] == conversation_id

        trace_ids = {span["trace"] for span in response.data}
        assert len(trace_ids) == 1
        assert trace_id in trace_ids

    def test_multi_trace_conversation(self) -> None:
        now = before_now(days=10).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id_1 = uuid4().hex
        trace_id_2 = uuid4().hex

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
        assert response.status_code == 200
        assert len(response.data) == 4

        trace_ids = {span["trace"] for span in response.data}
        assert trace_ids == {trace_id_1, trace_id_2}

    def test_returns_conversation_attributes(self) -> None:
        now = before_now(days=5).replace(microsecond=0)
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
        assert response.status_code == 200
        assert len(response.data) == 1

        span = response.data[0]
        assert "span_id" in span
        assert span["trace"] == trace_id
        assert "precise.start_ts" in span
        assert "precise.finish_ts" in span
        assert span["span.op"] == "gen_ai.chat"
        assert "span.duration" in span
        assert span["gen_ai.conversation.id"] == conversation_id
        assert "project" in span
        assert span["project.id"] == self.project.id
        assert "transaction" in span
        assert "is_transaction" in span
        assert span["gen_ai.operation.type"] == "ai_client"
        assert span["gen_ai.request.messages"] is not None
        assert span["gen_ai.response.text"] == "Hi there!"
        assert span["gen_ai.usage.total_tokens"] == 150
        assert span["gen_ai.cost.total_tokens"] == 0.0025
        assert span["user.id"] == "user-123"
        assert span["user.email"] == "test@example.com"

    def test_pagination(self) -> None:
        now = before_now(days=5).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

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

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200
        assert len(response.data) == 2

        links = parse_link_header(response.headers["Link"])
        next_link = next(link for link in links.values() if link["rel"] == "next")
        assert next_link["results"] == "true"
        assert next_link["cursor"]

        query["cursor"] = next_link["cursor"]
        response = self.do_request(conversation_id, query)
        assert response.status_code == 200
        assert len(response.data) == 2

        links = parse_link_header(response.headers["Link"])
        next_link = next(link for link in links.values() if link["rel"] == "next")
        query["cursor"] = next_link["cursor"]
        response = self.do_request(conversation_id, query)
        assert response.status_code == 200
        assert len(response.data) == 1

    def test_span_ordering(self) -> None:
        now = before_now(days=5).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        timestamps = [
            now - timedelta(seconds=1),
            now - timedelta(seconds=3),
            now - timedelta(seconds=5),
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
        assert response.status_code == 200
        assert len(response.data) == 3

        span_timestamps = [span["precise.start_ts"] for span in response.data]
        assert span_timestamps == sorted(span_timestamps)

    def test_only_returns_matching_conversation(self) -> None:
        now = before_now(days=5).replace(microsecond=0)
        conversation_id_1 = uuid4().hex
        conversation_id_2 = uuid4().hex
        trace_id = uuid4().hex

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

        response = self.do_request(conversation_id_1, query)
        assert response.status_code == 200
        assert len(response.data) == 2
        for span in response.data:
            assert span["gen_ai.conversation.id"] == conversation_id_1

        response = self.do_request(conversation_id_2, query)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["gen_ai.conversation.id"] == conversation_id_2

    def test_returns_tool_attributes(self) -> None:
        now = before_now(days=5).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now,
            op="gen_ai.execute_tool",
            operation_type="tool",
            trace_id=trace_id,
            tool_name="search_database",
            tool_result="found 3 rows",
            tool_output="tool output payload",
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200
        assert len(response.data) == 1

        span = response.data[0]
        assert span["span.op"] == "gen_ai.execute_tool"
        assert span["gen_ai.operation.type"] == "tool"
        assert span["gen_ai.tool.name"] == "search_database"
        assert span["gen_ai.tool.call.result"] == "found 3 rows"
        assert span["gen_ai.tool.output"] == "tool output payload"

    def test_stats_period_is_tried_first_then_widened(self) -> None:
        timestamp_15d = before_now(days=15).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=timestamp_15d,
            op="gen_ai.chat",
            trace_id=trace_id,
        )

        query = {
            "project": [self.project.id],
            "statsPeriod": "1h",
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["gen_ai.conversation.id"] == conversation_id

    def test_stats_period_recent_conversation_returned_without_widening(self) -> None:
        timestamp_1h = before_now(minutes=30).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=timestamp_1h,
            op="gen_ai.chat",
            trace_id=trace_id,
        )

        query = {
            "project": [self.project.id],
            "statsPeriod": "1h",
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200
        assert len(response.data) == 1

    def test_no_time_params_falls_back_to_30d(self) -> None:
        timestamp = before_now(days=15).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=timestamp,
            op="gen_ai.chat",
            trace_id=trace_id,
        )

        query = {"project": [self.project.id]}

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["gen_ai.conversation.id"] == conversation_id

    def test_tokens_on_multiple_span_types(self) -> None:
        now = before_now(days=5).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.invoke_agent",
            operation_type="invoke_agent",
            description="Test Agent",
            agent_name="Test Agent",
            trace_id=trace_id,
            tokens=500,
            cost=0.05,
        )
        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id,
            tokens=100,
            cost=0.01,
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200
        assert len(response.data) == 2

        spans = sorted(response.data, key=lambda s: s["precise.start_ts"])

        agent_span = spans[0]
        assert agent_span["gen_ai.operation.type"] == "invoke_agent"
        assert agent_span["gen_ai.usage.total_tokens"] == 500
        assert agent_span["gen_ai.cost.total_tokens"] == 0.05

        ai_client_span = spans[1]
        assert ai_client_span["gen_ai.operation.type"] == "ai_client"
        assert ai_client_span["gen_ai.usage.total_tokens"] == 100
        assert ai_client_span["gen_ai.cost.total_tokens"] == 0.01

    def test_timeout_returns_504(self) -> None:
        conversation_id = uuid4().hex

        rpc_timeout = SnubaRPCTimeout(ReadTimeoutError(MagicMock(), "/", "timed out"))

        with patch(
            "sentry.snuba.spans_rpc.Spans.run_table_query",
            side_effect=rpc_timeout,
        ):
            response = self.do_request(conversation_id, {"project": [self.project.id]})

        assert response.status_code == 504

    def _store_error_on_span(self, trace_id, span_id, timestamp, project=None):
        project = project or self.project
        error_data = load_data("javascript", timestamp=timestamp)
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": trace_id,
            "span_id": span_id,
        }
        return self.store_event(error_data, project_id=project.id)

    def test_spans_without_issues_have_empty_arrays(self) -> None:
        now = before_now(days=10).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now,
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id,
        )

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["errors"] == []
        assert response.data[0]["occurrences"] == []

    def test_links_error_issue_to_span(self) -> None:
        now = before_now(days=10).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        span = self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.chat",
            operation_type="ai_client",
            status="error",
            trace_id=trace_id,
        )
        span_id = span["span_id"]

        error = self._store_error_on_span(trace_id, span_id, now)

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200
        assert len(response.data) == 1

        span_data = response.data[0]
        assert span_data["span_id"] == span_id
        assert span_data["occurrences"] == []
        assert len(span_data["errors"]) == 1

        error_issue = span_data["errors"][0]
        assert error_issue["event_id"] == error.event_id
        assert error_issue["issue_id"] == error.group_id
        assert error_issue["level"] == "error"
        assert error_issue["event_type"] == "error"

    def test_error_only_attached_to_matching_span(self) -> None:
        now = before_now(days=10).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        failing_span = self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.execute_tool",
            operation_type="tool",
            status="error",
            trace_id=trace_id,
        )
        healthy_span = self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.chat",
            operation_type="ai_client",
            trace_id=trace_id,
        )

        self._store_error_on_span(trace_id, failing_span["span_id"], now)

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200
        assert len(response.data) == 2

        by_span = {span["span_id"]: span for span in response.data}
        assert len(by_span[failing_span["span_id"]]["errors"]) == 1
        assert by_span[healthy_span["span_id"]]["errors"] == []

    def test_links_errors_across_multiple_traces(self) -> None:
        now = before_now(days=10).replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id_1 = uuid4().hex
        trace_id_2 = uuid4().hex

        span_1 = self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=2),
            op="gen_ai.chat",
            operation_type="ai_client",
            status="error",
            trace_id=trace_id_1,
        )
        span_2 = self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.chat",
            operation_type="ai_client",
            status="error",
            trace_id=trace_id_2,
        )

        self._store_error_on_span(trace_id_1, span_1["span_id"], now)
        self._store_error_on_span(trace_id_2, span_2["span_id"], now)

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200
        assert len(response.data) == 2

        by_span = {span["span_id"]: span for span in response.data}
        assert len(by_span[span_1["span_id"]]["errors"]) == 1
        assert len(by_span[span_2["span_id"]]["errors"]) == 1

    def test_links_occurrence_issue_to_span(self) -> None:
        now = before_now(days=10).replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        span = self.store_ai_span(
            conversation_id=conversation_id,
            timestamp=now - timedelta(seconds=1),
            op="gen_ai.execute_tool",
            operation_type="tool",
            trace_id=trace_id,
        )
        span_id = span["span_id"]

        event_data = load_data("transaction", timestamp=now)
        event_data["contexts"]["trace"]["trace_id"] = trace_id
        event_data["contexts"]["trace"]["span_id"] = span_id
        event = self.store_event(event_data, project_id=self.project.id)

        occurrence = IssueOccurrence(
            id=uuid4().hex,
            resource_id=None,
            project_id=self.project.id,
            event_id=event.event_id,
            fingerprint=[uuid4().hex],
            type=PerformanceFileIOMainThreadGroupType,
            issue_title="File IO on Main Thread",
            subtitle="",
            evidence_display=[],
            evidence_data={"offender_span_ids": [span_id]},
            culprit="",
            detection_time=now,
            level="info",
        )
        with patch("sentry.issues.ingest.should_create_group", return_value=True):
            _, group_info = save_issue_occurrence(occurrence.to_dict(), event)
        assert group_info is not None

        query = {
            "project": [self.project.id],
            "start": (now - timedelta(hours=1)).isoformat(),
            "end": (now + timedelta(hours=1)).isoformat(),
        }

        response = self.do_request(conversation_id, query)
        assert response.status_code == 200
        assert len(response.data) == 1

        span_data = response.data[0]
        assert span_data["span_id"] == span_id
        assert len(span_data["occurrences"]) == 1
        occurrence_issue = span_data["occurrences"][0]
        assert occurrence_issue["event_type"] == "occurrence"
        assert occurrence_issue["issue_id"] == group_info.group.id
        assert occurrence_issue["description"] == "File IO on Main Thread"
