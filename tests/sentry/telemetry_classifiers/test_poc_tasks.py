from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, call, patch

import pytest
from django.utils import timezone

from sentry.seer.models.seer_api_models import SeerApiError
from sentry.telemetry_classifiers.poc_tasks import (
    _claim_conversations,
    _ConversationRef,
    _fetch_conversation_rows,
    _fetch_conversations,
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


class FetchConversationsTest(BaseAIConversationsTestCase):
    def test_fetches_only_conversations_that_became_inactive_in_window(self) -> None:
        scan_time = timezone.now().replace(second=0, microsecond=0)
        self.store_ai_span(
            "eligible",
            scan_time - timedelta(minutes=22),
            operation_type="ai_client",
        )
        self.store_ai_span(
            "still-active",
            scan_time - timedelta(minutes=22),
            operation_type="ai_client",
        )
        self.store_ai_span(
            "still-active",
            scan_time - timedelta(minutes=10),
            operation_type="ai_client",
        )
        self.store_ai_span(
            "too-old",
            scan_time - timedelta(minutes=26),
            operation_type="ai_client",
        )
        self.store_ai_span(
            "too-new",
            scan_time - timedelta(minutes=19),
            operation_type="ai_client",
        )

        conversations = _fetch_conversations(
            self.project,
            scan_time,
            limit=100,
        )

        assert conversations == [
            _ConversationRef(
                project_id=self.project.id,
                conversation_id="eligible",
                last_span_timestamp=(scan_time - timedelta(minutes=22)).timestamp(),
            )
        ]


def test_claim_conversations_returns_new_claims() -> None:
    conversations = [
        _ConversationRef(project_id=1, conversation_id="conversation-a", last_span_timestamp=1.0),
        _ConversationRef(project_id=1, conversation_id="conversation-a", last_span_timestamp=2.0),
    ]
    client = MagicMock()
    pipeline = client.pipeline.return_value.__enter__.return_value
    pipeline.execute.return_value = [True, None]

    with patch(
        "sentry.telemetry_classifiers.poc_tasks.redis_clusters.get",
        return_value=client,
    ):
        claimed = _claim_conversations(conversations)

    assert claimed == [conversations[0]]
    client.pipeline.assert_called_once_with(transaction=False)
    assert pipeline.set.call_count == 2
    first_key = pipeline.set.call_args_list[0].args[0]
    second_key = pipeline.set.call_args_list[1].args[0]
    assert first_key != second_key
    assert "conversation-a" not in first_key
    assert not first_key.endswith(":user_frustration")
    assert pipeline.set.call_args_list[0].kwargs == {"ex": 3600, "nx": True}


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
    def test_fetches_gen_ai_rows_once_for_message_extraction(self) -> None:
        start = timezone.now() - timedelta(minutes=30)
        self.store_ai_span(
            "conversation",
            start,
            operation_type="ai_client",
            input_messages=[{"role": "user", "content": "First question"}],
        )
        self.store_ai_span(
            "conversation",
            start + timedelta(seconds=1),
            operation_type="ai_client",
            input_messages=[{"role": "user", "content": "Second question"}],
        )
        self.store_ai_span(
            "conversation",
            start + timedelta(seconds=2),
            input_messages=[{"role": "user", "content": "Excluded question"}],
        )

        rows, source_truncated = _fetch_conversation_rows(
            self.project,
            "conversation",
            (start + timedelta(seconds=3)).timestamp(),
        )
        messages, input_truncated = _user_messages_from_rows(
            rows, source_truncated=source_truncated
        )

        assert messages == [
            {"role": "user", "content": "First question"},
            {"role": "user", "content": "Second question"},
        ]
        assert input_truncated is False


@cell_silo_test
class ClassifyConversationTest(TestCase):
    def test_logs_probability(self) -> None:
        messages = [{"role": "user", "content": "Why do you keep ignoring me?"}]
        with (
            patch(
                "sentry.telemetry_classifiers.poc_tasks._fetch_conversation_rows",
                return_value=([{"gen_ai.input.messages": messages[0]["content"]}], False),
            ) as mock_fetch,
            patch(
                "sentry.telemetry_classifiers.poc_tasks.run_oneshot",
                return_value={"type": "predicate", "name": "match", "probability": 0.9},
            ) as mock_run,
            patch("sentry.telemetry_classifiers.poc_tasks.logger.info") as mock_log,
        ):
            classify_conversation(self.project.id, "conversation", 1_735_689_600.0)

        mock_fetch.assert_called_once_with(self.project, "conversation", 1_735_689_600.0)
        mock_run.assert_called_once_with(
            "conversation_user_frustration",
            {"messages": messages},
            self.organization,
            timeout=20,
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
                return_value=([{"gen_ai.input.messages": "Question"}], False),
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
                return_value=([{"gen_ai.input.messages": "Question"}], False),
            ),
            patch(
                "sentry.telemetry_classifiers.poc_tasks.run_oneshot",
                side_effect=SeerApiError("Unavailable", 503),
            ),
            patch("sentry.telemetry_classifiers.poc_tasks.logger.exception"),
            pytest.raises(SeerApiError),
        ):
            classify_conversation(self.project.id, "conversation", 1_735_689_600.0)


