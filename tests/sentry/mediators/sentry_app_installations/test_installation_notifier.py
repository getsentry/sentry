from collections import namedtuple
from unittest.mock import patch

import pytest

from sentry.coreapi import APIUnauthorized
from sentry.mediators.sentry_app_installations import InstallationNotifier
from sentry.testutils import TestCase
from sentry.testutils.helpers.faux import DictContaining, faux
from sentry.utils import json
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer


def raiseStatusFalse():
    return False


MockResponse = namedtuple(
    "MockResponse", ["headers", "content", "ok", "status_code", "raise_for_status"]
)
MockResponseInstance = MockResponse({}, {}, True, 200, raiseStatusFalse)


class TestInstallationNotifier(TestCase):
    def setUp(self):
        super().setUp()

        self.sentry_app = self.create_sentry_app(
            name="foo",
            organization=self.organization,
            webhook_url="https://example.com",
            scopes=(),
        )

        self.install = self.create_sentry_app_installation(
            slug="foo",
            organization=self.organization,
            user=self.user,
            prevent_token_exchange=True,
        )

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
    def test_task_enqueued(self, safe_urlopen):
        InstallationNotifier.run(install=self.install, user=self.user, action="created")

        data = faux(safe_urlopen).kwargs["data"]

        assert json.loads(data) == {
            "action": "created",
            "installation": {"uuid": self.install.uuid},
            "data": {
                "installation": {
                    "app": {"uuid": self.sentry_app.uuid, "slug": self.sentry_app.slug},
                    "organization": {"slug": self.organization.slug},
                    "uuid": self.install.uuid,
                    "code": self.install.api_grant.code,
                    "status": "installed",
                }
            },
            "actor": {"id": self.user.id, "name": self.user.name, "type": "user"},
        }

        assert faux(safe_urlopen).kwarg_equals(
            "headers",
            DictContaining(
                "Content-Type",
                "Request-ID",
                "Sentry-Hook-Resource",
                "Sentry-Hook-Timestamp",
                "Sentry-Hook-Signature",
            ),
        )

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
    def test_uninstallation_enqueued(self, safe_urlopen):
        InstallationNotifier.run(install=self.install, user=self.user, action="deleted")

        data = faux(safe_urlopen).kwargs["data"]

        assert json.loads(data) == {
            "action": "deleted",
            "installation": {"uuid": self.install.uuid},
            "data": {
                "installation": {
                    "app": {"uuid": self.sentry_app.uuid, "slug": self.sentry_app.slug},
                    "organization": {"slug": self.organization.slug},
                    "uuid": self.install.uuid,
                    "code": self.install.api_grant.code,
                    "status": "installed",
                }
            },
            "actor": {"id": self.user.id, "name": self.user.name, "type": "user"},
        }

        assert faux(safe_urlopen).kwarg_equals(
            "headers",
            DictContaining(
                "Content-Type",
                "Request-ID",
                "Sentry-Hook-Resource",
                "Sentry-Hook-Timestamp",
                "Sentry-Hook-Signature",
            ),
        )

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_invalid_installation_action(self, safe_urlopen):
        with pytest.raises(APIUnauthorized):
            InstallationNotifier.run(install=self.install, user=self.user, action="updated")

        assert not safe_urlopen.called

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
    def test_webhook_request_saved(self, safe_urlopen):
        InstallationNotifier.run(install=self.install, user=self.user, action="created")
        InstallationNotifier.run(install=self.install, user=self.user, action="deleted")

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 2
        assert requests[0]["event_type"] == "installation.deleted"
        assert requests[1]["event_type"] == "installation.created"
