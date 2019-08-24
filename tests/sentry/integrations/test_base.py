from __future__ import absolute_import

from sentry.models import Integration, Identity, IdentityProvider
from sentry.integrations import IntegrationInstallation
from sentry.testutils import TestCase


class IntegrationTestCase(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization()
        self.project = self.create_project()

        self.model = Integration.objects.create(
            provider="integrations:base", external_id="base_external_id", name="base_name"
        )

        self.identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(type="base", config={}),
            user=self.user,
            external_id="base_id",
            data={"access_token": "11234567"},
        )
        self.org_integration = self.model.add_organization(
            self.organization, self.user, self.identity.id
        )

    def test_no_context(self):
        integration = IntegrationInstallation(self.model, self.organization.id)
        integration.name = "Base"

    def test_with_context(self):
        integration = IntegrationInstallation(self.model, self.organization.id)

        assert integration.model == self.model
        assert integration.org_integration == self.org_integration
        assert integration.get_default_identity() == self.identity
