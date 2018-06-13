from __future__ import absolute_import

import responses

import pytest

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
        model = Integration.objects.create(
            provider='integrations:vsts',
            external_id='vsts_external_id',
            name='vsts_name',
            metadata={
                 'domain_name': 'instance.visualstudio.com'
            }
        )
        self.identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(
                type='vsts',
                config={}
            ),
            user=self.user,
            external_id='vsts_id',
            data={
                'access_token': self.access_token,
            }
        )
        self.org_integration = model.add_organization(organization.id, self.identity.id)
        self.project_integration = model.add_project(project.id)
        self.integration = VstsIntegration(model, organization.id, project.id)
        self.projects = [
            ('eb6e4656-77fc-42a1-9181-4c6d8e9da5d1', 'ProjectB'),
            ('6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c', 'ProjectA')
        ]

        responses.add(
            responses.GET,
            'https://instance.visualstudio.com/DefaultCollection/_apis/projects',
            json={
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
            },
        )

    def test_get_client(self):
        client = self.integration.get_client()
        assert client.access_token == self.access_token

    @responses.activate
    def test_get_project_config(self):
        fields = self.integration.get_project_config()
        assert len(fields) == 1
        project_field = fields[0]
        assert project_field['name'] == 'default_project'
        assert project_field['disabled'] is False
        assert project_field['choices'] == self.projects
        assert project_field['initial'] == ('', '')

    @responses.activate
    def test_get_project_config_initial(self):
        self.integration.project_integration.config = {'default_project': self.projects[1][0]}
        self.integration.project_integration.save()
        fields = self.integration.get_project_config()
        assert len(fields) == 1
        project_field = fields[0]
        assert project_field['name'] == 'default_project'
        assert project_field['disabled'] is False
        assert project_field['choices'] == self.projects
        assert project_field['initial'] == self.projects[1]

    def test_get_project_config_failed_api_call(self):
        fields = self.integration.get_project_config()
        assert len(fields) == 1
        project_field = fields[0]
        assert project_field['name'] == 'default_project'
        assert project_field['disabled'] is True

    def test_get_refresh_identity_params_incomplete(self):
        # no refresh token in identity
        self.integration.default_identity = self.integration.get_default_identity()
        with pytest.raises(IdentityNotValid):
            self.integration.get_refresh_identity_params()

    @responses.activate
    def test_refresh_identity(self):
        refresh_data = {
            'access_token': 'access token for this user',
            'token_type': 'type of token',
            'expires_in': 'time in seconds that the token remains valid',
            'refresh_token': 'new refresh token to use when the token has timed out',
        }
        responses.add(
            responses.POST,
            'https://app.vssps.visualstudio.com/oauth2/token',
            json=refresh_data,
        )
        refresh_token = '123456789'
        self.identity.update(
            data={
                'access_token': self.access_token,
                'refresh_token': refresh_token,
            }
        )
        self.integration.refresh_identity()

        assert len(responses.calls) == 1
        assert self.integration.default_identity.data == refresh_data
        assert Identity.objects.get(id=self.identity.id).data == refresh_data
