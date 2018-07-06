from __future__ import absolute_import

from django.utils.translation import ugettext_lazy as _

from sentry import http, options
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.identity.github import get_user_info
from sentry.integrations import Integration, IntegrationFeatures, IntegrationProvider, IntegrationMetadata
from sentry.integrations.exceptions import ApiError
from sentry.integrations.constants import ERR_INTERNAL, ERR_UNAUTHORIZED
from sentry.integrations.repositories import RepositoryMixin
from sentry.pipeline import NestedPipelineView, PipelineView
from sentry.utils.http import absolute_uri

from .client import GitHubAppsClient
from .issues import GitHubIssueBasic
from .repository import GitHubRepositoryProvider
from .utils import get_jwt


DESCRIPTION = """
Define a relationship between Sentry and GitHub.

 * Authorize repositories to be added for syncing commit data.
 * Create or link existing GitHub issues. (coming soon)
"""
disable_dialog = {
    'actionText': 'Visit GitHub',
    'body': 'Before deleting this integration, you must uninstall this integration from GitHub. After uninstalling, your integration will be disabled at which point you can choose to delete this integration.'
}

removal_dialog = {
    'actionText': 'Delete',
    'body': 'Deleting this integration will delete all associated repositories and commit data. This action cannot be undone. Are you sure you want to delete your integration?'
}

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    noun=_('Installation'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=GitHub%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/github',
    aspects={
        'disable_dialog': disable_dialog,
        'removal_dialog': removal_dialog,
    },
)

API_ERRORS = {
    404: 'GitHub returned a 404 Not Found error. If this repository exists, ensure'
         ' that your installation has permission to access this repository'
         ' (https://github.com/settings/installations).',
    401: ERR_UNAUTHORIZED,
}


class GitHubIntegration(Integration, GitHubIssueBasic, RepositoryMixin):

    def get_client(self):
        return GitHubAppsClient(external_id=self.model.external_id)

    def get_repositories(self):
        return self.get_client().get_repositories()

    def reinstall(self):
        self.reinstall_repositories()

    def message_from_error(self, exc):
        if isinstance(exc, ApiError):
            message = API_ERRORS.get(exc.code)
            if message:
                return message
            return (
                'Error Communicating with GitHub (HTTP %s): %s' % (
                    exc.code, exc.json.get('message', 'unknown error')
                    if exc.json else 'unknown error',
                )
            )
        else:
            return ERR_INTERNAL


class GitHubIntegrationProvider(IntegrationProvider):
    key = 'github'
    name = 'GitHub'
    metadata = metadata
    integration_cls = GitHubIntegration
    features = frozenset([
        IntegrationFeatures.COMMITS,
        IntegrationFeatures.ISSUE_BASIC,
    ])

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

        integration = {
            'name': installation['account']['login'],
            # TODO(adhiraj): This should be a constant representing the entire github cloud.
            'external_id': installation['id'],
            # GitHub identity is associated directly to the application, *not*
            # to the installation itself.
            'idp_external_id': installation['app_id'],
            'metadata': {
                # The access token will be populated upon API usage
                'access_token': None,
                'expires_at': None,
                'icon': installation['account']['avatar_url'],
                'domain_name': installation['account']['html_url'].replace('https://', ''),
                'account_type': installation['account']['type'],
            },
            'user_identity': {
                'type': 'github',
                'external_id': user['id'],
                'scopes': [],  # GitHub apps do not have user scopes
                'data': {'access_token': identity['access_token']},
            },
        }

        if state.get('reinstall_id'):
            integration['reinstall_id'] = state['reinstall_id']

        return integration

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
        if 'reinstall_id' in request.GET:
            pipeline.bind_state('reinstall_id', request.GET['reinstall_id'])

        if 'installation_id' in request.GET:
            pipeline.bind_state('installation_id', request.GET['installation_id'])
            return pipeline.next_step()

        return self.redirect(self.get_app_url())
