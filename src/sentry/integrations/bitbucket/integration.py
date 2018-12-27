from __future__ import absolute_import

from sentry.integrations import Integration, IntegrationFeatures, IntegrationProvider, IntegrationMetadata
from sentry.integrations.repositories import RepositoryMixin
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from django.utils.translation import ugettext_lazy as _

from sentry.models import Repository
from sentry.utils.http import absolute_uri

from .repository import BitbucketRepositoryProvider
from .client import BitbucketApiClient
from .issues import BitbucketIssueBasicMixin

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
    'repository:admin',
    'team',
    'webhook',
)


class BitbucketIntegration(Integration, BitbucketIssueBasicMixin, RepositoryMixin):
    def get_client(self):
        return BitbucketApiClient(
            self.model.metadata['base_url'],
            self.model.metadata['shared_secret'],
            self.model.external_id,
        )

    @property
    def username(self):
        return self.model.name

    def get_repositories(self):
        repos = self.get_client().get_repos(self.username)['values']
        data = []
        for repo in repos:
            data.append(
                {
                    'identifier': repo['full_name'],
                    'name': repo['full_name'],
                }
            )
        return data

    def get_unmigratable_repositories(self):
        repos = Repository.objects.filter(
            organization_id=self.organization_id,
            provider='bitbucket',
        )

        accessible_repos = [
            r['identifier'] for r in self.get_repositories()
        ]

        return filter(
            lambda repo: repo.name not in accessible_repos,
            repos,
        )

    def reinstall(self):
        self.reinstall_repositories()


class BitbucketIntegrationProvider(IntegrationProvider):
    key = 'bitbucket'
    name = 'Bitbucket'
    metadata = metadata
    scopes = scopes
    integration_cls = BitbucketIntegration
    features = frozenset([IntegrationFeatures.ISSUE_BASIC, IntegrationFeatures.COMMITS])

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

    def post_install(self, integration, organization):
        repos = Repository.objects.filter(
            organization_id=organization.id,
            provider='bitbucket',
        )

        unmigrateable_repos = self \
            .get_installation(integration, organization.id) \
            .get_unmigratable_repositories()

        for repo in filter(lambda r: r not in unmigrateable_repos, repos):
            repo.update(integration_id=integration.id)

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