@cell_silo_test
class ScheduleConversationClassifiersTest(TestCase):
    @override_options({"classifiers.conversations.telemetry-limit": 2})
    @patch("sentry.telemetry_classifiers.poc_tasks._fetch_conversations")
    @patch("sentry.telemetry_classifiers.poc_tasks.logger.info")
    def test_disabled_without_projects(
        self,
        mock_log: MagicMock,
        mock_fetch: MagicMock,
    ) -> None:
        schedule_conversation_classifiers()

        mock_fetch.assert_not_called()
        mock_log.assert_not_called()

    @override_options({"classifiers.conversations.telemetry-limit": 2})
    @patch("sentry.telemetry_classifiers.poc_tasks.timezone_now")
    @patch("sentry.telemetry_classifiers.poc_tasks.classify_conversation.delay")
    @patch("sentry.telemetry_classifiers.poc_tasks._claim_conversations")
    @patch("sentry.telemetry_classifiers.poc_tasks._fetch_conversations")
    @patch("sentry.telemetry_classifiers.poc_tasks.logger.info")
    def test_fetches_each_project_with_limit_and_logs_counts(
        self,
        mock_log: MagicMock,
        mock_fetch: MagicMock,
        mock_claim: MagicMock,
        mock_classify: MagicMock,
        mock_now: MagicMock,
    ) -> None:
        now = datetime(2020, 1, 1, 12, 7, 31, tzinfo=UTC)
        scan_time = datetime(2020, 1, 1, 12, 5, tzinfo=UTC)
        first_project = self.project
        second_project = self.create_project(
            organization=self.organization,
            teams=[self.team],
            name="Second",
            slug="second",
        )
        first_conversations = [
            _ConversationRef(
                project_id=first_project.id,
                conversation_id="one",
                last_span_timestamp=1.0,
            ),
            _ConversationRef(
                project_id=first_project.id,
                conversation_id="two",
                last_span_timestamp=2.0,
            ),
        ]
        second_conversations = [
            _ConversationRef(
                project_id=second_project.id,
                conversation_id="three",
                last_span_timestamp=3.0,
            )
        ]
        mock_now.return_value = now
        mock_fetch.side_effect = [first_conversations, second_conversations]
        mock_claim.side_effect = [[first_conversations[0]], [second_conversations[0]]]

        with override_options(
            {"classifiers.conversations.project-ids": [first_project.id, second_project.id]}
        ):
            schedule_conversation_classifiers()

        assert mock_fetch.call_args_list == [
            call(first_project, scan_time, 2),
            call(second_project, scan_time, 2),
        ]
        assert mock_claim.call_args_list == [
            call(first_conversations),
            call(second_conversations),
        ]
        assert mock_classify.call_args_list == [
            call(
                project_id=first_project.id,
                conversation_id="one",
                last_span_timestamp=1.0,
            ),
            call(
                project_id=second_project.id,
                conversation_id="three",
                last_span_timestamp=3.0,
            ),
        ]
        mock_log.assert_called_once_with(
            "telemetry_classifiers.conversations.fetched",
            extra={
                "fetched_count": 3,
                "claimed_count": 2,
                "window_start": "2020-01-01T11:40:00+00:00",
                "window_end": "2020-01-01T11:45:00+00:00",
            },
        )
