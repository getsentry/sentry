from __future__ import absolute_import

from sentry.integrations import IntegrationProvider, IntegrationMetadata
from sentry.integrations.bitbucket.client import BitbucketClient
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from django.utils.translation import ugettext_lazy as _
from sentry.utils.http import absolute_uri
from sentry.models import Integration

DESCRIPTION = """
Bitbucket for Sentry.io
"""
metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    noun=_('Bitbucket Account'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=Bitbucket%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/bitbucket',
    aspects={},
)


class BitbucketIntegration(Integration):
    # TODO(LB): What should be in an Integration?
    def get_client(self):
        # TODO(LB): what happens if this is called and the plugin is not configured?
        return BitbucketClient(
            self.model.metadata['base_url'],
            self.model.metadata['shared_secret'],
        )

    def link_issue(self, request, group, form_data, **kwargs):
        client = self.get_client(request.user)
        repo = self.get_option('repo', group.project)
        try:
            issue = client.get_issue(
                repo=repo,
                issue_id=form_data['issue_id'],
            )
        except Exception as e:
            self.raise_error(e, identity=client.auth)

        comment = form_data.get('comment')
        if comment:
            try:
                client.create_comment(repo, issue['local_id'], {'content': comment})
            except Exception as e:
                self.raise_error(e, identity=client.auth)

        return {'title': issue['title']}

    def create_issue(self, request, group, form_data, **kwargs):
        client = self.get_client(request.user)

        try:
            response = client.create_issue(
                repo=self.get_option('repo', group.project), data=form_data
            )
        except Exception as e:
            self.raise_error(e, identity=client.auth)

        return response['local_id']


class BitbucketIntegrationProvider(IntegrationProvider):
    key = 'bitbucket'
    name = 'Bitbucket'
    metadata = metadata

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
            user_data = state['user']
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
                },
                'user_identity': {
                    'type': 'bitbucket',
                    'name': user_data['username'],
                    'display_name': user_data['display_name'],
                    'external_id': user_data['uuid'],
                    'icon': user_data['links']['avatar']['href'],
                }
            }

        integration = Integration.objects.get(
            provider='bitbucket',
            external_id=state['identity']['bitbucket_client_key']
        )
        return {
            'provider': 'bitbucket',
            'external_id': integration.external_id,
            'name': integration.name,
            'metadata': {
                'public_key': integration.metadata['public_key'],
                'shared_secret': integration.metadata['shared_secret'],
                'base_url': integration.metadata['base_url'],
                'domain_name': integration.metadata['domain_name'],
            },
        }
