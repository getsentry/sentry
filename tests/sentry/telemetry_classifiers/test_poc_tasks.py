from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from sentry.seer.models.seer_api_models import SeerApiError
from sentry.telemetry_classifiers.poc_tasks import (
    _fetch_conversation_rows,
    _user_messages_from_rows,
    classify_conversation,
    schedule_conversation_classifiers,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import cell_silo_test
from sentry.utils import json
from tests.sentry.api.endpoints.test_organization_ai_conversations_base import (
    BaseAIConversationsTestCase,
)


def test_user_messages_from_rows_deduplicates_content() -> None:
    rows = [
        {
            "gen_ai.input.messages": json.dumps(
                [
                    {"role": "user", "content": "First question"},
                    {"role": "assistant", "content": "First answer"},
                ]
            )
        },
        {
            "gen_ai.input.messages": json.dumps(
                [
                    {"role": "user", "content": "First question"},
                    {"role": "user", "content": "Second question"},
                ]
            )
        },
    ]

    messages, truncated = _user_messages_from_rows(rows)

    assert messages == [
        {"role": "user", "content": "First question"},
        {"role": "user", "content": "Second question"},
    ]
    assert truncated is False


def test_user_messages_from_rows_keeps_latest_content_within_limit() -> None:
    rows = [
        {"gen_ai.input.messages": "older"},
        {"gen_ai.input.messages": "newer"},
    ]

    with patch("sentry.telemetry_classifiers.poc_tasks._MAX_INPUT_CHARS", 5):
        messages, truncated = _user_messages_from_rows(rows)

    assert messages == [{"role": "user", "content": "newer"}]
    assert truncated is True


class FetchConversationRowsTest(BaseAIConversationsTestCase):
    def test_fetches_rows_within_last_span_second(self) -> None:
        start = (timezone.now() - timedelta(minutes=30)).replace(microsecond=500_000)
        first_span = self.store_ai_span(
            "conversation",
            start,
            operation_type="ai_client",
            trace_id="1" * 32,
            input_messages=[{"role": "user", "content": "First question"}],
            store=False,
        )
        first_span["data"]["sentry.client_sample_rate"] = 0.5
        first_span["measurements"] = {"client_sample_rate": {"value": 0.5}}
        second_span = self.store_ai_span(
            "conversation",
            start + timedelta(seconds=1),
            operation_type="ai_client",
            trace_id="2" * 32,
            input_messages=[{"role": "user", "content": "Second question"}],
            store=False,
        )
        second_span["data"]["sentry.client_sample_rate"] = 0.25
        second_span["measurements"] = {"client_sample_rate": {"value": 0.25}}
        self.store_spans([first_span, second_span])
        self.store_ai_span(
            "conversation",
            start + timedelta(seconds=2),
            input_messages=[{"role": "user", "content": "Excluded question"}],
        )

        rows, source_truncated = _fetch_conversation_rows(
            self.project,
            "conversation",
            (start + timedelta(seconds=1)).replace(microsecond=0).timestamp(),
        )
        messages, input_truncated = _user_messages_from_rows(
            rows, source_truncated=source_truncated
        )

        assert messages == [
            {"role": "user", "content": "First question"},
            {"role": "user", "content": "Second question"},
        ]
        assert [row["trace"] for row in rows] == ["1" * 32, "2" * 32]
        assert [row["client_sample_rate"] for row in rows] == [0.5, 0.25]
        assert input_truncated is False


@cell_silo_test
class ClassifyConversationTest(TestCase):
    def test_logs_probability(self) -> None:
        messages = [{"role": "user", "content": "Why do you keep ignoring me?"}]
        with (
            patch(
                "sentry.telemetry_classifiers.poc_tasks._fetch_conversation_rows",
                return_value=(
                    [
                        {
                            "gen_ai.input.messages": messages[0]["content"],
                            "trace": "1" * 32,
                            "client_sample_rate": 0.25,
                        }
                    ],
                    False,
                ),
            ) as mock_fetch,
            patch(
                "sentry.telemetry_classifiers.poc_tasks.run_oneshot",
                return_value={"type": "predicate", "name": "match", "probability": 0.9},
            ) as mock_run,
            patch("sentry.telemetry_classifiers.poc_tasks.logger.info") as mock_log,
            patch(
                "sentry.telemetry_classifiers.poc_tasks.produce_enrichment_attributes"
            ) as mock_produce,
        ):
            classify_conversation(self.project.id, "conversation", 1_735_689_600.0)

        mock_fetch.assert_called_once_with(self.project, "conversation", 1_735_689_600.0)
        mock_run.assert_called_once_with(
            "conversation_user_frustration",
            {"messages": messages},
            self.organization,
            timeout=20,
        )
        mock_produce.assert_called_once_with(
            self.project,
            idempotency_key="\0".join(("user_frustration", "conversation", "1735689600.0")),
            trace_id="1" * 32,
            timestamp=datetime(2025, 1, 1, tzinfo=UTC),
            retention_days=30,
            conversation_id="conversation",
            attributes={"sentry.enrichment.poc_user_frustration": 0.9},
            client_sample_rate=0.25,
        )
        mock_log.assert_called_once_with(
            "telemetry_classifiers.conversation.classified",
            extra={
                "organization_id": self.organization.id,
                "project_id": self.project.id,
                "conversation_id": "conversation",
                "last_span_timestamp": 1_735_689_600.0,
                "classifier": "user_frustration",
                "probability": 0.9,
                "message_count": 1,
                "input_truncated": False,
            },
        )

    def test_rejects_invalid_response(self) -> None:
        with (
            patch(
                "sentry.telemetry_classifiers.poc_tasks._fetch_conversation_rows",
                return_value=([{"gen_ai.input.messages": "Question", "trace": "1" * 32}], False),
            ),
            patch(
                "sentry.telemetry_classifiers.poc_tasks.run_oneshot",
                return_value={"type": "predicate", "name": "match", "probability": 2},
            ),
            patch("sentry.telemetry_classifiers.poc_tasks.logger.error") as mock_log,
        ):
            classify_conversation(self.project.id, "conversation", 1_735_689_600.0)

        mock_log.assert_called_once_with(
            "telemetry_classifiers.conversation.failed",
            extra={
                "organization_id": self.organization.id,
                "project_id": self.project.id,
                "conversation_id": "conversation",
                "last_span_timestamp": 1_735_689_600.0,
                "classifier": "user_frustration",
                "reason": "invalid_response",
            },
        )

    def test_raises_retryable_seer_error(self) -> None:
        with (
            patch(
                "sentry.telemetry_classifiers.poc_tasks._fetch_conversation_rows",
                return_value=([{"gen_ai.input.messages": "Question", "trace": "1" * 32}], False),
            ),
            patch(
                "sentry.telemetry_classifiers.poc_tasks.run_oneshot",
                side_effect=SeerApiError("Unavailable", 503),
            ),
            patch("sentry.telemetry_classifiers.poc_tasks.logger.exception"),
            pytest.raises(SeerApiError),
        ):
            classify_conversation(self.project.id, "conversation", 1_735_689_600.0)


@override_options(
    {
        "classifiers.conversations.project-ids": [1],
        "classifiers.conversations.telemetry-limit": 2,
    }
)
def test_scheduler_does_not_enqueue_for_enrolled_projects() -> None:
    with (
        patch("sentry.telemetry_classifiers.poc_tasks.Project.objects.filter") as mock_projects,
        patch("sentry.telemetry_classifiers.poc_tasks.Spans.run_table_query") as mock_query,
        patch(
            "sentry.telemetry_classifiers.poc_tasks.classify_conversation.delay"
        ) as mock_classify,
    ):
        schedule_conversation_classifiers()

    mock_projects.assert_not_called()
    mock_query.assert_not_called()
    mock_classify.assert_not_called()
