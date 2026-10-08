from dataclasses import replace
from unittest import mock

import pytest

from sentry.analytics.events.notification_tracking import (
    NotificationTrackingEngagementEvent,
    NotificationTrackingSentEvent,
)
from sentry.notifications.platform.tracking import (
    NotificationEngagementMechanism,
    NotificationLink,
    NotificationLinkDecorator,
    NotificationTrackingContext,
    classify_link,
    is_tracking_enabled,
    record_engagement,
    record_sent,
)
from sentry.notifications.platform.types import (
    LinkTextBlock,
    NotificationCategory,
    NotificationProviderKey,
    NotificationRenderedAction,
    NotificationRenderedImage,
    NotificationRenderedTemplate,
    NotificationSource,
    ParagraphSection,
    PlainTextBlock,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import (
    assert_last_analytics_event,
    get_last_analytics_event,
)
from sentry.testutils.helpers.options import override_options
from sentry.testutils.notifications.platform import MockNotification

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


@mock.patch("sentry.notifications.platform.tracking.metrics.incr")
@mock.patch("sentry.analytics.record")
class RecordSentTest(TestCase):
    @override_options(ENABLED_OPTIONS)
    def test_records_metrics_and_event(
        self, mock_record: mock.MagicMock, mock_incr: mock.MagicMock
    ) -> None:
        record_sent(CONTEXT, links=["seer", "issue", "seer"])

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
    def test_stage_tag(self, mock_record: mock.MagicMock, mock_incr: mock.MagicMock) -> None:
        record_sent(replace(CONTEXT, stage="root_cause"))

        tags = {
            "source": "activity-seer-rca-completed",
            "provider": "email",
            "category": "activity",
            "stage": "root_cause",
        }
        mock_incr.assert_called_once_with("notifications.tracking.sent", tags=tags, sample_rate=1.0)

    def test_disabled(self, mock_record: mock.MagicMock, mock_incr: mock.MagicMock) -> None:
        record_sent(CONTEXT, links=["issue"])

        mock_incr.assert_not_called()
        mock_record.assert_not_called()

    @override_options(ENABLED_OPTIONS)
    @mock.patch("sentry.notifications.platform.tracking.logger")
    def test_failure_does_not_raise(
        self,
        mock_logger: mock.MagicMock,
        mock_record: mock.MagicMock,
        mock_incr: mock.MagicMock,
    ) -> None:
        mock_record.side_effect = Exception("boom")

        record_sent(CONTEXT)

        mock_logger.exception.assert_called_once()


@mock.patch("sentry.notifications.platform.tracking.metrics.incr")
@mock.patch("sentry.analytics.record")
class RecordEngagementTest(TestCase):
    @override_options(ENABLED_OPTIONS)
    def test_records_metrics_and_event(
        self, mock_record: mock.MagicMock, mock_incr: mock.MagicMock
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
    def test_unauthenticated(self, mock_record: mock.MagicMock, mock_incr: mock.MagicMock) -> None:
        record_engagement(
            CONTEXT, mechanism=NotificationEngagementMechanism.REDIRECT, link="view_pr"
        )

        event = get_last_analytics_event(mock_record)
        assert isinstance(event, NotificationTrackingEngagementEvent)
        assert event.user_id is None

    def test_disabled(self, mock_record: mock.MagicMock, mock_incr: mock.MagicMock) -> None:
        record_engagement(
            CONTEXT, mechanism=NotificationEngagementMechanism.REDIRECT, link="view_pr"
        )

        mock_incr.assert_not_called()
        mock_record.assert_not_called()

    @override_options(ENABLED_OPTIONS)
    @mock.patch("sentry.notifications.platform.tracking.logger")
    def test_failure_does_not_raise(
        self,
        mock_logger: mock.MagicMock,
        mock_record: mock.MagicMock,
        mock_incr: mock.MagicMock,
    ) -> None:
        mock_incr.side_effect = Exception("boom")

        record_engagement(
            CONTEXT, mechanism=NotificationEngagementMechanism.PAGE_LOAD, link="issue"
        )

        mock_logger.exception.assert_called_once()
        mock_record.assert_not_called()


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://sentry.io/organizations/acme/issues/1/", NotificationLink.ISSUE),
        ("https://acme.sentry.io/issues/1/?referrer=slack", NotificationLink.ISSUE),
        ("https://acme.sentry.io/issues/1/events/latest/", NotificationLink.ISSUE),
        ("https://acme.sentry.io/issues/1/?seerDrawer=true", NotificationLink.ISSUE_WITH_SEER),
        ("https://acme.sentry.io/issues/inbox/?project=2&preview=1", NotificationLink.ISSUE),
        ("https://sentry.io/organizations/acme/issues/?project=2", NotificationLink.ISSUE_LIST),
        ("https://acme.sentry.io/monitors/alerts/3/", NotificationLink.ALERT),
        ("https://acme.sentry.io/monitors/3/", NotificationLink.ALERT),
        ("https://acme.sentry.io/alerts/rules/details/3/", NotificationLink.ALERT),
        ("https://acme.sentry.io/releases/1.0.0/?project=2", NotificationLink.RELEASE),
        ("https://acme.sentry.io/data-export/4/", NotificationLink.DATA_EXPORT),
        ("https://sentry.io/settings/account/notifications/alerts/", NotificationLink.SETTINGS),
        ("https://sentry.io/settings/acme/developer-settings/app/", NotificationLink.SETTINGS),
        ("https://sentry.io/organizations/acme/repos/", NotificationLink.REPOSITORIES),
        (
            "https://acme.sentry.io/explore/agents/conversations/abc/",
            NotificationLink.SEER_AGENT_RUN,
        ),
    ],
)
def test_classify_link(url: str, expected: NotificationLink) -> None:
    with mock.patch("sentry.notifications.platform.tracking.logger") as mock_logger:
        assert classify_link(url) == expected
    mock_logger.error.assert_not_called()


