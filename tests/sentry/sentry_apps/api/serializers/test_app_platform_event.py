import datetime
from typing import Any

import orjson

from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
from sentry.sentry_apps.models.sentry_app import SentryApp
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

    def _event_for_app_with_headers(
        self, headers: list[str]
    ) -> tuple[SentryApp, AppPlatformEvent[dict[str, Any]]]:
        sentry_app = self.create_sentry_app(organization=self.organization, webhook_headers=headers)
        install = self.create_sentry_app_installation(
            organization=self.organization, slug=sentry_app.slug
        )
        event = AppPlatformEvent[dict[str, Any]](
            resource=SentryAppResourceType.ISSUE,
            action=IssueActionType.ASSIGNED,
            install=install,
            data={},
        )
        return sentry_app, event

    def test_custom_webhook_headers_are_merged(self) -> None:
        _, result = self._event_for_app_with_headers(
            ["X-Custom: value", "Authorization: Bearer token"]
        )

        assert result.headers["X-Custom"] == "value"
        assert result.headers["Authorization"] == "Bearer token"
        # Sentry's own headers are still present.
        assert result.headers["Content-Type"] == "application/json"

    def test_custom_headers_cannot_override_sentry_headers(self) -> None:
        sentry_app, result = self._event_for_app_with_headers(
            ["Sentry-Hook-Signature: spoofed", "Content-Type: text/plain"]
        )

        # Sentry's headers win the merge so the signature can't be spoofed.
        assert result.headers["Sentry-Hook-Signature"] == sentry_app.build_signature(result.body)
        assert result.headers["Content-Type"] == "application/json"

    def test_sentry_headers_exclude_custom_headers(self) -> None:
        # sentry_headers is what gets logged to the request buffer / debug UI, so
        # custom headers (which may contain secrets) must never appear there.
        _, result = self._event_for_app_with_headers(["Authorization: Bearer secret"])

        assert "Authorization" not in result.sentry_headers
        assert result.headers["Authorization"] == "Bearer secret"
