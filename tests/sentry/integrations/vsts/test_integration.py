from __future__ import absolute_import

import responses

from mock import Mock
from django.http import HttpRequest

from sentry.integrations.vsts import VstsIntegrationProvider, ProjectConfigView, ProjectForm, get_projects
from sentry.identity.vsts import VSTSIdentityProvider
from sentry.testutils import TestCase


class ProjectConfigViewTest(TestCase):
    def setUp(self):
        self.instance = 'example.visualstudio.com'
        self.projects = [
            {
                'id': 'first-project-id',
                'name': 'First Project',
                        'url': 'https://myfirstproject.visualstudio.com/DefaultCollection/_apis/projects/xxxxxxx-xxxx-xxxx-xxxxxxxxxxxxxxxx',
                        'description': 'My First Project!',
            },
            {
                'id': 'second-project-id',
                'name': 'Second Project',
                        'url': 'https://mysecondproject.visualstudio.com/DefaultCollection/_apis/projects/xxxxxxx-xxxx-xxxx-xxxxxxxxxxxxxxxz',
                        'description': 'Not My First Project!',
            }
        ]
        responses.add(
            responses.GET,
            'https://{}/DefaultCollection/_apis/projects'.format(self.instance),
            json={
                'value': self.projects,
                'count': 2,
            },
        )

    @responses.activate
    def test_get_projects(self):
        result = get_projects(self.instance, 'access-token')
        assert result['count'] == 2
        assert result['value'][0]['name'] == 'First Project'
        assert result['value'][1]['name'] == 'Second Project'

    def test_project_form(self):
        project_form = ProjectForm(self.projects)
        assert project_form.fields['project'].choices == [
            ('first-project-id', 'First Project'), ('second-project-id', 'Second Project')]

    def test_dispatch(self):
        view = ProjectConfigView()
        request = HttpRequest()
        request.POST = {'project': 'first-project-id'}

        pipeline = Mock()
        pipeline.state = {'projects': self.projects}
        pipeline.fetch_state = lambda key: pipeline.state[key]
        pipeline.bind_state = lambda name, value: pipeline.state.update({name: value})

        view.dispatch(request, pipeline)

        assert pipeline.fetch_state(key='project') == self.projects[0]
        assert pipeline.next_step.call_count == 1


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
            'project': {'name': 'My Project', 'id': 'my-project-id'},
        }
        integration_dict = self.integration.build_integration(state)
        assert integration_dict['name'] == 'My Project'
        assert integration_dict['external_id'] == 'my-project-id'
        assert integration_dict['metadata']['scopes'] == list(VSTSIdentityProvider.oauth_scopes)
        assert integration_dict['metadata']['domain_name'] == 'sentry.visualstudio.com'

        assert integration_dict['user_identity']['type'] == 'vsts'
        assert integration_dict['user_identity']['external_id'] == '123435'
        assert integration_dict['user_identity']['scopes'] == []

        assert integration_dict['user_identity']['data']['access_token'] == 'xxx-xxxx'
        assert isinstance(integration_dict['user_identity']['data']['expires'], int)
        assert integration_dict['user_identity']['data']['refresh_token'] == 'rxxx-xxxx'
        assert integration_dict['user_identity']['data']['token_type'] == 'jwt-bearer'
