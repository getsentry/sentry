from unittest import mock
from urllib.parse import urlencode
from uuid import uuid4

import responses
from django.http.response import HttpResponseBase
from django.test import override_settings

from sentry.analytics.events.notification_tracking import NotificationTrackingEngagementEvent
from sentry.constants import ObjectStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_event_equal, get_all_analytics_events
from sentry.testutils.helpers.apigateway import ApiGatewayTestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import cell_silo_test, control_silo_test

ENABLED_OPTIONS = {"notifications.tracking.sources": ["activity-seer-pr-ready-for-review"]}
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


@cell_silo_test
@mock.patch("sentry.analytics.record")
class NotificationLinkRedirectTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options(ENABLED_OPTIONS))
        self.notification_uuid = str(uuid4())
        self.create_repo(
            project=self.project,
            name="acme/backend",
            provider="integrations:github",
            url="https://github.com/acme/backend",
        )

    def path(
        self,
        destination: str = "github.com/acme/backend/pull/12",
        referrer: str = "activity-seer-pr-ready-for-review-email",
        organization_slug: str | None = None,
    ) -> str:
        query = urlencode({"referrer": referrer, "notification_uuid": self.notification_uuid})
        slug = organization_slug or self.organization.slug
        return f"/organizations/{slug}/tr/{destination}?{query}"

    def get(self, path: str, user_agent: str = BROWSER_USER_AGENT) -> HttpResponseBase:
        return self.client.get(path, HTTP_USER_AGENT=user_agent)

    def test_redirects_and_records_click(self, mock_record: mock.MagicMock) -> None:
        response = self.get(self.path())

        assert response.status_code == 302
        assert response["Location"] == "https://github.com/acme/backend/pull/12"
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

    def test_trailing_slash_and_case(self, mock_record: mock.MagicMock) -> None:
        response = self.get(self.path(destination="GitHub.com/Acme/Backend/pull/12/"))

        assert response.status_code == 302
        assert response["Location"] == "https://github.com/acme/backend/pull/12"

    def test_github_enterprise(self, mock_record: mock.MagicMock) -> None:
        self.create_repo(
            project=self.project,
            name="acme/frontend",
            provider="integrations:github_enterprise",
            url="https://github.acme.example/acme/frontend",
        )

        response = self.get(self.path(destination="github.acme.example/acme/frontend/pull/3"))

        assert response.status_code == 302
        assert response["Location"] == "https://github.acme.example/acme/frontend/pull/3"

    def test_rejects_destinations_that_are_not_connected_pull_requests(
        self, mock_record: mock.MagicMock
    ) -> None:
        other_organization = self.create_organization()
        self.create_repo(
            project=self.create_project(organization=other_organization),
            name="other/repo",
            provider="integrations:github",
            url="https://github.com/other/repo",
        )
        self.create_repo(
            project=self.project,
            name="acme/legacy",
            provider="github",
            url="https://github.com/acme/legacy",
        )
        inactive = self.create_repo(
            project=self.project,
            name="acme/archived",
            provider="integrations:github",
            url="https://github.com/acme/archived",
        )
        inactive.update(status=ObjectStatus.DISABLED)

        for destination in (
            "github.com/acme/unknown/pull/12",
            "github.com/other/repo/pull/12",
            "github.com/acme/legacy/pull/12",
            "github.com/acme/archived/pull/12",
            "evil.example/acme/backend/pull/12",
            "github.com/acme/backend",
            "github.com/acme/backend/issues/12",
            "github.com/acme/backend/pull/12/files",
            "github.com/acme/backend/pull/abc",
        ):
            response = self.get(self.path(destination=destination))
            assert response.status_code == 404, destination

        assert self.get(self.path(organization_slug="no-such-org")).status_code == 404
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
        self.get(self.path())
        self.get(self.path())

        assert len(_engagements(mock_record)) == 1

    def test_untracked_link_still_redirects(self, mock_record: mock.MagicMock) -> None:
        for path in (
            self.path(referrer="activity-assigned-email"),
            self.path(referrer="not-a-referrer"),
            f"/organizations/{self.organization.slug}/tr/github.com/acme/backend/pull/12",
        ):
            response = self.get(path)
            assert response.status_code == 302, path
            assert response["Location"] == "https://github.com/acme/backend/pull/12"

        assert _engagements(mock_record) == []

    def test_recording_failure_still_redirects(self, mock_record: mock.MagicMock) -> None:
        with mock.patch(
            "sentry.web.frontend.notification_link_redirect.record_engagement",
            side_effect=Exception,
        ):
            response = self.get(self.path())

        assert response.status_code == 302


@control_silo_test(cells=[ApiGatewayTestCase.CELL])
class NotificationLinkRedirectApiGatewayTest(ApiGatewayTestCase):
    @responses.activate
    def test_control_proxies_to_the_organizations_cell(self) -> None:
        path = f"/organizations/{self.organization.slug}/tr/github.com/acme/backend/pull/12"
        responses.add(
            responses.GET,
            f"{self.CELL.address}{path}",
            status=302,
            headers={"Location": "https://github.com/acme/backend/pull/12"},
        )

        with override_settings(ROOT_URLCONF="sentry.conf.urls", MIDDLEWARE=tuple(self.middleware)):
            response = self.client.get(path)

        assert response.status_code == 302
        assert response["Location"] == "https://github.com/acme/backend/pull/12"
