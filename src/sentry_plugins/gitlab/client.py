from __future__ import absolute_import

from six.moves.urllib.parse import quote
from sentry_plugins.client import ApiClient

from sentry.shared_integrations.exceptions import ApiError


class GitLabClient(ApiClient):
    allow_redirects = False
    plugin_name = "gitlab"

    def __init__(self, url, token):
        super(GitLabClient, self).__init__()
        self.base_url = url
        self.token = token

    def build_url(self, path):
        return "{}/api/v4/{}".format(self.base_url, path.lstrip("/"))

    def request(self, method, path, data=None, params=None):
        headers = {"Private-Token": self.token}
        return self._request(method, path, headers=headers, params=params, data=data)

    def auth(self):
        return self.request("GET", "/user")

    def get_project(self, repo):
        return self.request("GET", "/projects/{}".format(quote(repo, safe="")))

    def get_issue(self, repo, issue_id):
        try:
            return self.request(
                "GET", "/projects/{}/issues/{}".format(quote(repo, safe=""), issue_id)
            )
        except IndexError:
            raise ApiError("Issue not found with ID", 404)

    def create_issue(self, repo, data):
        return self.request("POST", "/projects/{}/issues".format(quote(repo, safe="")), data=data)

    def create_note(self, repo, issue_iid, data):
        return self.request(
            "POST",
            "/projects/{}/issues/{}/notes".format(quote(repo, safe=""), issue_iid),
            data=data,
        )

    def list_project_members(self, repo):
        return self.request(
            "GET", "/projects/{}/members/all/?per_page=100".format(quote(repo, safe=""))
        )
