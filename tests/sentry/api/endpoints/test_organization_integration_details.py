from sentry.models.identity import Identity, IdentityProvider
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.repository import Repository
from sentry.models.scheduledeletion import ScheduledDeletion
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


class OrganizationIntegrationDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-integration-details"

    def setUp(self):
        super().setUp()

        self.login_as(user=self.user)
        self.integration = Integration.objects.create(
            provider="gitlab", name="Gitlab", external_id="gitlab:1"
        )
        self.identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(type="gitlab", config={}, external_id="gitlab:1"),
            user=self.user,
            external_id="base_id",
            data={},
        )
        self.integration.add_organization(
            self.organization, self.user, default_auth_id=self.identity.id
        )

        with assume_test_silo_mode(SiloMode.REGION):
            self.repo = Repository.objects.create(
                provider="gitlab",
                name="getsentry/sentry",
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )


@control_silo_test
class OrganizationIntegrationDetailsGetTest(OrganizationIntegrationDetailsTest):
    def test_simple(self):
        response = self.get_success_response(self.organization.slug, self.integration.id)
        assert response.data["id"] == str(self.integration.id)


@control_silo_test
class OrganizationIntegrationDetailsPostTest(OrganizationIntegrationDetailsTest):
    method = "post"

    def test_update_config(self):
        config = {"setting": "new_value", "setting2": "baz"}
        self.get_success_response(self.organization.slug, self.integration.id, **config)

        org_integration = OrganizationIntegration.objects.get(
            integration=self.integration, organization_id=self.organization.id
        )

        assert org_integration.config == config


@control_silo_test
class OrganizationIntegrationDetailsDeleteTest(OrganizationIntegrationDetailsTest):
    method = "delete"

    def test_removal(self):
        self.get_success_response(self.organization.slug, self.integration.id)
        assert Integration.objects.filter(id=self.integration.id).exists()

        org_integration = OrganizationIntegration.objects.get(
            integration=self.integration, organization_id=self.organization.id
        )
        assert ScheduledDeletion.objects.filter(
            model_name="OrganizationIntegration", object_id=org_integration.id
        )
