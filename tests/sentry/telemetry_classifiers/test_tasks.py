from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, call, patch

from django.utils import timezone

from sentry.telemetry_classifiers.tasks import (
    _claim_conversations,
    _ConversationRef,
    _fetch_conversations,
    schedule_conversation_classifiers,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import cell_silo_test
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

        assert [(item.project_id, item.conversation_id) for item in conversations] == [
            (self.project.id, "eligible")
        ]


def test_claim_conversations_deduplicates_by_version() -> None:
    conversations = [
        _ConversationRef(project_id=1, conversation_id="conversation-a", version="first"),
        _ConversationRef(project_id=1, conversation_id="conversation-a", version="second"),
    ]
    client = MagicMock()
    pipeline = client.pipeline.return_value.__enter__.return_value
    pipeline.execute.return_value = [True, None]

    with patch(
        "sentry.telemetry_classifiers.tasks.redis_clusters.get",
        return_value=client,
    ):
        claimed = _claim_conversations(conversations)

    assert claimed == 1
    client.pipeline.assert_called_once_with(transaction=False)
    assert pipeline.set.call_count == 2
    first_key = pipeline.set.call_args_list[0].args[0]
    second_key = pipeline.set.call_args_list[1].args[0]
    assert first_key != second_key
    assert "conversation-a" not in first_key
    assert pipeline.set.call_args_list[0].kwargs == {"ex": 3600, "nx": True}


@cell_silo_test
class ScheduleConversationClassifiersTest(TestCase):
    @override_options({"classifiers.conversations.telemetry-limit": 2})
    @patch("sentry.telemetry_classifiers.tasks._fetch_conversations")
    @patch("sentry.telemetry_classifiers.tasks.logger.info")
    def test_disabled_without_projects(
        self,
        mock_log: MagicMock,
        mock_fetch: MagicMock,
    ) -> None:
        schedule_conversation_classifiers()

        mock_fetch.assert_not_called()
        mock_log.assert_not_called()

    @override_options({"classifiers.conversations.telemetry-limit": 2})
    @patch("sentry.telemetry_classifiers.tasks.timezone_now")
    @patch("sentry.telemetry_classifiers.tasks._claim_conversations")
    @patch("sentry.telemetry_classifiers.tasks._fetch_conversations")
    @patch("sentry.telemetry_classifiers.tasks.logger.info")
    def test_fetches_each_project_with_limit_and_logs_counts(
        self,
        mock_log: MagicMock,
        mock_fetch: MagicMock,
        mock_claim: MagicMock,
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
            _ConversationRef(project_id=first_project.id, conversation_id="one", version="v1"),
            _ConversationRef(project_id=first_project.id, conversation_id="two", version="v1"),
        ]
        second_conversations = [
            _ConversationRef(project_id=second_project.id, conversation_id="three", version="v1")
        ]
        mock_now.return_value = now
        mock_fetch.side_effect = [first_conversations, second_conversations]
        mock_claim.side_effect = [1, 1]

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
        mock_log.assert_called_once_with(
            "telemetry_classifiers.conversations.fetched",
            extra={
                "fetched_count": 3,
                "claimed_count": 2,
                "window_start": "2020-01-01T11:40:00+00:00",
                "window_end": "2020-01-01T11:45:00+00:00",
            },
        )
