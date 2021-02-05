from sentry.models import (
    Integration,
    OrganizationIntegration,
    Repository,
    Identity,
    IdentityProvider,
)
from sentry.testutils import APITestCase


class OrganizationIntegrationDetailsTest(APITestCase):
    def setUp(self):
        super().setUp()

        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.integration = Integration.objects.create(
            provider="gitlab", name="Gitlab", external_id="gitlab:1"
        )
        self.identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(type="gitlab", config={}, external_id="gitlab:1"),
            user=self.user,
            external_id="base_id",
            data={},
        )
        self.integration.add_organization(self.org, self.user, default_auth_id=self.identity.id)

        self.repo = Repository.objects.create(
            provider="gitlab",
            name="getsentry/sentry",
            organization_id=self.org.id,
            integration_id=self.integration.id,
        )

        self.path = f"/api/0/organizations/{self.org.slug}/integrations/{self.integration.id}/"

    def test_simple(self):
        response = self.client.get(self.path, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.integration.id)

    def test_removal(self):
        with self.tasks():
            response = self.client.delete(self.path, format="json")

            assert response.status_code == 204, response.content
            assert Integration.objects.filter(id=self.integration.id).exists()

            # Ensure Organization integrations are removed
            assert not OrganizationIntegration.objects.filter(
                integration=self.integration, organization=self.org
            ).exists()
            assert not Identity.objects.filter(user=self.user).exists()

            # make sure repo is dissociated from integration
            assert Repository.objects.get(id=self.repo.id).integration_id is None

    def test_update_config(self):
        config = {"setting": "new_value", "setting2": "baz"}

        response = self.client.post(self.path, format="json", data=config)

        assert response.status_code == 200, response.content

        org_integration = OrganizationIntegration.objects.get(
            integration=self.integration, organization=self.org
        )

        assert org_integration.config == config

    def test_removal_default_identity_already_removed(self):
        with self.tasks():
            self.identity.delete()
            response = self.client.delete(self.path, format="json")

            assert response.status_code == 204, response.content
            assert Integration.objects.filter(id=self.integration.id).exists()

            # Ensure Organization integrations are removed
            assert not OrganizationIntegration.objects.filter(
                integration=self.integration, organization=self.org
            ).exists()
