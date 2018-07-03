from __future__ import absolute_import
from time import time
import logging

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
    logger = logging.getLogger('sentry.integrations')

    def __init__(self, *args, **kwargs):
        super(VstsIntegration, self).__init__(*args, **kwargs)
        self.default_identity = None

    def get_client(self):
        if self.default_identity is None:
            self.default_identity = self.get_default_identity()

        return VstsApiClient(self.default_identity, VstsIntegrationProvider.oauth_redirect_url)

    def get_project_config(self):
        client = self.get_client()
        instance = self.model.metadata['domain_name']

        try:
            # NOTE(lb): vsts get workitem states does not give an id.
            work_item_states = client.get_work_item_states(instance)['value']
            statuses = [(c['name'], c['name']) for c in work_item_states]
            disabled = False
        except ApiError:
            # TODO(epurkhsier): Maybe disabling the inputs for the resolve
            # statuses is a little heavy handed. Is there something better we
            # can fall back to?
            statuses = []
            disabled = True

        return [
            {
                'name': 'resolve_status',
                'type': 'choice',
                'allowEmpty': True,
                'disabled': disabled,
                'choices': statuses,
                'label': _('Visual Studio Team Services Resolved Status'),
                'placeholder': _('Select a Status'),
                'help': _('Declares what the linked Visual Studio Team Services ticket workflow status should be transitioned to when the Sentry issue is resolved.'),
            },
            {
                'name': 'resolve_when',
                'type': 'choice',
                'allowEmpty': True,
                'disabled': disabled,
                'choices': statuses,
                'label': _('Resolve in Sentry When'),
                'placeholder': _('Select a Status'),
                'help': _('When a Visual Studio Team Services ticket is transitioned to this status, trigger resolution of the Sentry issue.'),
            },
            {
                'name': 'regression_status',
                'type': 'choice',
                'allowEmpty': True,
                'disabled': disabled,
                'choices': statuses,
                'label': _('Visual Studio Team Services Regression Status'),
                'placeholder': _('Select a Status'),
                'help': _('Declares what the linked Visual Studio Team Services ticket workflow status should be transitioned to when the Sentry issue has a regression.'),
            },
            {
                'name': 'sync_comments',
                'type': 'boolean',
                'label': _('Post Comments to Visual Studio Team Services'),
                'help': _('Synchronize comments from Sentry issues to linked Visual Studio Team Services tickets.'),
            },
            {
                'name': 'sync_forward_assignment',
                'type': 'boolean',
                'label': _('Synchronize Assignment to Visual Studio Team Services'),
                'help': _('When assigning something in Sentry, the linked Visual Studio Team Services ticket will have the associated Visual Studio Team Services user assigned.'),
            },
            {
                'name': 'sync_reverse_assignment',
                'type': 'boolean',
                'label': _('Synchronize Assignment to Sentry'),
                'help': _('When assigning a user to a Linked Visual Studio Team Services ticket, the associated Sentry user will be assigned to the Sentry issue.'),
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
