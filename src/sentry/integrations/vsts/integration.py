from __future__ import absolute_import
from time import time

from django.utils.translation import ugettext as _
from sentry.integrations import Integration, IntegrationProvider, IntegrationMetadata
from sentry.integrations.exceptions import ApiError
from .client import VstsApiClient
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.identity.vsts import VSTSIdentityProvider
from sentry.utils.http import absolute_uri

from .repository import VstsRepositoryProvider
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


class VstsIntegration(Integration):
    def __init__(self, *args, **kwargs):
        super(VstsIntegration, self).__init__(*args, **kwargs)
        self.default_identity = None

    def get_client(self):
        if self.default_identity is None:
            self.default_identity = self.get_default_identity()

        access_token = self.default_identity.data.get('access_token')
        if access_token is None:
            raise ValueError('Identity missing access token')
        return VstsApiClient(access_token)

    def get_project_config(self):
        client = self.get_client()
        disabled = False
        try:
            projects = client.get_projects(self.model.metadata['domain_name'])
        except ApiError:
            # TODO(LB): Disable for now. Need to decide what to do with this in the future
            # should a message be shown to the user?
            # Should we try refreshing the token? For VSTS that often clears up the problem
            project_choices = []
            disabled = True
        else:
            project_choices = [(project['id'], project['name']) for project in projects['value']]

        default_project = self.org_integration.config.get('default_project')
        initial_project = ('', '')
        if default_project is not None:
            for project_id, project_name in project_choices:
                if default_project == project_id:
                    initial_project = (project_id, project_name)
                    break

        return [
            {
                'name': 'default_project',
                'type': 'choice',
                'allowEmpty': True,
                'disabled': disabled,
                'required': True,
                'choices': project_choices,
                'initial': initial_project,
                'label': _('Default Project Name'),
                'placeholder': _('MyProject'),
                'help': _('Enter the Visual Studio Team Services project name that you wish to use as a default for new work items'),
            },
        ]


class VstsIntegrationProvider(IntegrationProvider):
    key = 'vsts'
    name = 'Visual Studio Team Services'
    metadata = metadata
    domain = '.visualstudio.com'
    api_version = '4.1'
    needs_default_identity = True
    integration_cls = VstsIntegration
    can_add_project = True

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
        ]

    def build_integration(self, state):
        data = state['identity']['data']
        account = state['identity']['account']
        instance = state['identity']['instance']

        scopes = sorted(VSTSIdentityProvider.oauth_scopes)
        return {
            'name': account['AccountName'],
            'external_id': account['AccountId'],
            'metadata': {
                'domain_name': instance,
                'scopes': scopes,
            },
            # TODO(LB): Change this to a Microsoft account as opposed to a VSTS workspace
            'user_identity': {
                'type': 'vsts',
                'external_id': account['AccountId'],
                'scopes': [],
                'data': self.get_oauth_data(data),
            },
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

    def setup(self):
        from sentry.plugins import bindings
        bindings.add(
            'integration-repository.provider',
            VstsRepositoryProvider,
            id='integrations:vsts',
        )


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
