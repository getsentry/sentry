from unittest import mock
from urllib.parse import urlencode
from uuid import uuid4

import responses
from django.test import override_settings
from django.urls import reverse

from sentry.analytics.events.notification_tracking import NotificationTrackingEngagementEvent
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import (
    assert_event_equal,
    get_all_analytics_events,
)
from sentry.testutils.helpers.apigateway import ApiGatewayTestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.silo import control_silo_test
from sentry.utils import json

ENABLED_OPTIONS = {"notifications.tracking.sources": ["activity-assigned", "issue"]}


def _engagements(mock_record: mock.MagicMock) -> list[NotificationTrackingEngagementEvent]:
    return [
        event
        for event in get_all_analytics_events(mock_record)
        if isinstance(event, NotificationTrackingEngagementEvent)
    ]


@control_silo_test
@mock.patch("sentry.analytics.record")
class NotificationTrackingMiddlewareTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options(ENABLED_OPTIONS))
        self.organization = self.create_organization(owner=self.user)
        self.notification_uuid = str(uuid4())

    def issue_path(
        self, referrer: str = "activity-assigned-email", prefix: str | None = None
    ) -> str:
        if prefix is None:
            prefix = f"/organizations/{self.organization.slug}"
        query = urlencode({"referrer": referrer, "notification_uuid": self.notification_uuid})
        return f"{prefix}/issues/123/?{query}"

    def test_records_page_load(self, mock_record: mock.MagicMock) -> None:
        self.login_as(self.user)

        response = self.client.get(self.issue_path())

        assert response.status_code == 200
        [event] = _engagements(mock_record)
        assert_event_equal(
            NotificationTrackingEngagementEvent(
                organization_id=self.organization.id,
                notification_uuid=self.notification_uuid,
                source="activity-assigned",
                category="activity",
                provider="email",
                link="issue",
                mechanism="page_load",
                user_id=self.user.id,
            ),
            event,
        )

    def test_legacy_alert(self, mock_record: mock.MagicMock) -> None:
        self.login_as(self.user)

        self.client.get(self.issue_path(referrer="slack"))

        [event] = _engagements(mock_record)
        assert (event.source, event.category, event.provider) == ("issue", "issue", "slack")

    def test_login_return(self, mock_record: mock.MagicMock) -> None:
        self.user.set_password("password")
        self.user.save()

        response = self.client.get(self.issue_path())
        assert response.status_code == 302
        assert _engagements(mock_record) == []

        self.client.get(reverse("sentry-api-0-auth-config"))
        response = self.client.post(
            reverse("sentry-api-0-auth-login"),
            data={"username": self.user.username, "password": "password"},
            content_type="application/json",
        )
        assert response.json()["nextUri"] == self.issue_path()
        response = self.client.get(response.json()["nextUri"])

        assert response.status_code == 200
        assert len(_engagements(mock_record)) == 1

    def test_refresh_is_recorded_once(self, mock_record: mock.MagicMock) -> None:
        self.login_as(self.user)

        self.client.get(self.issue_path())
        self.client.get(self.issue_path())

        assert len(_engagements(mock_record)) == 1

    def test_customer_domain(self, mock_record: mock.MagicMock) -> None:
        self.login_as(self.user)

        with self.feature("system:multi-region"):
            response = self.client.get(
                self.issue_path(prefix=""), HTTP_HOST=f"{self.organization.slug}.testserver"
            )

        assert response.status_code == 200
        [event] = _engagements(mock_record)
        assert event.organization_id == self.organization.id
        assert event.link == "issue"

    def test_redirect_to_customer_domain_is_recorded_once(
        self, mock_record: mock.MagicMock
    ) -> None:
        self.login_as(self.user)

        with self.feature("system:multi-region"):
            response = self.client.get(self.issue_path(), follow=True)

        assert response.redirect_chain == [
            (f"http://{self.organization.slug}.testserver{self.issue_path(prefix='')}", 302)
        ]
        [event] = _engagements(mock_record)
        assert event.organization_id == self.organization.id

    def test_non_member(self, mock_record: mock.MagicMock) -> None:
        self.login_as(self.create_user())
        query = urlencode({"referrer": "issue-slack", "notification_uuid": self.notification_uuid})

        with self.feature("system:multi-region"):
            response = self.client.get(
                f"/join-request/?{query}", HTTP_HOST=f"{self.organization.slug}.testserver"
            )

        assert response.status_code == 200
        assert _engagements(mock_record) == []

    def test_source_not_enabled(self, mock_record: mock.MagicMock) -> None:
        self.login_as(self.user)

        self.client.get(self.issue_path(referrer="activity-note-email"))

        assert _engagements(mock_record) == []

    def test_unrecognized_referrer(self, mock_record: mock.MagicMock) -> None:
        self.login_as(self.user)

        self.client.get(self.issue_path(referrer="issue-stream"))

        assert _engagements(mock_record) == []

    def test_api_request(self, mock_record: mock.MagicMock) -> None:
        self.login_as(self.user)

        self.client.get(self.issue_path(prefix=f"/api/0/organizations/{self.organization.slug}"))

        assert _engagements(mock_record) == []

    @mock.patch("sentry.middleware.notification_tracking.logger")
    @mock.patch(
        "sentry.middleware.notification_tracking.parse_referrer", side_effect=Exception("boom")
    )
    def test_failure_does_not_affect_response(
        self, mock_parse: mock.MagicMock, mock_logger: mock.MagicMock, mock_record: mock.MagicMock
    ) -> None:
        self.login_as(self.user)

        response = self.client.get(self.issue_path())

        assert response.status_code == 200
        mock_logger.exception.assert_called_once_with("notifications.tracking.page_load.failed")
        assert _engagements(mock_record) == []


@control_silo_test(cells=[ApiGatewayTestCase.CELL])
@mock.patch("sentry.analytics.record")
class NotificationTrackingApiGatewayTest(ApiGatewayTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options(ENABLED_OPTIONS))
        self.create_member(user=self.user, organization=self.organization)

    def path(self, endpoint: str) -> str:
        query = urlencode({"referrer": "slack", "notification_uuid": str(uuid4())})
        return f"/organizations/{self.organization.slug}/{endpoint}/?{query}"

    @responses.activate
    def test_proxied_request_is_left_to_the_cell(self, mock_record: mock.MagicMock) -> None:
        responses.add(
            responses.GET,
            f"{self.CELL.address}/organizations/{self.organization.slug}/region/",
            body=json.dumps({"proxy": True}),
            content_type="application/json",
        )
        self.login_as(self.user)

        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            response = self.client.get(self.path("region"))

        assert response.status_code == 200
        assert json.loads(close_streaming_response(response)) == {"proxy": True}
        assert _engagements(mock_record) == []

    @responses.activate
    def test_request_served_by_control(self, mock_record: mock.MagicMock) -> None:
        self.login_as(self.user)

        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            response = self.client.get(self.path("control"))

        assert response.status_code == 200
        assert len(_engagements(mock_record)) == 1
