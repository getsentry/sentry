from time import time
from typing import Any
from unittest.mock import patch

import orjson
import responses
from requests.exceptions import ConnectionError

from fixtures.bitbucket_server import EXAMPLE_PRIVATE_KEY
from sentry.integrations.bitbucket_server.webhook import PROVIDER_NAME
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_failure_metric, assert_success_metric
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.identity import Identity
from sentry_plugins.bitbucket.testutils import REFS_CHANGED_EXAMPLE

PROVIDER = "bitbucket_server"


class WebhookTestBase(APITestCase):
    endpoint = "sentry-extensions-bitbucketserver-webhook"

    def setUp(self):
        super().setUp()

        self.base_url = "https://api.bitbucket.org"
        self.shared_secret = "234567890"
        self.subject = "connect:1234567"
        self.external_id = "{b128e0f6-196a-4dde-b72d-f42abc6dc239}"

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_provider_integration(
                provider=PROVIDER,
                external_id=self.subject,
                name="sentryuser",
                metadata={
                    "base_url": self.base_url,
                    "shared_secret": self.shared_secret,
                    "subject": self.subject,
                    "verify_ssl": False,
                },
            )

            self.identity = Identity.objects.create(
                idp=self.create_identity_provider(type=PROVIDER),
                user=self.user,
                external_id="user_identity",
                data={
                    "access_token": "bitbucket-access-token",
                    "access_token_secret": "access-token-secret",
                    "consumer_key": "bitbucket-app",
                    "private_key": EXAMPLE_PRIVATE_KEY,
                    "expires": time() + 50000,
                },
            )

    def create_repository(self, **kwargs: Any) -> Repository:
        return Repository.objects.create(
            **{
                **dict(
                    organization_id=self.organization.id,
                    external_id=self.external_id,
                    provider=PROVIDER_NAME,
                    name="maxbittker/newsdiffs",
                ),
                **kwargs,
            }
        )

    def send_webhook(self) -> None:
        self.get_success_response(
            self.organization.id,
            self.integration.id,
            raw_data=REFS_CHANGED_EXAMPLE,
            extra_headers=dict(HTTP_X_EVENT_KEY="repo:refs_changed"),
            status_code=204,
        )


class WebhookGetTest(WebhookTestBase):
    def test_get_request_fails(self):
        self.get_error_response(self.organization.id, self.integration.id, status_code=405)


class WebhookPostTest(WebhookTestBase):
    method = "post"

    def test_invalid_organization(self):
        self.get_error_response(0, self.integration.id, status_code=400)

    def test_invalid_integration(self):
        self.get_error_response(self.organization.id, 0, status_code=400)

    def test_missing_event(self):
        self.get_error_response(self.organization.id, self.integration.id, status_code=400)

    def test_unregistered_event(self):
        self.get_success_response(
            self.organization.id,
            self.integration.id,
            extra_headers=dict(HTTP_X_EVENT_KEY="UnregisteredEvent"),
            raw_data=REFS_CHANGED_EXAMPLE,
            status_code=204,
        )


class RefsChangedWebhookTest(WebhookTestBase):
    method = "post"

    def test_missing_integration(self):
        self.create_repository()
        self.get_error_response(
            self.organization.id,
            self.integration.id,
            raw_data=REFS_CHANGED_EXAMPLE,
            extra_headers=dict(HTTP_X_EVENT_KEY="repo:refs_changed"),
            status_code=404,
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_simple(self, mock_record):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.add_organization(self.organization, default_auth_id=self.identity.id)

        self.create_repository()
        self.send_webhook()

        assert_success_metric(mock_record)

    @patch("sentry.integrations.bitbucket_server.webhook.PushEventWebhook.__call__")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_webhook_error_metric(self, mock_record, mock_event):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.add_organization(self.organization, default_auth_id=self.identity.id)

        self.create_repository()

        error = Exception("error")
        mock_event.side_effect = error

        self.get_error_response(
            self.organization.id,
            self.integration.id,
            raw_data=REFS_CHANGED_EXAMPLE,
            extra_headers=dict(HTTP_X_EVENT_KEY="repo:refs_changed"),
            status_code=500,
        )

        assert_failure_metric(mock_record, error)

    @responses.activate
    def test_get_commits_error(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/rest/api/1.0/projects/my-project/repos/marcos/commits",
            json={"error": "unauthorized"},
            status=401,
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.add_organization(self.organization, default_auth_id=self.identity.id)

        self.create_repository()

        payload = {
            "changes": [
                {
                    "fromHash": "hash1",
                    "ref": {
                        "displayId": "displayId",
                        "id": "id",
                        "type": "'BRANCH'",
                    },
                    "refId": "refId",
                    "toHash": "hash2",
                    "type": "UPDATE",
                }
            ],
            "repository": {
                "id": "{b128e0f6-196a-4dde-b72d-f42abc6dc239}",
                "project": {"key": "my-project"},
                "slug": "marcos",
            },
        }

        self.get_error_response(
            self.organization.id,
            self.integration.id,
            raw_data=orjson.dumps(payload),
            extra_headers=dict(HTTP_X_EVENT_KEY="repo:refs_changed"),
            status_code=400,
        )

    @responses.activate
    def test_handle_unreachable_host(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/rest/api/1.0/projects/my-project/repos/marcos/commits",
            body=ConnectionError("Unable to reach host: https://api.bitbucket.org"),
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.add_organization(self.organization, default_auth_id=self.identity.id)

        self.create_repository()

        payload = {
            "changes": [
                {
                    "fromHash": "hash1",
                    "ref": {
                        "displayId": "displayId",
                        "id": "id",
                        "type": "'BRANCH'",
                    },
                    "refId": "refId",
                    "toHash": "hash2",
                    "type": "UPDATE",
                }
            ],
            "repository": {
                "id": "{b128e0f6-196a-4dde-b72d-f42abc6dc239}",
                "project": {"key": "my-project"},
                "slug": "marcos",
            },
        }

        self.get_error_response(
            self.organization.id,
            self.integration.id,
            raw_data=orjson.dumps(payload),
            extra_headers=dict(HTTP_X_EVENT_KEY="repo:refs_changed"),
            status_code=400,
        )
