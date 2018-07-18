from __future__ import absolute_import

import responses

from time import time

from sentry.identity.vsts import VSTSIdentityProvider
from sentry.integrations.vsts import VstsIntegration, VstsIntegrationProvider
from sentry.models import Integration, Identity, IdentityProvider
from sentry.testutils import APITestCase, TestCase
from .testutils import CREATE_SUBSCRIPTION


class VstsIntegrationProviderTest(TestCase):
    def setUp(self):
        self.integration = VstsIntegrationProvider()
        responses.add(
            responses.GET,
            'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=1.0',
            json={
                'id': 'user1',
                'displayName': 'Sentry User',
                'emailAddress': 'sentry@user.com',
            },
        )
        responses.add(
            responses.GET,
            'https://app.vssps.visualstudio.com/_apis/connectionData/',
            json={
                'authenticatedUser': {
                    'subjectDescriptor': 'user1-subject-desc',
                },
            },
        )
        responses.add(
            responses.POST,
            'https://sentry.visualstudio.com/_apis/hooks/subscriptions',
            json=CREATE_SUBSCRIPTION,
        )

    @responses.activate
    def test_build_integration(self):
        state = {
            'account': {'AccountName': 'sentry', 'AccountId': '123435'},
            'instance': 'sentry.visualstudio.com',
            'identity': {
                'data': {
                    'access_token': 'xxx-xxxx',
                    'expires_in': '3600',
                    'refresh_token': 'rxxx-xxxx',
                    'token_type': 'jwt-bearer',
                },
            },
        }
        integration_dict = self.integration.build_integration(state)
        assert integration_dict['name'] == 'sentry'
        assert integration_dict['external_id'] == '123435'
        assert integration_dict['metadata']['domain_name'] == 'sentry.visualstudio.com'
        assert integration_dict['metadata']['subscription']['id'] == CREATE_SUBSCRIPTION['publisherInputs']['tfsSubscriptionId']
        assert integration_dict['metadata']['subscription']['secret'] is not None

        assert integration_dict['user_identity']['type'] == 'vsts'
        assert integration_dict['user_identity']['external_id'] == 'user1-subject-desc'
        assert integration_dict['user_identity']['scopes'] == sorted(
            VSTSIdentityProvider.oauth_scopes)

        assert integration_dict['user_identity']['data']['access_token'] == 'xxx-xxxx'
        assert isinstance(integration_dict['user_identity']['data']['expires'], int)
        assert integration_dict['user_identity']['data']['refresh_token'] == 'rxxx-xxxx'
        assert integration_dict['user_identity']['data']['token_type'] == 'jwt-bearer'

    @responses.activate
    def test_subscription_created_once(self):
        external_id = '123-VSTS'
        Integration.objects.create(
            provider='vsts',
            external_id=external_id,
            name='vsts_name',
            metadata={},
        )
        state = {
            'account': {'AccountName': 'sentry', 'AccountId': external_id},
            'instance': 'sentry.visualstudio.com',
            'identity': {
                'data': {
                    'access_token': 'xxx-xxxx',
                    'expires_in': '3600',
                    'refresh_token': 'rxxx-xxxx',
                    'token_type': 'jwt-bearer',
                },
            },
        }
        integration_dict = self.integration.build_integration(state)
        assert 'subscription' not in integration_dict['metadata']


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
        self.projects = [
            ('eb6e4656-77fc-42a1-9181-4c6d8e9da5d1', 'ProjectB'),
            ('6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c', 'ProjectA')
        ]
        self.project_result = {
            'value': [
                {
                    'id': self.projects[0][0],
                    'name': self.projects[0][1],

                },
                {
                    'id': self.projects[1][0],
                    'name': self.projects[1][1],
                }
            ],
            'count': 2
        }
        responses.add(
            responses.GET,
            'https://instance.visualstudio.com/DefaultCollection/_apis/projects',
            json=self.project_result,
        )
        self.refresh_data = {
            'access_token': 'access token for this user',
            'token_type': 'type of token',
            'expires_in': 123456789,
            'refresh_token': 'new refresh token to use when the token has timed out',
        }
        responses.add(
            responses.POST,
            'https://app.vssps.visualstudio.com/oauth2/token',
            json=self.refresh_data,
        )

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
        result = self.integration.get_client().get_projects(self.instance)

        assert len(responses.calls) == 2
        default_identity = self.integration.default_identity
        self.assert_identity_updated(default_identity, self.refresh_data)

        identity = Identity.objects.get(id=self.identity.id)
        self.assert_identity_updated(identity, self.refresh_data)

        projects = result['value']
        assert projects[0]['id'] == self.projects[0][0] and projects[0]['name'] == self.projects[0][1]
        assert projects[1]['id'] == self.projects[1][0] and projects[1]['name'] == self.projects[1][1]

    @responses.activate
    def test_get_organization_config(self):
        fields = self.integration.get_organization_config()
        assert len(fields) == 6
        names = [
            'resolve_status',
            'resolve_when',
            'regression_status',
            'sync_comments',
            'sync_forward_assignment',
            'sync_reverse_assignment']
        assert [field['name'] for field in fields] == names
