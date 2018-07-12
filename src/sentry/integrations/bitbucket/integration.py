from __future__ import absolute_import

from sentry.integrations import Integration, IntegrationProvider, IntegrationMetadata
from sentry.integrations.exceptions import ApiError
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from django.utils.translation import ugettext as _
from sentry.utils.http import absolute_uri

from .repository import BitbucketRepositoryProvider
from .client import BitbucketApiClient

DESCRIPTION = """
Bitbucket for Sentry.io
"""
metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    noun=_('Account'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=Bitbucket%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/bitbucket',
    aspects={},
)
scopes = (
    'account',
    'issue:write',
    'repository',
    'team',
    'webhook',
)


class BitbucketIntegration(Integration):
    def get_client(self):
        return BitbucketApiClient(
            self.model.metadata['base_url'],
            self.model.metadata['shared_secret'],
            self.model.external_id,
        )

    def get_project_config(self):
        client = self.get_client()
        disabled = False
        try:
            repos = client.get_repos(self.model.name)
        except ApiError:
            # TODO(LB): Disable for now. Need to decide what to do with this in the future
            # should a message be shown to the user?
            # Should we try refreshing the token? For VSTS that often clears up the problem
            repo_choices = []
            disabled = True
        else:
            repo_choices = [(repo['uuid'], repo['full_name']) for repo in repos['values']]

        try:
            # TODO(LB): Will not work in the UI until the serliazer sends a `project_id` to get_installation()
            # serializers and UI are being refactored and it's not worth trying to fix
            # the old system. Revisit
            default_repo = self.project_integration.config.get('default_repo')
        except Exception:
            default_repo = None

        initial_repo = ('', '')
        if default_repo is not None:
            for repo_id, repo_name in repo_choices:
                if default_repo == repo_id:
                    initial_repo = (repo_id, repo_name)
                    break

        return [
            {
                'name': 'default_repo',
                'type': 'choice',
                'allowEmpty': True,
                'disabled': disabled,
                'required': True,
                'choices': repo_choices,
                'initial': initial_repo,
                'label': _('Default Repository Name'),
                'help': _('Enter the full name of the Bitbucket repo that you wish to use as the default for new issues'),
            },
        ]


class BitbucketIntegrationProvider(IntegrationProvider):
    key = 'bitbucket'
    name = 'Bitbucket'
    metadata = metadata
    scopes = scopes
    integration_cls = BitbucketIntegration
    can_add_project = True

    def get_pipeline_views(self):
        identity_pipeline_config = {
            'redirect_url': absolute_uri('/extensions/bitbucket/setup/'),
        }
        identity_pipeline_view = NestedPipelineView(
            bind_key='identity',
            provider_key='bitbucket',
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )
        return [identity_pipeline_view]

    def build_integration(self, state):
        # TODO(LB): Add verification for clientKey
        if state.get('publicKey'):
            principal_data = state['principal']
            return {
                'provider': 'bitbucket',
                'external_id': state['clientKey'],
                'name': principal_data['username'],
                'metadata': {
                    'public_key': state['publicKey'],
                    'shared_secret': state['sharedSecret'],
                    'base_url': state['baseApiUrl'],
                    'domain_name': principal_data['links']['html']['href'].replace('https://', ''),
                    'icon': principal_data['links']['avatar']['href'],
                    'scopes': self.scopes,
                    'uuid': principal_data['uuid'],
                    'type': principal_data['type'],  # team or user account
                },
            }
        return {
            'provider': 'bitbucket',
            'external_id': state['identity']['bitbucket_client_key'],
            'expect_exists': True,
        }

    def setup(self):
        from sentry.plugins import bindings
        bindings.add(
            'integration-repository.provider',
            BitbucketRepositoryProvider,
            id='integrations:bitbucket',
        )
