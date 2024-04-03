from __future__ import annotations

from unittest.mock import patch

from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.integrations.utils.atlassian_connect import AtlassianConnectValidationError
from sentry.services.hybrid_cloud.integration.serial import serialize_integration
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class BitbucketUnistalledEndpointTest(TestCase):
    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="connection:123",
            provider="bitbucket",
            metadata={
                "public_key": "public-key",
                "base_url": "https://api.bitbucket.org",
                "shared_secret": "a-big-secret",
                "domain_name": "bitbucket.org/test-org",
                "icon": "https://bitbucket.org/account/test-org/avatar/",
                "scopes": ["issue:write", "pullrequest", "webhook", "repository"],
                "uuid": "u-u-i-d",
                "type": "team",
            },
        )
        self.install = self.integration.get_installation(self.organization.id)
        self.path = reverse("sentry-extensions-bitbucket-uninstalled")
        self.repository = self.create_repo(
            project=self.project,
            provider="integrations:bitbucket",
            integration_id=self.integration.id,
        )

    def test_uninstall_missing_auth_header(self):
        response = self.client.post(self.path)

        assert response.status_code == 400
        self.repository.refresh_from_db()
        assert self.repository.id

    @patch("sentry.integrations.bitbucket.uninstalled.get_integration_from_jwt")
    def test_uninstall_missing_integration(self, mock_jwt):
        mock_jwt.side_effect = AtlassianConnectValidationError("missing integration")
        response = self.client.post(self.path, HTTP_AUTHORIZATION="JWT fake-jwt")

        assert response.status_code == 400
        self.repository.refresh_from_db()
        assert self.repository.id
        assert self.repository.status == ObjectStatus.ACTIVE

    @patch("sentry.integrations.bitbucket.uninstalled.get_integration_from_jwt")
    def test_uninstall_success(self, mock_jwt):
        mock_jwt.return_value = serialize_integration(self.integration)
        response = self.client.post(self.path, HTTP_AUTHORIZATION="JWT fake-jwt")

        assert response.status_code == 200
        self.repository.refresh_from_db()
        assert self.repository.id
        assert self.repository.status == ObjectStatus.DISABLED
