from __future__ import absolute_import

from six.moves.urllib.parse import quote

from sentry.integrations.client import ApiClient, OAuth2RefreshMixin
from sentry.integrations.exceptions import ApiError

API_VERSION = '/api/v4'


def build_api_url(base_url, api, path):
    return u'{base_url}{api}{path}'.format(
        base_url=base_url,
        api=api,
        path=path,
    )


class GitLabApiClientPath(object):
    issue = u'/projects/{project}/issues/{issue}'
    issues = u'/projects/{project}/issues'
    members = u'/projects/{project}/members'
    notes = u'/projects/{project}/issues/{issue}/notes'
    project = u'/projects/{project}'
    user = u'/user'


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

    def request(self, method, path, data=None, params=None, api_preview=False):
        # TODO(lb): Refresh auth
        # self.check_auth(redirect_url=self.oauth_redirect_url)
        access_token = self.identity.data['access_token']
        headers = {
            'Authorization': u'Bearer {}'.format(access_token)
        }
        return self._request(
            method,
            build_api_url(
                self.metadata['base_url'],
                API_VERSION,
                path
            ),
            headers=headers, data=data, params=params
        )

    def get_user(self):
        return self.get(GitLabApiClientPath.user)

    def get_project(self, project):
        return self.get(
            GitLabApiClientPath.project.format(
                project=quote(project, safe='')
            )
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
