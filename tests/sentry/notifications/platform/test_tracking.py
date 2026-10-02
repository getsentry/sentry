from dataclasses import replace
from unittest import mock

from sentry.analytics.events.notification_tracking import (
    NotificationTrackingEngagementEvent,
    NotificationTrackingSentEvent,
)
from sentry.notifications.platform.tracking import (
    NotificationEngagementMechanism,
    NotificationTrackingContext,
    is_tracking_enabled,
    record_engagement,
    record_sent,
)
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationProviderKey,
    NotificationSource,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import (
    assert_last_analytics_event,
    get_last_analytics_event,
)
from sentry.testutils.helpers.options import override_options

ENABLED_OPTIONS = {"notifications.tracking.sources": ["activity-seer-rca-completed"]}

CONTEXT = NotificationTrackingContext(
    source=NotificationSource.ACTIVITY_SEER_RCA_COMPLETED,
    provider=NotificationProviderKey.EMAIL,
    category=NotificationCategory.ACTIVITY,
    notification_uuid="0b1c3a4e-7d0f-4b8a-9b6e-0c7a2f3d5e61",
    organization_id=1,
)


class IsTrackingEnabledTest(TestCase):
    def test_disabled_by_default(self) -> None:
        assert not is_tracking_enabled(
            NotificationSource.ACTIVITY_SEER_RCA_COMPLETED, NotificationProviderKey.EMAIL
        )

    @override_options(ENABLED_OPTIONS)
    def test_source_listed(self) -> None:
        assert is_tracking_enabled(
            NotificationSource.ACTIVITY_SEER_RCA_COMPLETED, NotificationProviderKey.EMAIL
        )

    @override_options(ENABLED_OPTIONS)
    def test_source_not_listed(self) -> None:
        assert not is_tracking_enabled(
            NotificationSource.DATA_EXPORT_SUCCESS, NotificationProviderKey.EMAIL
        )

    @override_options({"notifications.tracking.sources": ["alert"]})
    def test_legacy_source_and_provider(self) -> None:
        assert is_tracking_enabled("alert", "pagerduty")

    @override_options(ENABLED_OPTIONS)
    def test_unknown_provider(self) -> None:
        assert not is_tracking_enabled(NotificationSource.ACTIVITY_SEER_RCA_COMPLETED, "carrier")


@mock.patch("sentry.notifications.platform.tracking.sentry_sdk.metrics.count")
@mock.patch("sentry.notifications.platform.tracking.metrics.incr")
@mock.patch("sentry.analytics.record")
class RecordSentTest(TestCase):
    @override_options(ENABLED_OPTIONS)
    def test_records_metrics_and_event(
        self, mock_record: mock.MagicMock, mock_incr: mock.MagicMock, mock_count: mock.MagicMock
    ) -> None:
        record_sent(CONTEXT, links=["issue", "seer"])

        tags = {
            "source": "activity-seer-rca-completed",
            "provider": "email",
            "category": "activity",
        }
        assert mock_incr.call_args_list == [
            mock.call("notifications.tracking.sent", tags=tags, sample_rate=1.0),
            mock.call(
                "notifications.tracking.link_sent", tags={**tags, "link": "issue"}, sample_rate=1.0
            ),
            mock.call(
                "notifications.tracking.link_sent", tags={**tags, "link": "seer"}, sample_rate=1.0
            ),
        ]
        assert mock_count.call_args_list == [
            mock.call("notifications.tracking.sent", 1, attributes=tags),
            mock.call("notifications.tracking.link_sent", 1, attributes={**tags, "link": "issue"}),
            mock.call("notifications.tracking.link_sent", 1, attributes={**tags, "link": "seer"}),
        ]
        assert_last_analytics_event(
            mock_record,
            NotificationTrackingSentEvent(
                organization_id=1,
                notification_uuid=CONTEXT.notification_uuid,
                source="activity-seer-rca-completed",
                category="activity",
                provider="email",
                stage=None,
                links=["issue", "seer"],
            ),
        )

    @override_options(ENABLED_OPTIONS)
    def test_stage_tag(
        self, mock_record: mock.MagicMock, mock_incr: mock.MagicMock, mock_count: mock.MagicMock
    ) -> None:
        record_sent(replace(CONTEXT, stage="root_cause"))

        tags = {
            "source": "activity-seer-rca-completed",
            "provider": "email",
            "category": "activity",
            "stage": "root_cause",
        }
        mock_incr.assert_called_once_with("notifications.tracking.sent", tags=tags, sample_rate=1.0)

    def test_disabled(
        self, mock_record: mock.MagicMock, mock_incr: mock.MagicMock, mock_count: mock.MagicMock
    ) -> None:
        record_sent(CONTEXT, links=["issue"])

        mock_incr.assert_not_called()
        mock_count.assert_not_called()
        mock_record.assert_not_called()

    @override_options(ENABLED_OPTIONS)
    @mock.patch("sentry.notifications.platform.tracking.logger")
    def test_failure_does_not_raise(
        self,
        mock_logger: mock.MagicMock,
        mock_record: mock.MagicMock,
        mock_incr: mock.MagicMock,
        mock_count: mock.MagicMock,
    ) -> None:
        mock_record.side_effect = Exception("boom")

        record_sent(CONTEXT)

        mock_logger.exception.assert_called_once()


