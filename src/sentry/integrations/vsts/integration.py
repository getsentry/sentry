from __future__ import absolute_import
from time import time

from django.utils.translation import ugettext as _

from sentry.integrations import Integration, IntegrationFeatures, IntegrationProvider, IntegrationMetadata
from sentry.integrations.exceptions import ApiError
from sentry.integrations.vsts.issues import VstsIssueSync
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.identity.vsts import VSTSIdentityProvider
from sentry.utils.http import absolute_uri
from .client import VstsApiClient
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


class VstsIntegration(Integration, VstsIssueSync):
    def __init__(self, *args, **kwargs):
        super(VstsIntegration, self).__init__(*args, **kwargs)
        self.default_identity = None

    def get_client(self):
        if self.default_identity is None:
            self.default_identity = self.get_default_identity()

        return VstsApiClient(self.default_identity, VstsIntegrationProvider.oauth_redirect_url)

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

        try:
            # TODO(LB): Will not work in the UI until the serliazer sends a `project_id` to get_installation()
            # serializers and UI are being refactored and it's not worth trying to fix
            # the old system. Revisit
            default_project = self.project_integration.config.get('default_project')
        except Exception:
            default_project = None

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

    @property
    def instance(self):
        return self.model.metadata['domain_name']

    @property
    def default_project(self):
        try:
            return self.model.metadata['default_project']
        except KeyError:
            return None

    def create_comment(self, issue_id, comment):
        self.get_client().update_work_item(self.instance, issue_id, comment=comment)


class VstsIntegrationProvider(IntegrationProvider):
    key = 'vsts'
    name = 'Visual Studio Team Services'
    metadata = metadata
    domain = '.visualstudio.com'
    api_version = '4.1'
    oauth_redirect_url = '/extensions/vsts/setup/'
    needs_default_identity = True
    integration_cls = VstsIntegration
    can_add_project = True
    features = frozenset([IntegrationFeatures.ISSUE_SYNC])

    setup_dialog_config = {
        'width': 600,
        'height': 800,
    }

    def get_pipeline_views(self):
        identity_pipeline_config = {
            'redirect_url': absolute_uri(self.oauth_redirect_url),
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
