from __future__ import absolute_import


from sentry.integrations.vsts import VstsIntegration, VstsIntegrationProvider
from sentry.identity.vsts import VSTSIdentityProvider
from sentry.models import Integration, Identity, IdentityProvider
from sentry.testutils import TestCase


class VSTSIntegrationTest(TestCase):
    def setUp(self):
        self.integration = VstsIntegrationProvider()

    def test_build_integration(self):
        state = {
            'identity': {
                'data': {
                    'access_token': 'xxx-xxxx',
                    'expires_in': '3600',
                    'refresh_token': 'rxxx-xxxx',
                    'token_type': 'jwt-bearer',
                },
                'account': {'AccountName': 'sentry', 'AccountId': '123435'},
                'instance': 'sentry.visualstudio.com',
            },
        }
        integration_dict = self.integration.build_integration(state)
        assert integration_dict['name'] == 'sentry'
        assert integration_dict['external_id'] == '123435'
        assert integration_dict['metadata']['scopes'] == list(VSTSIdentityProvider.oauth_scopes)
        assert integration_dict['metadata']['domain_name'] == 'sentry.visualstudio.com'

        assert integration_dict['user_identity']['type'] == 'vsts'
        assert integration_dict['user_identity']['external_id'] == '123435'
        assert integration_dict['user_identity']['scopes'] == []

        assert integration_dict['user_identity']['data']['access_token'] == 'xxx-xxxx'
        assert isinstance(integration_dict['user_identity']['data']['expires'], int)
        assert integration_dict['user_identity']['data']['refresh_token'] == 'rxxx-xxxx'
        assert integration_dict['user_identity']['data']['token_type'] == 'jwt-bearer'


class VstsIntegrationTest(TestCase):
    def test_get_client(self):
        user = self.create_user()
        organization = self.create_organization()
        access_token = '1234567890'
        model = Integration.objects.create(
            provider='integrations:vsts',
            external_id='vsts_external_id',
            name='vsts_name',
        )

        identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(
                type='vsts',
                config={}
            ),
            user=user,
            external_id='vsts_id',
            data={
                'access_token': access_token
            }
        )
        model.add_organization(organization.id, identity.id)
        integration = VstsIntegration(model, organization.id)
        client = integration.get_client()

        assert client.access_token == access_token
