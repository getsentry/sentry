from collections import namedtuple
from unittest.mock import patch

import pytest

from sentry.coreapi import APIUnauthorized
from sentry.sentry_apps.installations import SentryAppInstallationNotifier
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.services.user.service import user_service
from sentry.utils import json
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer


def raiseStatusFalse():
    return False


MockResponse = namedtuple(
    "MockResponse", ["headers", "content", "ok", "status_code", "raise_for_status"]
)
MockResponseInstance = MockResponse({}, {}, True, 200, raiseStatusFalse)


@control_silo_test
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
        self.rpc_user = user_service.get_user(user_id=self.user.id)

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
    def test_task_enqueued(self, safe_urlopen):
        assert self.rpc_user, "Rpcuser should exist, unless explicitly noted in test"
        SentryAppInstallationNotifier(
            sentry_app_installation=self.install, user=self.rpc_user, action="created"
        ).run()

        ((args, kwargs),) = safe_urlopen.call_args_list

        assert json.loads(kwargs["data"]) == {
            "action": "created",
            "installation": {"uuid": self.install.uuid},
            "data": {
                "installation": {
                    "app": {"uuid": self.sentry_app.uuid, "slug": self.sentry_app.slug},
                    "organization": {"slug": self.organization.slug, "id": self.organization.id},
                    "uuid": self.install.uuid,
                    "code": self.install.api_grant.code,
                    "status": "installed",
                }
            },
            "actor": {"id": self.user.id, "name": self.user.name, "type": "user"},
        }

        assert kwargs["headers"].keys() >= {
            "Content-Type",
            "Request-ID",
            "Sentry-Hook-Resource",
            "Sentry-Hook-Timestamp",
            "Sentry-Hook-Signature",
        }

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
    def test_uninstallation_enqueued(self, safe_urlopen):
        assert self.rpc_user, "Rpcuser should exist, unless explicitly noted in test"

        SentryAppInstallationNotifier(
            sentry_app_installation=self.install, user=self.rpc_user, action="deleted"
        ).run()

        ((args, kwargs),) = safe_urlopen.call_args_list

        assert json.loads(kwargs["data"]) == {
            "action": "deleted",
            "installation": {"uuid": self.install.uuid},
            "data": {
                "installation": {
                    "app": {"uuid": self.sentry_app.uuid, "slug": self.sentry_app.slug},
                    "organization": {"slug": self.organization.slug, "id": self.organization.id},
                    "uuid": self.install.uuid,
                    "code": self.install.api_grant.code,
                    "status": "installed",
                }
            },
            "actor": {"id": self.user.id, "name": self.user.name, "type": "user"},
        }

        assert kwargs["headers"].keys() >= {
            "Content-Type",
            "Request-ID",
            "Sentry-Hook-Resource",
            "Sentry-Hook-Timestamp",
            "Sentry-Hook-Signature",
        }

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_invalid_installation_action(self, safe_urlopen):
        with pytest.raises(APIUnauthorized):
            assert self.rpc_user, "Rpcuser should exist, unless explicitly noted in test"
            SentryAppInstallationNotifier(
                sentry_app_installation=self.install, user=self.rpc_user, action="updated"
            ).run()

        assert not safe_urlopen.called

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
    def test_webhook_request_saved(self, safe_urlopen):
        assert self.rpc_user, "Rpcuser should exist, unless explicitly noted in test"
        SentryAppInstallationNotifier(
            sentry_app_installation=self.install, user=self.rpc_user, action="created"
        ).run()
        SentryAppInstallationNotifier(
            sentry_app_installation=self.install, user=self.rpc_user, action="deleted"
        ).run()

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 2
        assert requests[0]["event_type"] == "installation.deleted"
        assert requests[1]["event_type"] == "installation.created"
