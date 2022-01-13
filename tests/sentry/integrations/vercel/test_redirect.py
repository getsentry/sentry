from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import IntegrationTestCase


class VercelConfigurationRedirectTest(IntegrationTestCase):
    @property
    def path(self):
        return "/extensions/vercel/redirect/?configurationId=my_config_id"

    def setUp(self):
        self.integration = Integration.objects.create(
            provider="vercel",
            external_id="abc123",
            name="hellboy",
            metadata={
                "access_token": "ogUp6j3AxpQnJUoBFdMn2qZM",
                "installation_id": "my_config_id",
                "installation_type": "team",
            },
            status=0,
        )
        self.oi = OrganizationIntegration.objects.create(
            organization=self.organization, integration=self.integration
        )

    def test_simple(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)

        assert resp.status_code == 302
        assert f"/settings/{self.organization.slug}/integrations/vercel/" in resp.url
