from __future__ import absolute_import

from django.utils.translation import ugettext_lazy as _

from sentry import http, options
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.identity.github import get_user_info
from sentry.integrations import Integration, IntegrationProvider, IntegrationMetadata
from sentry.pipeline import NestedPipelineView, PipelineView
from sentry.utils.http import absolute_uri

from .client import GitHubAppsClient
from .repository import GitHubRepositoryProvider
from .utils import get_jwt


DESCRIPTION = """
    Fill me out
"""


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    noun=_('Installation'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=GitHub%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/github',
    aspects={}
)


class GitHubIntegration(Integration):

    def get_client(self):
        return GitHubAppsClient(external_id=self.model.external_id)


class GitHubIntegrationProvider(IntegrationProvider):
    key = 'github'
    name = 'GitHub'
    metadata = metadata
    integration_cls = GitHubIntegration

    setup_dialog_config = {
        'width': 1030,
        'height': 1000,
    }

    def get_pipeline_views(self):
        identity_pipeline_config = {
            'oauth_scopes': (),
            'redirect_url': absolute_uri('/extensions/github/setup/'),
        }

        identity_pipeline_view = NestedPipelineView(
            bind_key='identity',
            provider_key='github',
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [GitHubInstallationRedirect(), identity_pipeline_view]

    def get_installation_info(self, access_token, installation_id):
        session = http.build_session()
        resp = session.get(
            'https://api.github.com/app/installations/%s' % installation_id,
            headers={
                'Authorization': 'Bearer %s' % get_jwt(),
                'Accept': 'application/vnd.github.machine-man-preview+json',
            }
        )
        resp.raise_for_status()
        installation_resp = resp.json()

        resp = session.get(
            'https://api.github.com/user/installations',
            params={'access_token': access_token},
            headers={'Accept': 'application/vnd.github.machine-man-preview+json'}
        )
        resp.raise_for_status()
        user_installations_resp = resp.json()

        # verify that user actually has access to the installation
        for installation in user_installations_resp['installations']:
            if installation['id'] == installation_resp['id']:
                return installation_resp

        return None

    def build_integration(self, state):
        identity = state['identity']['data']

        user = get_user_info(identity['access_token'])
        installation = self.get_installation_info(
            identity['access_token'], state['installation_id'])

        return {
            'name': installation['account']['login'],
            'external_id': installation['id'],
            'metadata': {
                # The access token will be populated upon API usage
                'access_token': None,
                'expires_at': None,
                'icon': installation['account']['avatar_url'],
                'domain_name': installation['account']['html_url'].replace('https://', ''),
            },
            'user_identity': {
                'type': 'github',
                'external_id': user['id'],
                'scopes': [],  # GitHub apps do not have user scopes
                'data': {'access_token': identity['access_token']},
            },
        }

    def setup(self):
        from sentry.plugins import bindings
        bindings.add(
            'integration-repository.provider',
            GitHubRepositoryProvider,
            id='integrations:github',
        )


class GitHubInstallationRedirect(PipelineView):
    def get_app_url(self):
        name = options.get('github-app.name')
        return 'https://github.com/apps/%s' % name

    def dispatch(self, request, pipeline):
        if 'installation_id' in request.GET:
            pipeline.bind_state('installation_id', request.GET['installation_id'])
            return pipeline.next_step()

        return self.redirect(self.get_app_url())
