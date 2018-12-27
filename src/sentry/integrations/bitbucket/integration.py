from __future__ import absolute_import

from sentry.integrations import (
    IntegrationInstallation, IntegrationFeatures, IntegrationProvider,
    IntegrationMetadata, FeatureDescription,
)
from sentry.integrations.atlassian_connect import AtlassianConnectValidationError, get_integration_from_request
from sentry.integrations.repositories import RepositoryMixin
from sentry.pipeline import NestedPipelineView, PipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from django.utils.translation import ugettext_lazy as _

from sentry.integrations.exceptions import ApiError
from sentry.models import Repository
from sentry.tasks.integrations import migrate_repo
from sentry.utils.http import absolute_uri

from .repository import BitbucketRepositoryProvider
from .client import BitbucketApiClient
from .issues import BitbucketIssueBasicMixin

DESCRIPTION = """
Connect your Sentry organization to Bitbucket, enabling the following features:
"""

FEATURES = [
    FeatureDescription(
        """
        Track commits and releases (learn more
        [here](https://docs.sentry.io/learn/releases/))
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Resolve Sentry issues via Bitbucket commits by
        including `Fixes PROJ-ID` in the message
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Create Bitbucket issues from Sentry
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
    FeatureDescription(
        """
        Link Sentry issues to existing Bitbucket issues
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author='The Sentry Team',
    noun=_('Installation'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=Bitbucket%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/bitbucket',
    aspects={},
)
scopes = (
    'account',
    'email',
    'issue:write',
    'pullrequest',
    'repository',
    'repository:admin',
    'team',
    'webhook',
)


class BitbucketIntegration(IntegrationInstallation, BitbucketIssueBasicMixin, RepositoryMixin):
    repo_search = True

    def get_client(self):
        return BitbucketApiClient(
            self.model.metadata['base_url'],
            self.model.metadata['shared_secret'],
            self.model.external_id,
        )

    @property
    def username(self):
        return self.model.name

    def error_message_from_json(self, data):
        return data.get('error', {}).get('message', 'unknown error')

    def get_repositories(self, query=None):
        if not query:
            resp = self.get_client().get_repos(self.username)
            return [{
                'identifier': repo['full_name'],
                'name': repo['full_name'],
            } for repo in resp.get('values', [])]

        full_query = (u'name~"%s"' % (query)).encode('utf-8')
        resp = self.get_client().search_repositories(self.username, full_query)
        return [{
            'identifier': i['full_name'],
            'name': i['full_name']
        } for i in resp.get('values', [])]

    def has_repo_access(self, repo):
        client = self.get_client()
        try:
            client.get_hooks(repo.config['name'])
        except ApiError:
            return False
        return True

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
        return [identity_pipeline_view, VerifyInstallation()]

    def post_install(self, integration, organization):
        repo_ids = Repository.objects.filter(
            organization_id=organization.id,
            provider__in=['bitbucket', 'integrations:bitbucket'],
            integration_id__isnull=True,
        ).values_list('id', flat=True)

        for repo_id in repo_ids:
            migrate_repo.apply_async(kwargs={
                'repo_id': repo_id,
                'integration_id': integration.id,
                'organization_id': organization.id,
            })

    def build_integration(self, state):
        if state.get('publicKey'):
            principal_data = state['principal']

            domain = principal_data['links']['html']['href'] \
                .replace('https://', '') \
                .rstrip('/')

            return {
                'provider': self.key,
                'external_id': state['clientKey'],
                'name': principal_data['username'],
                'metadata': {
                    'public_key': state['publicKey'],
                    'shared_secret': state['sharedSecret'],
                    'base_url': state['baseApiUrl'],
                    'domain_name': domain,
                    'icon': principal_data['links']['avatar']['href'],
                    'scopes': self.scopes,
                    'uuid': principal_data['uuid'],
                    'type': principal_data['type'],  # team or user account
                },
            }
        else:
            return {
                'provider': self.key,
                'external_id': state['external_id'],
                'expect_exists': True,
            }

    def setup(self):
        from sentry.plugins import bindings
        bindings.add(
            'integration-repository.provider',
            BitbucketRepositoryProvider,
            id='integrations:%s' % self.key,
        )


class VerifyInstallation(PipelineView):
    def dispatch(self, request, pipeline):
        try:
            integration = get_integration_from_request(request, BitbucketIntegrationProvider.key)
        except AtlassianConnectValidationError:
            return pipeline.error('Unable to verify installation.')
        pipeline.bind_state('external_id', integration.external_id)
        return pipeline.next_step()
