from __future__ import absolute_import
from sentry import http
from sentry.integrations import Integration, IntegrationMetadata
from sentry.utils.pipeline import NestedPipelineView
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
    name = 'VSTS'
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

    def get_config(self):
        return [
            {
                'name': 'instance',
                'label': 'Instance',
                'type': 'text',
                'placeholder': 'example.visualstudio.com',
                'required': True,
                'help': 'VS Team Services account ({account}.visualstudio.com) or TFS server ({server:port}).',
            },
            {
                'name': 'default_project',
                'label': 'Default Project Name',
                'type': 'text',
                'placeholder': 'MyProject',
                'required': False,
                'help': (
                    'Enter the Visual Studio Team Services project name that you wish '
                    'to use as a default for new work items'
                ),
            },
        ]

    def get_projects(self, instance, access_token):
        session = http.build_session()
        url = 'https://%s/DefaultCollection/_apis/projects' % instance
        response = session.get(
            url,
            headers={
                'Content-Type': 'application/json',
                'Authorization': 'Bearer {}'.format(access_token),
            }
        )
        response.raise_for_status()
        response_json = response.json()
        return response_json

    def parse_instance(self, instance):
        # TODO(LB): is there something that will clean user-input data?
        return instance

    def build_integration(self, state):
        data = state['identity']['data']
        access_token = data['access_token']
        instance = self.parse_instance(state['identity']['instance'])
        scopes = sorted(self.identity_oauth_scopes)
        self.get_projects(instance, access_token)
        self.get_teams(instance, access_token)
        return {
            'name': 'VSTS',
            'external_id': 'vsts',
            'metadata': {
                'access_token': access_token,
                'scopes': scopes,
            },
        }

    def build_default_header(self, method):
        return {
            'Accept': 'application/json; api-version={}'.format(self.api_version),
            'Content-Type': 'application/json-patch+json',
            'X-HTTP-Method-Override': method,
            'X-TFS-FedAuthRedirect': 'Suppress',
        }
