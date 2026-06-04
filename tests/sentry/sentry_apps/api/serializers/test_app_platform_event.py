import datetime
from typing import Any

import orjson

from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
from sentry.sentry_apps.utils.webhooks import (
    InstallationActionType,
    IssueActionType,
    IssueAlertActionType,
    SentryAppResourceType,
)
from sentry.testutils.cases import TestCase


class AppPlatformEventSerializerTest(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user(username="foo")
        self.organization = self.create_organization(owner=self.user)
        self.sentry_app = self.create_sentry_app(organization=self.organization)
        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

    def test_no_actor(self) -> None:
        data = {"time": datetime.datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=datetime.UTC)}
        result = AppPlatformEvent(
            resource=SentryAppResourceType.EVENT_ALERT,
            action=IssueAlertActionType.TRIGGERED,
            install=self.install,
            data=data,
        )

        # Our serializer uses orjson to create the results but the result should match what json
        # creates on customers side
        from sentry.utils import json

        assert result.body == json.dumps(
            {
                "action": "triggered",
                "installation": {"uuid": self.install.uuid},
                "data": data,
                "actor": {"type": "application", "id": "sentry", "name": "Sentry"},
            }
        )

        signature = self.sentry_app.build_signature(result.body)

        assert result.headers["Content-Type"] == "application/json"
        assert result.headers["Sentry-Hook-Resource"] == SentryAppResourceType.EVENT_ALERT
        assert result.headers["Sentry-Hook-Signature"] == signature

    def test_sentry_app_actor(self) -> None:
        result = AppPlatformEvent[dict[str, Any]](
            resource=SentryAppResourceType.ISSUE,
            action=IssueActionType.ASSIGNED,
            install=self.install,
            data={},
            actor=self.sentry_app.proxy_user,
        )

        assert orjson.loads(result.body)["actor"] == {
            "type": "application",
            "id": self.sentry_app.uuid,
            "name": self.sentry_app.name,
        }

        signature = self.sentry_app.build_signature(result.body)

        assert result.headers["Content-Type"] == "application/json"
        assert result.headers["Sentry-Hook-Resource"] == SentryAppResourceType.ISSUE
        assert result.headers["Sentry-Hook-Signature"] == signature

    def test_user_actor(self) -> None:
        result = AppPlatformEvent[dict[str, Any]](
            resource=SentryAppResourceType.INSTALLATION,
            action=InstallationActionType.CREATED,
            install=self.install,
            data={},
            actor=self.user,
        )

        assert orjson.loads(result.body)["actor"] == {
            "type": "user",
            "id": self.user.id,
            "name": self.user.name,
        }

        signature = self.sentry_app.build_signature(result.body)

        assert result.headers["Content-Type"] == "application/json"
        assert result.headers["Sentry-Hook-Resource"] == "installation"
        assert result.headers["Sentry-Hook-Signature"] == signature

    def test_custom_webhook_headers_are_sent(self) -> None:
        """Custom webhook_headers from the SentryApp are included in outgoing headers."""
        self.sentry_app.webhook_headers = [
            "X-Api-Version: 2023-06-01",
            "X-Custom-Token: secret",
        ]
        self.sentry_app.save()
        # Reload install so sentry_app reflects the updated record
        self.install.refresh_from_db()

        result = AppPlatformEvent[dict[str, Any]](
            resource=SentryAppResourceType.ISSUE,
            action=IssueActionType.ASSIGNED,
            install=self.install,
            data={},
        )

        assert result.headers["X-Api-Version"] == "2023-06-01"
        assert result.headers["X-Custom-Token"] == "secret"
        # Sentry's own headers must still take precedence
        assert result.headers["Content-Type"] == "application/json"

    def test_reserved_headers_cannot_be_overridden_by_webhook_headers(self) -> None:
        """Sentry system headers always take precedence over custom webhook_headers."""
        self.sentry_app.webhook_headers = ["Content-Type: text/plain"]
        self.sentry_app.save()
        self.install.refresh_from_db()

        result = AppPlatformEvent[dict[str, Any]](
            resource=SentryAppResourceType.ISSUE,
            action=IssueActionType.ASSIGNED,
            install=self.install,
            data={},
        )

        # Sentry's Content-Type must win
        assert result.headers["Content-Type"] == "application/json"
