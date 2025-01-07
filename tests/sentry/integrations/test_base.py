from sentry.identity.services.identity.serial import serialize_identity
from sentry.integrations.base import IntegrationInstallation
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode


class TestIntegration(IntegrationInstallation):
    __test__ = False

    def get_client(self):
        raise NotImplementedError


@all_silo_test
class IntegrationTestCase(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization()
        self.project = self.create_project()
        (
            self.model,
            self.org_integration,
            self.identity,
            identity_provider,
        ) = self.create_identity_integration(
            user=self.user,
            organization=self.organization,
            integration_params={
                "provider": "integrations:base",
                "external_id": "base_external_id",
                "name": "base_name",
            },
            identity_params={"external_id": "base_id", "data": {"access_token": "11234567"}},
        )

    def test_with_context(self):
        integration = TestIntegration(self.model, self.organization.id)
        assert integration.model.id == self.model.id
        assert integration.org_integration is not None
        assert integration.org_integration.id == self.org_integration.id
        assert integration.get_default_identity() == serialize_identity(self.identity)

    def test_model_default_fields(self):
        # These fields are added through the DefaultFieldsModel
        # and date_updated should get automatically updated any
        # time the model is saved
        assert self.model.date_added
        assert self.model.date_updated

        initial_value = self.model.date_updated
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.model.name = "cooler_name"
            self.model.save()
            self.model.refresh_from_db()
        assert initial_value < self.model.date_updated