@mock.patch("sentry.notifications.platform.tracking.sentry_sdk.metrics.count")
@mock.patch("sentry.notifications.platform.tracking.metrics.incr")
@mock.patch("sentry.analytics.record")
class RecordEngagementTest(TestCase):
    @override_options(ENABLED_OPTIONS)
    def test_records_metrics_and_event(
        self, mock_record: mock.MagicMock, mock_incr: mock.MagicMock, mock_count: mock.MagicMock
    ) -> None:
        record_engagement(
            CONTEXT,
            mechanism=NotificationEngagementMechanism.PAGE_LOAD,
            link="issue",
            user_id=2,
        )

        tags = {
            "source": "activity-seer-rca-completed",
            "provider": "email",
            "category": "activity",
            "mechanism": "page_load",
            "link": "issue",
        }
        mock_incr.assert_called_once_with(
            "notifications.tracking.engagement", tags=tags, sample_rate=1.0
        )
        mock_count.assert_called_once_with("notifications.tracking.engagement", 1, attributes=tags)
        assert_last_analytics_event(
            mock_record,
            NotificationTrackingEngagementEvent(
                organization_id=1,
                notification_uuid=CONTEXT.notification_uuid,
                source="activity-seer-rca-completed",
                category="activity",
                provider="email",
                stage=None,
                link="issue",
                mechanism="page_load",
                user_id=2,
            ),
        )

    @override_options(ENABLED_OPTIONS)
    def test_unauthenticated(
        self, mock_record: mock.MagicMock, mock_incr: mock.MagicMock, mock_count: mock.MagicMock
    ) -> None:
        record_engagement(
            CONTEXT, mechanism=NotificationEngagementMechanism.REDIRECT, link="view_pr"
        )

        event = get_last_analytics_event(mock_record)
        assert isinstance(event, NotificationTrackingEngagementEvent)
        assert event.user_id is None

    def test_disabled(
        self, mock_record: mock.MagicMock, mock_incr: mock.MagicMock, mock_count: mock.MagicMock
    ) -> None:
        record_engagement(
            CONTEXT, mechanism=NotificationEngagementMechanism.REDIRECT, link="view_pr"
        )

        mock_incr.assert_not_called()
        mock_count.assert_not_called()
        mock_record.assert_not_called()

    @override_options(ENABLED_OPTIONS)
    @mock.patch("sentry.notifications.platform.tracking.logger")
    def test_failure_does_not_raise(
        self,
        mock_logger: mock.MagicMock,
        mock_record: mock.MagicMock,
        mock_incr: mock.MagicMock,
        mock_count: mock.MagicMock,
    ) -> None:
        mock_incr.side_effect = Exception("boom")

        record_engagement(
            CONTEXT, mechanism=NotificationEngagementMechanism.PAGE_LOAD, link="issue"
        )

        mock_logger.exception.assert_called_once()
        mock_record.assert_not_called()
