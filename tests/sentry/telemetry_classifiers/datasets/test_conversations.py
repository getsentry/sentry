from datetime import datetime, timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.telemetry_classifiers.datasets.conversations import ConversationDataset
from sentry.telemetry_classifiers.types import TelemetryInput
from tests.sentry.api.endpoints.test_organization_ai_conversations_base import (
    BaseAIConversationsTestCase,
)

DATASET = ConversationDataset()


class SelectConversationsTest(BaseAIConversationsTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.end = timezone.now().replace(second=0, microsecond=0) - timedelta(minutes=20)
        self.start = self.end - timedelta(minutes=5)

    def store_conversation_span(
        self, conversation_id: str, timestamp: datetime, agent_name: str | None = None
    ) -> None:
        self.store_ai_span(
            conversation_id, timestamp, operation_type="ai_client", agent_name=agent_name
        )

    def select(self, filter_query: str = "") -> list[str]:
        return DATASET.select(self.project, filter_query, self.start, self.end, limit=100)

    def test_selects_conversations_that_became_inactive_in_window(self) -> None:
        self.store_conversation_span("inactive", self.end - timedelta(minutes=2))
        self.store_conversation_span("still-active", self.end - timedelta(minutes=2))
        self.store_conversation_span("still-active", self.end + timedelta(minutes=10))
        self.store_conversation_span("inactive-earlier", self.start - timedelta(minutes=1))

        assert self.select() == ["inactive"]

    def test_filter_matches_spans_from_before_the_window(self) -> None:
        self.store_conversation_span(
            "researcher", self.start - timedelta(days=2), agent_name="researcher"
        )
        self.store_conversation_span("researcher", self.end - timedelta(minutes=2))
        self.store_conversation_span("writer", self.start - timedelta(days=2), agent_name="writer")
        self.store_conversation_span("writer", self.end - timedelta(minutes=2))

        assert self.select("gen_ai.agent.name:researcher") == ["researcher"]

    def test_respects_limit(self) -> None:
        self.store_conversation_span("first", self.end - timedelta(minutes=3))
        self.store_conversation_span("second", self.end - timedelta(minutes=2))

        assert DATASET.select(self.project, "", self.start, self.end, limit=1) == ["first"]

    def test_limit_applies_after_the_filter(self) -> None:
        self.store_conversation_span("writer", self.end - timedelta(minutes=3), agent_name="writer")
        self.store_conversation_span(
            "researcher", self.end - timedelta(minutes=2), agent_name="researcher"
        )

        assert DATASET.select(
            self.project, "gen_ai.agent.name:researcher", self.start, self.end, limit=1
        ) == ["researcher"]


class LoadConversationTest(BaseAIConversationsTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.start = timezone.now().replace(microsecond=0) - timedelta(minutes=30)

    def test_loads_distinct_messages_oldest_first(self) -> None:
        self.store_ai_span(
            "conversation",
            self.start,
            operation_type="ai_client",
            trace_id="1" * 32,
            input_messages=[
                {"role": "system", "content": "You are helpful."},
                {"role": "user", "content": "Use PostgreSQL."},
            ],
            output_messages=[{"role": "assistant", "content": "Here is MySQL."}],
        )
        self.store_ai_span(
            "conversation",
            self.start + timedelta(seconds=5),
            operation_type="ai_client",
            trace_id="2" * 32,
            input_messages=[
                {"role": "system", "content": "You are helpful."},
                {"role": "user", "content": "Use PostgreSQL."},
                {"role": "assistant", "content": "Here is MySQL."},
                {"role": "user", "content": "I said PostgreSQL!"},
            ],
        )
        self.store_ai_span(
            "conversation", self.start + timedelta(seconds=10), operation_type="tool"
        )

        assert DATASET.load(self.project, "conversation") == TelemetryInput(
            events=[
                {"role": "user", "content": "Use PostgreSQL."},
                {"role": "assistant", "content": "Here is MySQL."},
                {"role": "user", "content": "I said PostgreSQL!"},
            ],
            truncated=False,
            trace_id="2" * 32,
            timestamp=self.start + timedelta(seconds=5),
            client_sample_rate=1.0,
            conversation_id="conversation",
        )

    def test_keeps_newest_spans_and_cuts_long_messages(self) -> None:
        for index, content in enumerate(["oldest", "older", "x" * 20]):
            self.store_ai_span(
                "conversation",
                self.start + timedelta(seconds=index),
                operation_type="ai_client",
                input_messages=[{"role": "user", "content": content}],
            )

        with (
            patch("sentry.telemetry_classifiers.datasets.conversations.MAX_SPANS", 2),
            patch("sentry.telemetry_classifiers.datasets.conversations.MAX_MESSAGE_CHARS", 10),
            patch("sentry.telemetry_classifiers.datasets.conversations.metrics.incr") as incr,
        ):
            loaded = DATASET.load(self.project, "conversation")

        assert loaded is not None
        assert loaded.events == [
            {"role": "user", "content": "older"},
            {"role": "user", "content": "x" * 10},
        ]
        assert loaded.truncated
        incr.assert_called_once_with(
            "telemetry_classifiers.load.truncated", tags={"dataset": "conversation"}
        )

    def test_returns_none_without_message_spans(self) -> None:
        self.store_ai_span("conversation", self.start, operation_type="tool")

        assert DATASET.load(self.project, "conversation") is None
