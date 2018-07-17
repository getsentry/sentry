from __future__ import absolute_import

from sentry.models import Integration as IntegrationModel, Identity, IdentityProvider
from sentry.integrations import Integration
from sentry.testutils import TestCase


class IntegrationTestCase(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization()
        self.project = self.create_project()

        self.model = IntegrationModel.objects.create(
            provider='integrations:base',
            external_id='base_external_id',
            name='base_name',
        )

        self.identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(
                type='base',
                config={}
            ),
            user=self.user,
            external_id='base_id',
            data={
                'access_token': '11234567'
            }
        )
        self.org_integration = self.model.add_organization(self.organization.id, self.identity.id)
        self.project_integration = self.model.add_project(self.project.id)

    def test_no_context(self):
        integration = Integration(self.model, self.organization.id)
        integration.name = 'Base'

        assert integration.project_integration is None

    def test_with_context(self):
        integration = Integration(self.model, self.organization.id, self.project.id)

        assert integration.model == self.model
        assert integration.org_integration == self.org_integration
        assert integration.project_integration == self.project_integration
        assert integration.get_default_identity() == self.identity
