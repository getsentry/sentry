from unittest import mock

import responses

from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import integration_service
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode_of


@all_silo_test
@freeze_time("2025-01-01T05:22:00Z")
class IntegrationServiceTest(TestCase):
    jwt = "my_cool_jwt"

    def setUp(self):
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="github:1",
        )

    @responses.activate
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=jwt)
    def test_refresh_expired_token(self, mock_jwt):
        with assume_test_silo_mode_of(Integration):
            self.integration.metadata["access_token"] = "token_1"
            self.integration.metadata["expires_at"] = "2025-01-01T05:21:59Z"
            self.integration.metadata["permissions"] = {
                "administration": "read",
                "contents": "read",
                "issues": "write",
                "metadata": "read",
                "pull_requests": "read",
            }
            self.integration.save()

        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github:1/access_tokens",
            json={
                "token": "token_2",
                "expires_at": "2025-01-01T06:22:00Z",
                "permissions": {
                    "administration": "read",
                },
            },
            status=200,
            content_type="application/json",
        )

        rpc_integration = integration_service.refresh_github_access_token(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        assert rpc_integration.metadata["access_token"] == "token_2"
        assert rpc_integration.metadata["expires_at"] == "2025-01-01T06:22:00"
        assert rpc_integration.metadata["permissions"] == {
            "administration": "read",
        }

    @responses.activate
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=jwt)
    def test_refresh_token_within_grace_period(self, mock_jwt):
        with assume_test_silo_mode_of(Integration):
            self.integration.metadata["access_token"] = "token_1"
            self.integration.metadata["expires_at"] = "2025-01-01T05:31:59Z"
            self.integration.metadata["permissions"] = {
                "contents": "read",
            }
            self.integration.save()

        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github:1/access_tokens",
            json={
                "token": "token_refreshed",
                "expires_at": "2025-01-01T06:32:00Z",
                "permissions": {
                    "contents": "write",
                },
            },
            status=200,
            content_type="application/json",
        )

        rpc_integration = integration_service.refresh_github_access_token(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        assert rpc_integration.metadata["access_token"] == "token_refreshed"
        assert rpc_integration.metadata["expires_at"] == "2025-01-01T06:32:00"
        assert rpc_integration.metadata["permissions"] == {
            "contents": "write",
        }

    @responses.activate
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=jwt)
    def test_no_refresh_token_outside_grace_period(self, mock_jwt):
        with assume_test_silo_mode_of(Integration):
            self.integration.metadata["access_token"] = "token_valid"
            self.integration.metadata["expires_at"] = "2025-01-01T05:32:01Z"
            self.integration.metadata["permissions"] = {
                "issues": "write",
            }
            self.integration.save()

        rpc_integration = integration_service.refresh_github_access_token(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        assert rpc_integration.metadata["access_token"] == "token_valid"
        assert rpc_integration.metadata["expires_at"] == "2025-01-01T05:32:01Z"
        assert rpc_integration.metadata["permissions"] == {
            "issues": "write",
        }

    @responses.activate
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=jwt)
    def test_refresh_token_missing_expiration_time(self, mock_jwt):
        with assume_test_silo_mode_of(Integration):
            self.integration.metadata["access_token"] = "token_no_expiry"
            self.integration.metadata["permissions"] = {
                "metadata": "read",
            }
            self.integration.save()

        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github:1/access_tokens",
            json={
                "token": "token_new",
                "expires_at": "2025-01-01T06:22:00Z",
                "permissions": {
                    "metadata": "write",
                    "pull_requests": "read",
                },
            },
            status=200,
            content_type="application/json",
        )

        rpc_integration = integration_service.refresh_github_access_token(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        assert rpc_integration.metadata["access_token"] == "token_new"
        assert rpc_integration.metadata["expires_at"] == "2025-01-01T06:22:00"
        assert rpc_integration.metadata["permissions"] == {
            "metadata": "write",
            "pull_requests": "read",
        }
