from __future__ import absolute_import

from six.moves.urllib.parse import quote

from sentry.integrations.client import ApiClient, OAuth2RefreshMixin
from sentry.integrations.exceptions import ApiError
from sentry.utils.http import absolute_uri


API_VERSION = u'/api/v4'


class GitLabApiClientPath(object):
    group = u'/groups/{group}'
    group_projects = u'/groups/{group}/projects'
    hooks = u'/hooks'
    issue = u'/projects/{project}/issues/{issue}'
    issues = u'/projects/{project}/issues'
    issues_search = u'/issues'
    members = u'/projects/{project}/members'
    notes = u'/projects/{project}/issues/{issue}/notes'
    project = u'/projects/{project}'
    project_hooks = u'/projects/{project}/hooks'
    project_hook = u'/projects/{project}/hooks/{hook_id}'
    projects = u'/projects'
    user = u'/user'

    @staticmethod
    def build_api_url(base_url, path):
        return u'{base_url}{api}{path}'.format(
            base_url=base_url,
            api=API_VERSION,
            path=path,
        )


class GitLabSetupClient(ApiClient):
    """
    API Client that doesn't require an installation.
    This client is used during integration setup to fetch data
    needed to build installation metadata
    """

    def __init__(self, base_url, access_token, verify_ssl):
        self.base_url = base_url
        self.token = access_token
        self.verify_ssl = verify_ssl

    def get_group(self, group):
        path = GitLabApiClientPath.group.format(group=group)
        return self.get(path)

    def request(self, method, path, data=None, params=None):
        headers = {
            'Authorization': u'Bearer {}'.format(self.token)
        }
        return self._request(
            method,
            GitLabApiClientPath.build_api_url(self.base_url, path),
            headers=headers,
            data=data,
            params=params
        )


class GitLabApiClient(ApiClient, OAuth2RefreshMixin):

    def __init__(self, installation):
        self.installation = installation
        verify_ssl = self.metadata['verify_ssl']
        super(GitLabApiClient, self).__init__(verify_ssl)

    @property
    def identity(self):
        return self.installation.default_identity

    @property
    def metadata(self):
        return self.installation.model.metadata

    def request(self, method, path, data=None, params=None):
        # TODO(lb): Refresh auth
        # self.check_auth(redirect_url=self.oauth_redirect_url)
        access_token = self.identity.data['access_token']
        headers = {
            'Authorization': u'Bearer {}'.format(access_token)
        }
        return self._request(
            method,
            GitLabApiClientPath.build_api_url(
                self.metadata['base_url'],
                path
            ),
            headers=headers, data=data, params=params
        )

    def get_user(self):
        return self.get(GitLabApiClientPath.user)

    def get_group_projects(self, group, query=None, simple=True):
        # simple param returns limited fields for the project.
        # Really useful, because we often don't need most of the project information
        return self.get(
            GitLabApiClientPath.group_projects.format(
                group=group,
            ),
            params={
                'search': query,
                'simple': simple,
            }
        )

    def get_project(self, project):
        return self.get(
            GitLabApiClientPath.project.format(
                project=quote(project, safe='')
            )
        )

    def get_projects(self, query, simple=True):
        # simple param returns limited fields for the project.
        # Really useful, because we often don't need most of the project information
        return self.get(
            GitLabApiClientPath.projects,
            params={
                'search': query,
                'simple': simple,
            }
        )

    def get_issue(self, project, issue_id):
        try:
            return self.get(
                GitLabApiClientPath.issue.format(
                    project=quote(project, safe=''),
                    issue=issue_id
                )
            )
        except IndexError:
            raise ApiError('Issue not found with ID', 404)

    def create_issue(self, project, data):
        return self.post(
            GitLabApiClientPath.issues.format(
                project=quote(project, safe='')
            ),
            data=data,
        )

    def search_issues(self, query):
        return self.get(
            GitLabApiClientPath.issues_search,
            params={
                'scope': 'all',
                'search': query
            }
        )

    def create_note(self, project, issue_iid, data):
        return self.post(
            GitLabApiClientPath.notes.format(
                project=quote(project, safe=''),
                issue=issue_iid,
            ),
            data=data,
        )

    def list_project_members(self, project):
        return self.get(
            GitLabApiClientPath.members.format(
                project=quote(project, safe='')
            ),
        )

    def create_project_webhook(self, project):
        path = GitLabApiClientPath.project_hooks.format(
            project=quote(project, safe=''))
        data = {
            'url': absolute_uri('/extensions/gitlab/webhooks/'),
            'token': self.metadata['webhook_secret'],
            'merge_requests_events': True,
            'push_events': True,
            'enable_ssl_verification': self.metadata['verify_ssl'],
        }
        resp = self.post(path, data)

        return resp['id']

    def delete_project_webhook(self, project, hook_id):
        path = GitLabApiClientPath.project_hook.format(
            project=quote(project, safe=''),
            hook_id=hook_id)
        self.delete(path)
