from __future__ import absolute_import
from sentry import http
from sentry.integrations import Integration, IntegrationMetadata
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.utils.http import absolute_uri
DESCRIPTION = """
VSTS
"""

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    issue_url='https://github.com/getsentry/sentry/issues/new?title=VSTS%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/vsts',
    aspects={},
)


class VSTSIntegration(Integration):
    key = 'vsts'
    name = 'Visual Studio Team Services'
    metadata = metadata
    domain = '.visualstudio.com'
    api_version = '4.1'

    setup_dialog_config = {
        'width': 600,
        'height': 800,
    }

    identity_oauth_scopes = frozenset([
        'vso.code_full',
        'vso.identity_manage',
        'vso.work_full',
    ])

    def get_pipeline_views(self):
        identity_pipeline_config = {
            'oauth_scopes': self.identity_oauth_scopes,
            'redirect_url': absolute_uri('/extensions/vsts/setup/'),
        }

        identity_pipeline_view = NestedPipelineView(
            bind_key='identity',
            provider_key='vsts',
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [identity_pipeline_view]

    def get_projects(self, instance, access_token):
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
        response_json = response.json()
        return response_json

    def get_account_info(self, instance, access_token):
        session = http.build_session()
        url = 'https://%s/_apis/accounts?api-version=4.1' % instance
        response = session.get(
            url,
            headers={
                'Content-Type': 'application/json',
                'Authorization': 'Bearer %s' % access_token,
            }
        )
        response.raise_for_status()
        response_json = response.json()
        return response_json

    def get_default_project(self, name, projects):
        for project in projects:
            if project['name'] == name:
                return project

    def build_integration(self, state):
        data = state['identity']['data']
        access_token = data['access_token']
        instance = state['identity']['instance']
        default_project_name = state['identity']['default_project']

        scopes = sorted(self.identity_oauth_scopes)
        projects = self.get_projects(instance, access_token)['value']
        default_project = self.get_default_project(default_project_name, projects)
        return {
            'name': default_project['name'],
            'external_id': default_project['id'],
            'metadata': {
                'scopes': scopes,
                'domain_name': instance,
                # icon doesn't appear to be possible
            },
            'user_identity': {
                'access_token': access_token,
                'type': 'vsts',
                'external_id': instance,
                'scopes': [],
                'data': {},
            }
        }