@pytest.mark.parametrize(
    "url",
    [
        "https://acme.sentry.io/dashboards/1/?q=x",
        "https://sentry.io/organizations/acme/dashboards/1/?q=x",
    ],
)
def test_classify_link_logs_unclassified_sentry_pages(url: str) -> None:
    with mock.patch("sentry.notifications.platform.tracking.logger") as mock_logger:
        assert classify_link(url) == NotificationLink.OTHER
    mock_logger.error.assert_called_once_with(
        "notifications.tracking.unclassified_link", extra={"path": "/dashboards/1/"}
    )


@override_options(ENABLED_OPTIONS)
class DecorateRenderedTemplateTest(TestCase):
    referrer = "activity-seer-rca-completed-email"
    notification_uuid = "0b1c3a4e-7d0f-4b8a-9b6e-0c7a2f3d5e61"
    tracking = f"referrer={referrer}&notification_uuid={notification_uuid}"

    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options({"system.url-prefix": "https://sentry.io"}))

    def decorate_rendered_template(
        self, rendered_template: NotificationRenderedTemplate
    ) -> tuple[NotificationRenderedTemplate, set[NotificationLink]]:
        data = MockNotification(
            message="test",
            source=NotificationSource.ACTIVITY_SEER_RCA_COMPLETED,
            notification_uuid=self.notification_uuid,
        )
        decorator = NotificationLinkDecorator(data=data, provider=NotificationProviderKey.EMAIL)
        return decorator.decorate_rendered_template(rendered_template), decorator.links

    def test_decorates_sentry_links(self) -> None:
        rendered_template = NotificationRenderedTemplate(
            subject=[
                PlainTextBlock(text="Root cause for"),
                LinkTextBlock(
                    text="ACME-1",
                    url="https://sentry.io/organizations/acme/issues/1/?referrer=activity_notification",
                ),
            ],
            body=[
                ParagraphSection(
                    blocks=[
                        LinkTextBlock(text="PR", url="https://github.com/acme/repo/pull/1"),
                        LinkTextBlock(text="Jane", url="mailto:jane@example.com"),
                    ]
                )
            ],
            actions=[
                NotificationRenderedAction(
                    label="Open Seer", link="https://acme.sentry.io/issues/1/?seerDrawer=true"
                ),
                NotificationRenderedAction(label="Docs", link="https://docs.sentry.io/"),
            ],
            chart=NotificationRenderedImage(url="https://sentry.io/chart.png", alt_text="Chart"),
            footer=[
                LinkTextBlock(
                    text="Manage Preferences",
                    url="https://sentry.io/settings/account/notifications/alerts/",
                )
            ],
        )

        decorated, links = self.decorate_rendered_template(rendered_template)

        assert decorated == replace(
            rendered_template,
            subject=[
                PlainTextBlock(text="Root cause for"),
                LinkTextBlock(
                    text="ACME-1",
                    url=f"https://sentry.io/organizations/acme/issues/1/?{self.tracking}",
                ),
            ],
            actions=[
                NotificationRenderedAction(
                    label="Open Seer",
                    link=f"https://acme.sentry.io/issues/1/?seerDrawer=true&{self.tracking}",
                ),
                NotificationRenderedAction(label="Docs", link="https://docs.sentry.io/"),
            ],
            footer=[
                LinkTextBlock(
                    text="Manage Preferences",
                    url=f"https://sentry.io/settings/account/notifications/alerts/?{self.tracking}",
                )
            ],
        )
        assert links == {
            NotificationLink.ISSUE,
            NotificationLink.ISSUE_WITH_SEER,
            NotificationLink.SETTINGS,
        }
        assert rendered_template.subject[1] == LinkTextBlock(
            text="ACME-1",
            url="https://sentry.io/organizations/acme/issues/1/?referrer=activity_notification",
        )

    def test_idempotent(self) -> None:
        rendered_template = NotificationRenderedTemplate(
            subject="Export ready",
            body=[],
            actions=[NotificationRenderedAction(label="Download", link="https://sentry.io/x/")],
        )

        decorated, _ = self.decorate_rendered_template(rendered_template)

        assert self.decorate_rendered_template(decorated) == (decorated, {NotificationLink.OTHER})

    def test_plain_text_and_undecoratable_links_are_unchanged(self) -> None:
        rendered_template = NotificationRenderedTemplate(
            subject="Export ready",
            body=[ParagraphSection(blocks=[LinkTextBlock(text="Broken", url="https://[::1")])],
            footer="Sent by Sentry",
        )

        with mock.patch("sentry.notifications.platform.tracking.logger") as mock_logger:
            decorated, links = self.decorate_rendered_template(rendered_template)

        assert decorated == rendered_template
        assert links == set()
        mock_logger.exception.assert_called_once()
