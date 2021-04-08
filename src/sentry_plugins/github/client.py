import calendar
import datetime
import time

import jwt

from sentry import options
from sentry_plugins.client import ApiClient, AuthApiClient


class GitHubClientMixin(AuthApiClient):
    allow_redirects = True

    base_url = "https://api.github.com"
    plugin_name = "github"

    def get_last_commits(self, repo, end_sha):
        # return api request that fetches last ~30 commits
        # see https://developer.github.com/v3/repos/commits/#list-commits-on-a-repository
        # using end_sha as parameter
        return self.get(f"/repos/{repo}/commits", params={"sha": end_sha})

    def compare_commits(self, repo, start_sha, end_sha):
        # see https://developer.github.com/v3/repos/commits/#compare-two-commits
        # where start sha is oldest and end is most recent
        return self.get(f"/repos/{repo}/compare/{start_sha}...{end_sha}")

    def get_pr_commits(self, repo, num):
        # see https://developer.github.com/v3/pulls/#list-commits-on-a-pull-request
        # Max: 250 Commits
        return self.get(f"/repos/{repo}/pulls/{num}/commits")


class GitHubClient(GitHubClientMixin, AuthApiClient):
    def __init__(self, url=None, auth=None):
        if url is not None:
            self.base_url = url.rstrip("/")
        super().__init__(auth=auth)

    def request_no_auth(self, method, path, data=None, params=None):
        if params is None:
            params = {}

        return self._request(method, path, auth=None, data=data, params=params)

    def get_repo(self, repo):
        return self.get(f"/repos/{repo}")

    def get_issue(self, repo, issue_id):
        return self.get(f"/repos/{repo}/issues/{issue_id}")

    def create_issue(self, repo, data):
        return self.post(f"/repos/{repo}/issues", data=data)

    def create_comment(self, repo, issue_id, data):
        return self.post(f"/repos/{repo}/issues/{issue_id}/comments", data=data)

    def list_assignees(self, repo):
        return self.get(f"/repos/{repo}/assignees?per_page=100")

    def search_issues(self, query):
        return self.get("/search/issues", params={"q": query})

    def create_hook(self, repo, data):
        return self.post(f"/repos/{repo}/hooks", data=data)

    def update_hook(self, repo, hook_id, data):
        return self.patch(f"/repos/{repo}/hooks/{hook_id}", data=data)

    def delete_hook(self, repo, id):
        return self.delete(f"/repos/{repo}/hooks/{id}")

    def get_installations(self):
        # TODO(jess): remove this whenever it's out of preview
        headers = {"Accept": "application/vnd.github.machine-man-preview+json"}

        return self._request("GET", "/user/installations", headers=headers)


class GitHubAppsClient(GitHubClientMixin, ApiClient):
    def __init__(self, integration):
        self.integration = integration
        self.token = None
        self.expires_at = None
        super().__init__()

    def get_token(self):
        if not self.token or self.expires_at < datetime.datetime.utcnow():
            res = self.create_token()
            self.token = res["token"]
            self.expires_at = datetime.datetime.strptime(res["expires_at"], "%Y-%m-%dT%H:%M:%SZ")

        return self.token

    def get_jwt(self):
        exp = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
        exp = calendar.timegm(exp.timetuple())
        # Generate the JWT
        payload = {
            # issued at time
            "iat": int(time.time()),
            # JWT expiration time (10 minute maximum)
            "exp": exp,
            # Integration's GitHub identifier
            "iss": options.get("github.integration-app-id"),
        }

        return jwt.encode(payload, options.get("github.integration-private-key"), algorithm="RS256")

    def request(self, method, path, headers=None, data=None, params=None):
        if headers is None:
            headers = {
                "Authorization": "token %s" % self.get_token(),
                # TODO(jess): remove this whenever it's out of preview
                "Accept": "application/vnd.github.machine-man-preview+json",
            }
        return self._request(method, path, headers=headers, data=data, params=params)

    def create_token(self):
        return self.post(
            f"/app/installations/{self.integration.external_id}/access_tokens",
            headers={
                "Authorization": b"Bearer %s" % self.get_jwt(),
                # TODO(jess): remove this whenever it's out of preview
                "Accept": "application/vnd.github.machine-man-preview+json",
            },
        )

    def get_repositories(self):
        return self.get("/installation/repositories")
