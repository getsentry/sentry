from __future__ import absolute_import

import responses

from time import time
from sentry.auth.exceptions import IdentityNotValid
from sentry.identity.vsts import VSTSIdentityProvider
from sentry.integrations.vsts import VstsIntegration, VstsIntegrationProvider
from sentry.models import Integration, Identity, IdentityProvider
from sentry.testutils import APITestCase, TestCase


class VstsIntegrationProviderTest(TestCase):
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


class VstsIntegrationTest(APITestCase):
    def setUp(self):

        organization = self.create_organization()
        project = self.create_project(organization=organization)
        self.access_token = '1234567890'
        self.instance = 'instance.visualstudio.com'
        self.model = Integration.objects.create(
            provider='integrations:vsts',
            external_id='vsts_external_id',
            name='vsts_name',
            metadata={
                 'domain_name': 'instance.visualstudio.com'
            }
        )
        self.identity_provider = IdentityProvider.objects.create(type='vsts')
        self.identity = Identity.objects.create(
            idp=self.identity_provider,
            user=self.user,
            external_id='vsts_id',
            data={
                'access_token': self.access_token,
                'refresh_token': 'qwertyuiop',
                'expires': int(time()) - int(1234567890),
            }
        )
        self.org_integration = self.model.add_organization(organization.id, self.identity.id)
        self.project_integration = self.model.add_project(project.id)
        self.integration = VstsIntegration(self.model, organization.id, project.id)

    def assert_identity_updated(self, new_identity, expected_data):
        assert new_identity.data['access_token'] == expected_data['access_token']
        assert new_identity.data['token_type'] == expected_data['token_type']
        assert new_identity.data['refresh_token'] == expected_data['refresh_token']
        assert new_identity.data['expires'] >= time()

    def test_get_client(self):
        client = self.integration.get_client()
        assert client.identity.data['access_token'] == self.access_token

    @responses.activate
    def test_refreshes_expired_token(self):

        projects = {'value': ['Project1', 'Project2'], 'count': 2, }
        refresh_data = {
            'access_token': 'access token for this user',
            'token_type': 'type of token',
            'expires_in': 123456789,
            'refresh_token': 'new refresh token to use when the token has timed out',
        }
        responses.add(
            responses.POST,
            'https://app.vssps.visualstudio.com/oauth2/token',
            json=refresh_data,
        )
        responses.add(
            responses.GET,
            'https://{}/DefaultCollection/_apis/projects'.format(self.instance),
            json=projects,
        )

        result = self.integration.get_client().get_projects(self.instance)

        assert len(responses.calls) == 2
        default_identity = self.integration.default_identity
        self.assert_identity_updated(default_identity, refresh_data)

        identity = Identity.objects.get(id=self.identity.id)
        self.assert_identity_updated(identity, refresh_data)

        assert result == projects
