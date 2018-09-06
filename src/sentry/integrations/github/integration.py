from __future__ import absolute_import

from django.utils.translation import ugettext_lazy as _

from sentry import http, options
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.identity.github import get_user_info
from sentry.integrations import Integration, IntegrationFeatures, IntegrationProvider, IntegrationMetadata
from sentry.integrations.exceptions import ApiError
from sentry.integrations.constants import ERR_INTERNAL, ERR_UNAUTHORIZED
from sentry.integrations.repositories import RepositoryMixin
from sentry.models import Repository
from sentry.pipeline import NestedPipelineView, PipelineView
from sentry.tasks.integrations import migrate_repo
from sentry.utils.http import absolute_uri

from .client import GitHubAppsClient
from .issues import GitHubIssueBasic
from .repository import GitHubRepositoryProvider
from .utils import get_jwt


DESCRIPTION = """
Connect your Sentry organization into your GitHub organization or user account.
Take a step towards augmenting your sentry issues with commits from your
repositories ([using releases](https://docs.sentry.io/learn/releases/)) and
linking up your GitHub issues and pull requests directly to issues in Sentry.

 * Create and link Sentry issue groups directly to a GitHub issue or pull
   request in any of your repositories, providing a quick way to jump from
   Sentry bug to tracked issue or PR!

 * Authorize repositories to be added to your Sentry organization to augmenting
   sentry issues with commit data with [deployment
   tracking](https://docs.sentry.io/learn/releases/).
"""
disable_dialog = {
    'actionText': 'Visit GitHub',
    'body': 'Before deleting this integration, you must uninstall this'
            ' integration from GitHub. After uninstalling, your integration will'
            ' be disabled at which point you can choose to delete this'
            ' integration.',
}

removal_dialog = {
    'actionText': 'Delete',
    'body': 'Deleting this integration will delete all associated repositories'
            ' and commit data. This action cannot be undone. Are you sure you'
            ' want to delete your integration?',
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
    repo_search = True

    def get_client(self):
        return GitHubAppsClient(integration=self.model)

    def get_repositories(self, query=None):
        if not query:
            return [{
                'name': i['name'],
                'identifier': i['full_name']
            } for i in self.get_client().get_repositories()]

        account_type = 'user' if self.model.metadata['account_type'] == 'User' else 'org'
        full_query = (u'%s:%s %s' % (account_type, self.model.name, query)).encode('utf-8')
        response = self.get_client().search_repositories(full_query)
        return [{
            'name': i['name'],
            'identifier': i['full_name']
        } for i in response.get('items', [])]

    def search_issues(self, query):
        return self.get_client().search_issues(query)

    def get_unmigratable_repositories(self):
        accessible_repos = self.get_repositories()
        accessible_repo_names = [r['identifier'] for r in accessible_repos]

        existing_repos = Repository.objects.filter(
            organization_id=self.organization_id,
            provider='github',
        )

        return filter(
            lambda repo: repo.name not in accessible_repo_names,
            existing_repos,
        )

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

    def has_repo_access(self, repo):
        client = self.get_client()
        try:
            # make sure installation has access to this specific repo
            # use hooks endpoint since we explicity ask for those permissions
            # when installing the app (commits can be accessed for public repos)
            # https://developer.github.com/v3/repos/hooks/#list-hooks
            client.repo_hooks(repo.config['name'])
        except ApiError:
            return False
        return True


class GitHubIntegrationProvider(IntegrationProvider):
    key = 'github'
    name = 'GitHub'
    metadata = metadata
    integration_cls = GitHubIntegration
    features = frozenset([
        IntegrationFeatures.COMMITS,
        IntegrationFeatures.ISSUE_BASIC,
    ])

    can_disable = True

    setup_dialog_config = {
        'width': 1030,
        'height': 1000,
    }

    def post_install(self, integration, organization):
        repo_ids = Repository.objects.filter(
            organization_id=organization.id,
            provider='github',
        ).values_list('id', flat=True)

        for repo_id in repo_ids:
            migrate_repo.apply_async(kwargs={
                'repo_id': repo_id,
                'integration_id': integration.id,
                'organization_id': organization.id,
            })

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
