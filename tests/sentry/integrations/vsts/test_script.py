from __future__ import absolute_import

import responses
from time import time


from sentry.integrations.vsts.vsts_subscription_script import recreate_subscriptions
from sentry.models import (
    Identity, IdentityProvider, Integration, OrganizationIntegration
)
from sentry.testutils import TestCase
from uuid import uuid4


class VSTSScriptTest(TestCase):
    def setUp(self):
        self.idp = IdentityProvider.objects.create(
            type='vsts',
            config={},
        )
        self.integration_1 = self.create_integration(
            self.create_organization(), 'https://dev.azure.com/integration_1/')
        self.integration_2 = self.create_integration(
            self.create_organization(), 'https://dev.azure.com/integration_2/')
        responses.add(
            responses.POST,
            'https://app.vssps.visualstudio.com/oauth2/token',
            status=401,
        )

    def create_integration(self, organization, domain_name):
        user = self.create_user()
        integration = Integration.objects.create(
            provider='vsts',
            name='Example Vsts',
            external_id=uuid4().hex,
            metadata={
                'domain_name': domain_name,
            }
        )
        default_auth = self.create_identity(user)
        integration.add_organization(organization, None, default_auth.id)
        return integration

    def create_identity(self, user):
        default_auth = Identity.objects.create(
            idp=self.idp,
            user=user,
            external_id=uuid4().hex,
            data={
                'access_token': '123456789',
                'expires': int(time()) + 3600,
                'refresh_token': 'rxxx-xxxx',
                'token_type': 'jwt-bearer',
            },
        )
        return default_auth

    def assert_subscription(self, integration_id, subscription_id):
        integration = Integration.objects.get(id=integration_id)
        assert integration.metadata['subscription']['id'] == subscription_id
        assert integration.metadata['subscription']['secret']

    def create_integration_with_invalid_id(self, organization, domain_name):
        integration = self.create_integration(organization, domain_name)
        org_integration = OrganizationIntegration.objects.get(
            organization_id=organization.id,
            integration_id=integration.id
        )
        identity = Identity.objects.get(
            id=org_integration.default_auth_id,
        )

        # because refreshing auth will fail when it tries.
        identity.data['expires'] -= 200000
        identity.save()
        return integration

    @responses.activate
    def test_recreate_subscription(self):
        integration_3 = self.create_integration_with_invalid_id(
            self.create_organization(), 'https://dev.azure.com/integration_3/')
        # create a valid id for integration_3
        integration_3.add_organization(
            self.create_organization(),
            None,
            self.create_identity(
                self.create_user()).id)
        subscription_id_1 = 'one'
        subscription_id_3 = 'two and three'
        responses.add(
            responses.POST,
            'https://dev.azure.com/integration_1/_apis/hooks/subscriptions',
            json={
                'id': subscription_id_1,
            }
        )
        responses.add(
            responses.POST,
            'https://dev.azure.com/integration_2/_apis/hooks/subscriptions',
            status=401,
        )
        responses.add(
            responses.POST,
            'https://dev.azure.com/integration_3/_apis/hooks/subscriptions',
            json={
                'id': subscription_id_3,
            }
        )
        recreate_subscriptions()

        self.assert_subscription(self.integration_1.id, subscription_id_1)
        assert 'subscription' not in self.integration_2.metadata
        self.assert_subscription(integration_3.id, subscription_id_3)
