from __future__ import absolute_import

from sentry.models import (
    Integration,
    OrganizationIntegration,
)
from sentry.testutils import APITestCase


PRIMARY_UNINSTALL_RESPONSE = """{
    "configurationId": "my_config_id",
    "teamId": "vercel_team_id",
    "userId": "vercel_user_id"
}"""

NONPRIMARY_UNINSTALL_RESPONSE = """{
    "configurationId": "my_config_id2",
    "teamId": "vercel_team_id",
    "userId": "vercel_user_id"
}"""

USERID_UNINSTALL_RESPONSE = """{
    "configurationId": "my_config_id",
    "teamId": null,
    "userId": "vercel_user_id"
}"""


class VercelUninstallTest(APITestCase):
    def setUp(self):
        self.url = "/extensions/vercel/delete/"
        self.second_org = self.create_organization(name="Blah", owner=self.user)
        metadata = {
            "access_token": "my_access_token",
            "installation_id": "my_config_id",
            "webhook_id": "my_webhook_id",
            "configurations": {
                "my_config_id": {
                    "access_token": "my_access_token",
                    "webhook_id": "my_webhook_id",
                    "organization_id": self.organization.id,
                },
                "my_config_id2": {
                    "access_token": "my_access_token2",
                    "webhook_id": "my_webhook_id2",
                    "organization_id": self.second_org.id,
                },
            },
        }
        self.integration = Integration.objects.create(
            provider="vercel",
            external_id="vercel_team_id",
            name="My Vercel Team",
            metadata=metadata,
        )
        self.integration.add_organization(self.organization)
        self.integration.add_organization(self.second_org)

    def test_uninstall_primary_configuration(self):
        """
        Test uninstalling the configuration whose credentials
            * access_token
            * webhook_id
            * installation_id
        are used in the primary metadata for the integration.
        """

        assert len(OrganizationIntegration.objects.all()) == 2

        response = self.client.delete(
            path=self.url, data=PRIMARY_UNINSTALL_RESPONSE, content_type="application/json",
        )

        assert response.status_code == 204
        assert len(OrganizationIntegration.objects.all()) == 1

        integration = Integration.objects.get(id=self.integration.id)
        assert integration.metadata == {
            "access_token": "my_access_token2",
            "installation_id": "my_config_id2",
            "webhook_id": "my_webhook_id2",
            "configurations": {
                "my_config_id2": {
                    "access_token": "my_access_token2",
                    "webhook_id": "my_webhook_id2",
                    "organization_id": self.second_org.id,
                }
            },
        }

    def test_uninstall_non_primary_configuration(self):
        """
        Test uninstalling a configuration that is only stored
        in the "configurations" metadata.
        """

        assert len(OrganizationIntegration.objects.all()) == 2

        response = self.client.delete(
            path=self.url, data=NONPRIMARY_UNINSTALL_RESPONSE, content_type="application/json",
        )

        assert response.status_code == 204
        assert len(OrganizationIntegration.objects.all()) == 1

        integration = Integration.objects.get(id=self.integration.id)
        assert integration.metadata == {
            "access_token": "my_access_token",
            "installation_id": "my_config_id",
            "webhook_id": "my_webhook_id",
            "configurations": {
                "my_config_id": {
                    "access_token": "my_access_token",
                    "webhook_id": "my_webhook_id",
                    "organization_id": self.organization.id,
                }
            },
        }

    def test_uninstall_single_configuration(self):
        """
        Test uninstalling an integration with only one organization
        associated with it.
        """
        org = self.create_organization(owner=self.user)
        metadata = {
            "access_token": "my_access_token",
            "installation_id": "my_config_id",
            "webhook_id": "my_webhook_id",
            "configurations": {
                "my_config_id": {
                    "access_token": "my_access_token",
                    "webhook_id": "my_webhook_id",
                    "organization_id": org.id,
                }
            },
        }
        integration = Integration.objects.create(
            provider="vercel",
            external_id="vercel_user_id",
            name="My Vercel Team",
            metadata=metadata,
        )
        integration.add_organization(org)

        response = self.client.delete(
            path=self.url, data=USERID_UNINSTALL_RESPONSE, content_type="application/json",
        )

        assert response.status_code == 204
        assert not Integration.objects.filter(id=integration.id).exists()
        assert not OrganizationIntegration.objects.filter(
            integration_id=integration.id, organization_id=org.id
        ).exists()
