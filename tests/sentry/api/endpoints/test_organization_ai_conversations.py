from datetime import timedelta
from uuid import uuid4

from django.urls import reverse

from sentry.testutils.cases import APITestCase, BaseSpansTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now

LLM_TOKENS = 100
LLM_COST = 0.001


class OrganizationAIConversationsEndpointTest(BaseSpansTestCase, APITestCase):
    view = "sentry-api-0-organization-ai-conversations"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

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
        now = before_now().replace(microsecond=0)
        trace_id = uuid4().hex

        self.store_segment(
            project_id=self.project.id,
            trace_id=trace_id,
            transaction_id=uuid4().hex,
            span_id=uuid4().hex[:16],
            timestamp=now,
            duration=1000,
            organization_id=self.organization.id,
            is_eap=True,
        )

        query = {
            "project": [self.project.id],
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_single_conversation_single_trace(self) -> None:
        """Test a conversation with all spans in a single trace"""
        now = before_now().replace(microsecond=0)
        trace_id = uuid4().hex
        conversation_id = uuid4().hex

        timestamps = []
        for i in range(5):
            ts = now - timedelta(seconds=i)
            timestamps.append(ts)

            if i == 0:
                span_op = "gen_ai.invoke_agent"
                transaction = "Customer Support Agent"
                status = "ok"
                measurements = {}
                tags = {"gen_ai.conversation.id": conversation_id}
            elif i == 1:
                span_op = "gen_ai.chat"
                transaction = "llm-call"
                status = "ok"
                measurements = {
                    "gen_ai.usage.total_tokens": LLM_TOKENS,
                    "gen_ai.usage.total_cost": LLM_COST,
                }
                tags = {
                    "gen_ai.conversation.id": conversation_id,
                    "gen_ai.operation.type": "ai_client",
                }
            elif i == 2:
                span_op = "gen_ai.execute_tool"
                transaction = "tool-call"
                status = "ok"
                measurements = {}
                tags = {"gen_ai.conversation.id": conversation_id}
            elif i == 3:
                span_op = "gen_ai.invoke_agent"
                transaction = "Response Generator"
                status = "ok"
                measurements = {}
                tags = {"gen_ai.conversation.id": conversation_id}
            else:
                span_op = "gen_ai.chat"
                transaction = "llm-call"
                status = "internal_error"
                measurements = {
                    "gen_ai.usage.total_tokens": LLM_TOKENS,
                    "gen_ai.usage.total_cost": LLM_COST,
                }
                tags = {
                    "gen_ai.conversation.id": conversation_id,
                    "gen_ai.operation.type": "ai_client",
                }

            self.store_segment(
                project_id=self.project.id,
                trace_id=trace_id,
                transaction_id=uuid4().hex,
                span_id=uuid4().hex[:16],
                timestamp=ts,
                duration=500 + i * 100,
                organization_id=self.organization.id,
                is_eap=True,
                op=span_op,
                transaction=transaction,
                status=status,
                tags=tags,
                measurements=measurements,
            )

        query = {
            "project": [self.project.id],
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
        assert conversation["duration"] > 0
        assert conversation["timestamp"] > 0
        assert conversation["flow"] == ["Customer Support Agent", "Response Generator"]

    def test_conversation_spanning_multiple_traces(self) -> None:
        """Test a conversation with spans across multiple traces"""
        now = before_now().replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id_1 = uuid4().hex
        trace_id_2 = uuid4().hex

        self.store_segment(
            project_id=self.project.id,
            trace_id=trace_id_1,
            transaction_id=uuid4().hex,
            span_id=uuid4().hex[:16],
            timestamp=now - timedelta(seconds=3),
            duration=1000,
            organization_id=self.organization.id,
            is_eap=True,
            op="gen_ai.invoke_agent",
            transaction="Research Agent",
            status="ok",
            tags={"gen_ai.conversation.id": conversation_id},
            measurements={},
        )

        self.store_segment(
            project_id=self.project.id,
            trace_id=trace_id_1,
            transaction_id=uuid4().hex,
            span_id=uuid4().hex[:16],
            timestamp=now - timedelta(seconds=2),
            duration=1000,
            organization_id=self.organization.id,
            is_eap=True,
            op="gen_ai.chat",
            transaction="llm-call",
            status="ok",
            tags={
                "gen_ai.conversation.id": conversation_id,
                "gen_ai.operation.type": "ai_client",
            },
            measurements={
                "gen_ai.usage.total_tokens": LLM_TOKENS,
                "gen_ai.usage.total_cost": LLM_COST,
            },
        )

        self.store_segment(
            project_id=self.project.id,
            trace_id=trace_id_2,
            transaction_id=uuid4().hex,
            span_id=uuid4().hex[:16],
            timestamp=now - timedelta(seconds=1),
            duration=1000,
            organization_id=self.organization.id,
            is_eap=True,
            op="gen_ai.invoke_agent",
            transaction="Summarization Agent",
            status="ok",
            tags={"gen_ai.conversation.id": conversation_id},
            measurements={},
        )

        self.store_segment(
            project_id=self.project.id,
            trace_id=trace_id_2,
            transaction_id=uuid4().hex,
            span_id=uuid4().hex[:16],
            timestamp=now,
            duration=1000,
            organization_id=self.organization.id,
            is_eap=True,
            op="gen_ai.chat",
            transaction="llm-call",
            status="ok",
            tags={
                "gen_ai.conversation.id": conversation_id,
                "gen_ai.operation.type": "ai_client",
            },
            measurements={
                "gen_ai.usage.total_tokens": LLM_TOKENS,
                "gen_ai.usage.total_cost": LLM_COST,
            },
        )

        query = {
            "project": [self.project.id],
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

    def test_multiple_conversations(self) -> None:
        """Test multiple conversations are returned correctly"""
        now = before_now().replace(microsecond=0)
        conversation_id_1 = uuid4().hex
        conversation_id_2 = uuid4().hex

        self.store_segment(
            project_id=self.project.id,
            trace_id=uuid4().hex,
            transaction_id=uuid4().hex,
            span_id=uuid4().hex[:16],
            timestamp=now - timedelta(minutes=2),
            duration=1000,
            organization_id=self.organization.id,
            is_eap=True,
            op="gen_ai.chat",
            status="ok",
            tags={
                "gen_ai.conversation.id": conversation_id_1,
                "gen_ai.operation.type": "ai_client",
            },
            measurements={
                "gen_ai.usage.total_tokens": LLM_TOKENS,
                "gen_ai.usage.total_cost": LLM_COST,
            },
        )

        self.store_segment(
            project_id=self.project.id,
            trace_id=uuid4().hex,
            transaction_id=uuid4().hex,
            span_id=uuid4().hex[:16],
            timestamp=now - timedelta(minutes=1),
            duration=1000,
            organization_id=self.organization.id,
            is_eap=True,
            op="gen_ai.chat",
            status="ok",
            tags={
                "gen_ai.conversation.id": conversation_id_2,
                "gen_ai.operation.type": "ai_client",
            },
            measurements={
                "gen_ai.usage.total_tokens": LLM_TOKENS,
                "gen_ai.usage.total_cost": LLM_COST,
            },
        )

        query = {
            "project": [self.project.id],
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 2

        assert response.data[0]["conversationId"] == conversation_id_2
        assert response.data[1]["conversationId"] == conversation_id_1

    def test_pagination(self) -> None:
        """Test pagination works correctly"""
        now = before_now().replace(microsecond=0)

        for i in range(3):
            conversation_id = uuid4().hex
            self.store_segment(
                project_id=self.project.id,
                trace_id=uuid4().hex,
                transaction_id=uuid4().hex,
                span_id=uuid4().hex[:16],
                timestamp=now - timedelta(minutes=i),
                duration=1000,
                organization_id=self.organization.id,
                is_eap=True,
                op="gen_ai.chat",
                status="ok",
                tags={"gen_ai.conversation.id": conversation_id},
                measurements={},
            )

        query = {
            "project": [self.project.id],
            "per_page": "2",
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
        now = before_now().replace(microsecond=0)
        conversation_id = uuid4().hex

        self.store_segment(
            project_id=self.project.id,
            trace_id=uuid4().hex,
            transaction_id=uuid4().hex,
            span_id=uuid4().hex[:16],
            timestamp=now,
            duration=1000,
            organization_id=self.organization.id,
            is_eap=True,
            op="default",
            status="ok",
            tags={"gen_ai.conversation.id": conversation_id},
            measurements={},
        )

        query = {
            "project": [self.project.id],
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        assert conversation["conversationId"] == conversation_id
        assert conversation["errors"] == 0
        assert conversation["llmCalls"] == 0
        assert conversation["toolCalls"] == 0
        assert conversation["totalTokens"] == 0
        assert conversation["totalCost"] == 0.0
        assert conversation["flow"] == []

    def test_mixed_error_statuses(self) -> None:
        """Test that various error statuses are counted correctly"""
        now = before_now().replace(microsecond=0)
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
            self.store_segment(
                project_id=self.project.id,
                trace_id=trace_id,
                transaction_id=uuid4().hex,
                span_id=uuid4().hex[:16],
                timestamp=now - timedelta(seconds=i),
                duration=1000,
                organization_id=self.organization.id,
                is_eap=True,
                status=span_status,
                tags={"gen_ai.conversation.id": conversation_id},
            )

        query = {
            "project": [self.project.id],
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        assert conversation["errors"] == 3

    def test_flow_ordering(self) -> None:
        """Test that flow agents are ordered by timestamp"""
        now = before_now().replace(microsecond=0)
        conversation_id = uuid4().hex
        trace_id = uuid4().hex

        agents = [
            ("Agent A", now - timedelta(seconds=5)),
            ("Agent B", now - timedelta(seconds=3)),
            ("Agent C", now - timedelta(seconds=1)),
        ]

        for agent_name, timestamp in agents:
            self.store_segment(
                project_id=self.project.id,
                trace_id=trace_id,
                transaction_id=uuid4().hex,
                span_id=uuid4().hex[:16],
                timestamp=timestamp,
                duration=1000,
                organization_id=self.organization.id,
                is_eap=True,
                op="gen_ai.invoke_agent",
                transaction=agent_name,
                status="ok",
                tags={"gen_ai.conversation.id": conversation_id},
            )

        query = {
            "project": [self.project.id],
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data) == 1

        conversation = response.data[0]
        assert conversation["flow"] == ["Agent A", "Agent B", "Agent C"]
