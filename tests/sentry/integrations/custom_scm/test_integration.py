from sentry.integrations.custom_scm import CustomSCMIntegrationProvider
from sentry.models import Integration, OrganizationIntegration, Repository
from sentry.testutils import IntegrationTestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class CustomSCMIntegrationTest(IntegrationTestCase):
    provider = CustomSCMIntegrationProvider
    config = {
        "name": "my-org",
        "url": "https://github.com/",
    }

    def assert_setup_flow(self):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200
        self.assertContains(resp, "Custom Source Control Management Setup")

        resp = self.client.post(self.init_path, data=self.config)
        assert resp.status_code == 200

        self.assertDialogSuccess(resp)

    def test_basic_flow(self):
        self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.external_id
        assert integration.name == "my-org"
        assert integration.metadata == {"domain_name": "https://github.com/my-org"}

        oi = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        assert oi.config == {}

    def test_get_repositories(self):
        """
        Test that only repositories without both an integration and a provider
        are valid to be added.
        """
        unknown_repo = Repository.objects.create(
            name="my-org/some-repo", organization_id=self.organization.id
        )
        # create a legacy repo tied to a plugin, not integration
        Repository.objects.create(
            name="plugin-repo", provider="github", organization_id=self.organization.id
        )
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(self.organization.id)
        repos = installation.get_repositories()

        assert repos == [{"name": "my-org/some-repo", "identifier": str(unknown_repo.id)}]
