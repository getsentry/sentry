from sentry.integrations import IntegrationInstallation
from sentry.models.identity import Identity, IdentityProvider
from sentry.services.hybrid_cloud.identity.serial import serialize_identity
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.testutils.cases import TestCase


class IntegrationTestCase(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization()
        self.project = self.create_project()
        self.identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(type="base", config={}),
            user=self.user,
            external_id="base_id",
            data={"access_token": "11234567"},
        )
        self.model = self.create_integration(
            organization=self.organization,
            provider="integrations:base",
            external_id="base_external_id",
            name="base_name",
            oi_params={"default_auth_id": self.identity.id},
        )

        self.org_integration = integration_service.get_organization_integration(
            integration_id=self.model.id,
            organization_id=self.organization.id,
        )

    def test_with_context(self):
        integration = IntegrationInstallation(self.model, self.organization.id)

        assert integration.model == self.model
        assert integration.org_integration == self.org_integration
        assert integration.get_default_identity() == serialize_identity(self.identity)

    def test_model_default_fields(self):
        # These fields are added through the DefaultFieldsModel
        # and date_updated should get automatically updated any
        # time the model is saved
        assert self.model.date_added
        assert self.model.date_updated

        initial_value = self.model.date_updated
        self.model.name = "cooler_name"
        self.model.save()

        self.model.refresh_from_db()
        assert initial_value < self.model.date_updated
