from time import time
from typing import Any

import responses

from sentry.integrations.bitbucket_server.webhook import PROVIDER_NAME
from sentry.models.identity import Identity, IdentityProvider
from sentry.models.integrations.integration import Integration
from sentry.models.repository import Repository
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.utils import json
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
            self.integration = Integration.objects.create(
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
                idp=IdentityProvider.objects.create(type=PROVIDER, config={}),
                user=self.user,
                external_id="user_identity",
                data={"access_token": "vsts-access-token", "expires": time() + 50000},
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


@region_silo_test
class WebhookGetTest(WebhookTestBase):
    def test_get_request_fails(self):
        self.get_error_response(self.organization.id, self.integration.id, status_code=405)


@region_silo_test
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


@region_silo_test
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

    def test_simple(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.add_organization(self.organization, default_auth_id=self.identity.id)

        self.create_repository()
        self.send_webhook()

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
            raw_data=json.dumps(payload),
            extra_headers=dict(HTTP_X_EVENT_KEY="repo:refs_changed"),
            status_code=400,
        )
