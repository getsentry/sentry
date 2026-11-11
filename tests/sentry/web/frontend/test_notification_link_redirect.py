from unittest import mock
from urllib.parse import urlsplit
from uuid import uuid4

from django.core import signing
from django.http.response import HttpResponseBase

from sentry.analytics.events.notification_tracking import NotificationTrackingEngagementEvent
from sentry.notifications.platform.tracking import (
    _PULL_REQUEST_REDIRECT_SALT,
    NotificationLinkDecorator,
)
from sentry.notifications.platform.types import NotificationProviderKey, NotificationSource
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_event_equal, get_all_analytics_events
from sentry.testutils.helpers.options import override_options
from sentry.testutils.notifications.platform import MockNotification
from sentry.testutils.silo import control_silo_test

ENABLED_OPTIONS = {"notifications.tracking.sources": ["activity-seer-pr-ready-for-review"]}
PULL_REQUEST_URL = "https://github.com/acme/backend/pull/12"
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36"
)


def _engagements(mock_record: mock.MagicMock) -> list[NotificationTrackingEngagementEvent]:
    return [
        event
        for event in get_all_analytics_events(mock_record)
        if isinstance(event, NotificationTrackingEngagementEvent)
    ]


@control_silo_test
@mock.patch("sentry.analytics.record")
class NotificationLinkRedirectTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options(ENABLED_OPTIONS))
        self.notification_uuid = str(uuid4())

    def path(self, url: str = PULL_REQUEST_URL) -> str:
        data = MockNotification(
            message="test",
            source=NotificationSource.ACTIVITY_SEER_PR_READY_FOR_REVIEW,
            organization_id=self.organization.id,
            notification_uuid=self.notification_uuid,
        )
        decorator = NotificationLinkDecorator(data=data, provider=NotificationProviderKey.EMAIL)
        return urlsplit(decorator.decorate_url(url)).path

    def get(self, path: str, user_agent: str = BROWSER_USER_AGENT) -> HttpResponseBase:
        return self.client.get(path, HTTP_USER_AGENT=user_agent)

    def test_redirects_and_records_click(self, mock_record: mock.MagicMock) -> None:
        response = self.get(self.path())

        assert response.status_code == 302
        assert response["Location"] == PULL_REQUEST_URL
        [event] = _engagements(mock_record)
        assert_event_equal(
            NotificationTrackingEngagementEvent(
                organization_id=self.organization.id,
                notification_uuid=self.notification_uuid,
                source="activity-seer-pr-ready-for-review",
                category="activity",
                provider="email",
                link="pull_request",
                mechanism="redirect",
                user_id=None,
            ),
            event,
        )

    def test_records_logged_in_user(self, mock_record: mock.MagicMock) -> None:
        self.login_as(self.user)

        self.get(self.path())

        [event] = _engagements(mock_record)
        assert event.user_id == self.user.id

    def test_github_enterprise_cloud(self, mock_record: mock.MagicMock) -> None:
        response = self.get(self.path("https://acme.ghe.com/acme/frontend/pull/3"))

        assert response.status_code == 302
        assert response["Location"] == "https://acme.ghe.com/acme/frontend/pull/3"

    def test_rejects_tokens_that_sentry_did_not_sign(self, mock_record: mock.MagicMock) -> None:
        payload = [
            "https://evil.example/acme/backend/pull/12",
            self.organization.id,
            self.notification_uuid,
            "activity-seer-pr-ready-for-review",
            "email",
        ]
        token = self.path().split("/")[2]
        for path in (
            f"/tr/{token[:-1]}x/",
            f"/tr/{signing.dumps(payload, salt='another-salt', compress=True)}/",
            f"/tr/{signing.dumps(payload, key='another-key', compress=True)}/",
            "/tr/not-a-token/",
        ):
            assert self.get(path).status_code == 404, path

        assert _engagements(mock_record) == []

    def test_rejects_signed_tokens_for_other_destinations(
        self, mock_record: mock.MagicMock
    ) -> None:
        for payload in (
            [
                "https://github.acme.example/acme/backend/pull/12",
                self.organization.id,
                self.notification_uuid,
                "activity-seer-pr-ready-for-review",
                "email",
            ],
            [PULL_REQUEST_URL, self.organization.id, self.notification_uuid, "unknown", "email"],
            [
                PULL_REQUEST_URL,
                self.organization.id,
                self.notification_uuid,
                "activity-seer-pr-ready-for-review",
                "unknown",
            ],
            [PULL_REQUEST_URL, self.organization.id],
        ):
            path = f"/tr/{signing.dumps(payload, salt=_PULL_REQUEST_REDIRECT_SALT, compress=True)}/"
            assert self.get(path).status_code == 404, payload

        assert _engagements(mock_record) == []

    def test_automated_clients_are_not_recorded(self, mock_record: mock.MagicMock) -> None:
        for user_agent in (
            "",
            "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
            "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SkypeUriPreview Preview/0.5",
            "Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0.17928; Pro)",
            "python-requests/2.32.3",
        ):
            response = self.get(self.path(), user_agent=user_agent)
            assert response.status_code == 302, user_agent

        assert _engagements(mock_record) == []

    def test_head_is_not_recorded(self, mock_record: mock.MagicMock) -> None:
        response = self.client.head(self.path(), HTTP_USER_AGENT=BROWSER_USER_AGENT)

        assert response.status_code == 302
        assert _engagements(mock_record) == []

    def test_repeat_click_is_recorded_once(self, mock_record: mock.MagicMock) -> None:
        path = self.path()
        self.get(path)
        self.get(path)

        assert len(_engagements(mock_record)) == 1

    def test_disabled_source_still_redirects(self, mock_record: mock.MagicMock) -> None:
        path = self.path()

        with override_options({"notifications.tracking.sources": []}):
            response = self.get(path)

        assert response.status_code == 302
        assert response["Location"] == PULL_REQUEST_URL
        assert _engagements(mock_record) == []

    def test_recording_failure_still_redirects(self, mock_record: mock.MagicMock) -> None:
        with mock.patch(
            "sentry.web.frontend.notification_link_redirect.record_engagement",
            side_effect=Exception,
        ):
            response = self.get(self.path())

        assert response.status_code == 302
