from __future__ import absolute_import
from sentry import http
from time import time
from django import forms

from django.utils.translation import ugettext_lazy as _
from sentry.web.helpers import render_to_response
from sentry.integrations import IntegrationProvider, IntegrationMetadata
from sentry.pipeline import NestedPipelineView, PipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.identity.vsts import VSTSIdentityProvider
from sentry.utils.http import absolute_uri
DESCRIPTION = """
VSTS
"""

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    noun=_('Account'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=VSTS%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/vsts',
    aspects={},
)


class ProjectConfigView(PipelineView):
    def dispatch(self, request, pipeline):
        if 'project' in request.POST:
            project_id = request.POST.get('project')
            projects = pipeline.fetch_state(key='projects')
            project = self.get_project_from_id(project_id, projects)
            if project is not None:
                pipeline.bind_state('project', project)
                return pipeline.next_step()

        identity_data = pipeline.fetch_state(key='identity')
        instance = identity_data['instance']
        access_token = identity_data['data']['access_token']
        projects = get_projects(instance, access_token)['value']
        pipeline.bind_state('projects', projects)
        project_form = ProjectForm(projects)

        return render_to_response(
            template='sentry/integrations/vsts-config.html',
            context={
                'form': project_form,
            },
            request=request,
        )

    def get_project_from_id(self, project_id, projects):
        for project in projects:
            if project['id'] == project_id:
                return project
        return None


class ProjectForm(forms.Form):
    def __init__(self, projects, *args, **kwargs):
        super(ProjectForm, self).__init__(*args, **kwargs)
        self.fields['project'] = forms.ChoiceField(
            choices=[(project['id'], project['name']) for project in projects],
            label='Project',
            help_text='Enter the Visual Studio Team Services project name that you wish to use as a default for new work items'
        )


class VSTSIntegrationProvider(IntegrationProvider):
    key = 'vsts'
    name = 'Visual Studio Team Services'
    metadata = metadata
    domain = '.visualstudio.com'
    api_version = '4.1'

    setup_dialog_config = {
        'width': 600,
        'height': 800,
    }

    def get_pipeline_views(self):
        identity_pipeline_config = {
            'redirect_url': absolute_uri('/extensions/vsts/setup/'),
        }

        identity_pipeline_view = NestedPipelineView(
            bind_key='identity',
            provider_key='vsts',
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [
            identity_pipeline_view,
            ProjectConfigView(),
        ]

    def build_integration(self, state):
        data = state['identity']['data']
        account = state['identity']['account']
        instance = state['identity']['instance']
        project = state['project']

        scopes = sorted(VSTSIdentityProvider.oauth_scopes)
        return {
            'name': project['name'],
            'external_id': project['id'],
            'metadata': {
                'domain_name': instance,
                'scopes': scopes,
                # icon doesn't appear to be possible
            },
            'user_identity': {
                'type': 'vsts',
                'external_id': account['AccountId'],
                'scopes': [],
                'data': self.get_oauth_data(data),
            }
        }

    def get_oauth_data(self, payload):
        data = {'access_token': payload['access_token']}

        if 'expires_in' in payload:
            data['expires'] = int(time()) + int(payload['expires_in'])
        if 'refresh_token' in payload:
            data['refresh_token'] = payload['refresh_token']
        if 'token_type' in payload:
            data['token_type'] = payload['token_type']

        return data


def get_projects(instance, access_token):
    session = http.build_session()
    url = 'https://%s/DefaultCollection/_apis/projects' % instance
    response = session.get(
        url,
        headers={
            'Content-Type': 'application/json',
            'Authorization': 'Bearer %s' % access_token,
        }
    )
    response.raise_for_status()
    return response.json()
