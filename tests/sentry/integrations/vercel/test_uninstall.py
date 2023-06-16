import responses

from fixtures.vercel import SECRET
from sentry.constants import ObjectStatus
from sentry.integrations.vercel import VercelClient
from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import APITestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import control_silo_test

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

# response payload to POST, instead of DELETE
# Old Vercel response
POST_DELETE_RESPONSE_OLD = """{
        "type": "integration-configuration-removed",
        "payload": {
            "configuration": {
                "id": "my_config_id",
                "projects": ["project_id1"]
            }
        },
        "teamId": "vercel_team_id",
        "userId": "vercel_user_id"
}"""

# New Vercel response
POST_DELETE_RESPONSE_NEW = """{
        "type": "integration-configuration.removed",
        "payload": {
            "configuration": {
                "id": "my_config_id",
                "projects": ["project_id1"]
            },
            "team": {
                "id": "vercel_team_id"
            },
            "user": {
                "id": "vercel_user_id"
            }
        }
}"""


class VercelUninstallTest(APITestCase):
    def setUp(self):
        self.url = "/extensions/vercel/delete/"
        metadata = {
            "access_token": "my_access_token",
            "installation_id": "my_config_id",
            "installation_type": "team",
            "webhook_id": "my_webhook_id",
        }
        self.integration = Integration.objects.create(
            provider="vercel",
            external_id="vercel_team_id",
            name="My Vercel Team",
            metadata=metadata,
        )
        self.integration.add_organization(self.organization)

    def _get_delete_response(self):
        # https://vercel.com/docs/integrations?query=event%20paylo#webhooks/events/integration-configuration-removed
        return """{
            "payload": {
                "configuration": {
                    "id": "my_config_id",
                    "projects": ["project_id1"]
                }
            },
            "teamId": "vercel_team_id",
            "userId": "vercel_user_id"
        }"""

    def test_uninstall_old(self):
        with override_options({"vercel.client-secret": SECRET}):
            response = self.client.post(
                path=self.url,
                data=POST_DELETE_RESPONSE_OLD,
                content_type="application/json",
                HTTP_X_VERCEL_SIGNATURE="9fe7776332998c90980cc537b24b196f37e17c99",
            )

            assert response.status_code == 204
            assert not Integration.objects.filter(id=self.integration.id).exists()
            assert not OrganizationIntegration.objects.filter(
                integration_id=self.integration.id, organization_id=self.organization.id
            ).exists()

    def test_uninstall_new(self):
        with override_options({"vercel.client-secret": SECRET}):
            response = self.client.post(
                path=self.url,
                data=POST_DELETE_RESPONSE_NEW,
                content_type="application/json",
                HTTP_X_VERCEL_SIGNATURE="83d53d644f6504de716eea275039e8bddd870be5",
            )

            assert response.status_code == 204
            assert not Integration.objects.filter(id=self.integration.id).exists()
            assert not OrganizationIntegration.objects.filter(
                integration_id=self.integration.id, organization_id=self.organization.id
            ).exists()


@control_silo_test
class VercelUninstallWithConfigurationsTest(APITestCase):
    def setUp(self):
        self.url = "/extensions/vercel/delete/"
        self.second_org = self.create_organization(name="Blah", owner=self.user)
        metadata = {
            "access_token": "my_access_token",
            "installation_id": "my_config_id",
            "installation_type": "team",
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
            path=self.url,
            data=PRIMARY_UNINSTALL_RESPONSE,
            content_type="application/json",
        )

        assert response.status_code == 204
        assert len(OrganizationIntegration.objects.all()) == 1

        integration = Integration.objects.get(id=self.integration.id)
        assert integration.metadata == {
            "access_token": "my_access_token2",
            "installation_id": "my_config_id2",
            "installation_type": "team",
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
            path=self.url,
            data=NONPRIMARY_UNINSTALL_RESPONSE,
            content_type="application/json",
        )

        assert response.status_code == 204
        assert len(OrganizationIntegration.objects.all()) == 1

        integration = Integration.objects.get(id=self.integration.id)
        assert integration.metadata == {
            "access_token": "my_access_token",
            "installation_id": "my_config_id",
            "installation_type": "team",
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
            "installation_type": "user",
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
            path=self.url,
            data=USERID_UNINSTALL_RESPONSE,
            content_type="application/json",
        )

        assert response.status_code == 204
        assert not Integration.objects.filter(id=integration.id).exists()
        assert not OrganizationIntegration.objects.filter(
            integration_id=integration.id, organization_id=org.id
        ).exists()

    @responses.activate
    def test_uninstall_from_sentry(self):
        """
        Test flows of uninstalling from sentry first to make sure
        that uninstall webhook is valid even if the OrganizationIntegration
        was deleted prior.
          1. Uninstall the primary configuration
          2. Check that integration metadata still updated
          3. Uninstall remaining configuration
          4. Check that integration is removed
        """
        self.login_as(self.user)
        with self.tasks():
            config_id = "my_config_id"
            responses.add(
                responses.DELETE,
                f"{VercelClient.base_url}{VercelClient.UNINSTALL % config_id}",
                json={},
            )
            path = (
                f"/api/0/organizations/{self.organization.slug}/integrations/{self.integration.id}/"
            )
            response = self.client.delete(path, format="json")
            assert response.status_code == 204

        assert (
            len(
                OrganizationIntegration.objects.filter(
                    integration=self.integration,
                    status=ObjectStatus.ACTIVE,
                )
            )
            == 1
        )

        response = self.client.delete(
            path=self.url,
            data=PRIMARY_UNINSTALL_RESPONSE,
            content_type="application/json",
        )
        assert response.status_code == 204

        integration = Integration.objects.get(id=self.integration.id)
        assert integration.metadata == {
            "access_token": "my_access_token2",
            "installation_id": "my_config_id2",
            "installation_type": "team",
            "webhook_id": "my_webhook_id2",
            "configurations": {
                "my_config_id2": {
                    "access_token": "my_access_token2",
                    "webhook_id": "my_webhook_id2",
                    "organization_id": self.second_org.id,
                }
            },
        }

        with self.tasks():
            config_id = "my_config_id2"
            responses.add(
                responses.DELETE,
                f"{VercelClient.base_url}{VercelClient.UNINSTALL % config_id}",
                json={},
            )
            path = (
                f"/api/0/organizations/{self.second_org.slug}/integrations/{self.integration.id}/"
            )
            response = self.client.delete(path, format="json")
            assert response.status_code == 204

        assert (
            len(
                OrganizationIntegration.objects.filter(
                    integration=self.integration,
                    status=ObjectStatus.ACTIVE,
                )
            )
            == 0
        )

        response = self.client.delete(
            path=self.url,
            data=NONPRIMARY_UNINSTALL_RESPONSE,
            content_type="application/json",
        )
        assert response.status_code == 204
        assert not Integration.objects.filter(id=self.integration.id).exists()
