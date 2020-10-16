from __future__ import absolute_import

from datetime import datetime

from sentry.integrations.github.utils import get_jwt
from sentry.integrations.client import ApiClient
from sentry.shared_integrations.exceptions import ApiError
from sentry.web.decorators import transaction_start


class GitHubClientMixin(ApiClient):
    allow_redirects = True

    base_url = "https://api.github.com"
    integration_name = "github"

    def get_jwt(self):
        return get_jwt()

    def get_last_commits(self, repo, end_sha):
        # return api request that fetches last ~30 commits
        # see https://developer.github.com/v3/repos/commits/#list-commits-on-a-repository
        # using end_sha as parameter
        return self.get_cached(u"/repos/{}/commits".format(repo), params={"sha": end_sha})

    def compare_commits(self, repo, start_sha, end_sha):
        # see https://developer.github.com/v3/repos/commits/#compare-two-commits
        # where start sha is oldest and end is most recent
        return self.get_cached(u"/repos/{}/compare/{}...{}".format(repo, start_sha, end_sha))

    def repo_hooks(self, repo):
        return self.get(u"/repos/{}/hooks".format(repo))

    def get_commits(self, repo):
        return self.get(u"/repos/{}/commits".format(repo))

    def get_commit(self, repo, sha):
        return self.get_cached(u"/repos/{}/commits/{}".format(repo, sha))

    def get_repo(self, repo):
        return self.get(u"/repos/{}".format(repo))

    def get_repositories(self):
        repositories = self.get("/installation/repositories", params={"per_page": 100})
        repos = repositories["repositories"]
        return [repo for repo in repos if not repo.get("archived")]

    def search_repositories(self, query):
        return self.get("/search/repositories", params={"q": query})

    def get_assignees(self, repo):
        return self.get(u"/repos/{}/assignees".format(repo))

    def get_issues(self, repo):
        return self.get(u"/repos/{}/issues".format(repo))

    def search_issues(self, query):
        return self.get("/search/issues", params={"q": query})

    def get_issue(self, repo, number):
        return self.get(u"/repos/{}/issues/{}".format(repo, number))

    def create_issue(self, repo, data):
        endpoint = u"/repos/{}/issues".format(repo)
        return self.post(endpoint, data=data)

    def create_comment(self, repo, issue_id, data):
        endpoint = u"/repos/{}/issues/{}/comments".format(repo, issue_id)
        return self.post(endpoint, data=data)

    def get_user(self, gh_username):
        return self.get(u"/users/{}".format(gh_username))

    def request(self, method, path, headers=None, data=None, params=None):
        if headers is None:
            headers = {
                "Authorization": "token %s" % self.get_token(),
                # TODO(jess): remove this whenever it's out of preview
                "Accept": "application/vnd.github.machine-man-preview+json",
            }
        return self._request(method, path, headers=headers, data=data, params=params)

    def get_token(self, force_refresh=False):
        """
        Get token retrieves the active access token from the integration model.
        Should the token have expired, a new token will be generated and
        automatically persisted into the integration.
        """
        token = self.integration.metadata.get("access_token")
        expires_at = self.integration.metadata.get("expires_at")

        if expires_at is not None:
            expires_at = datetime.strptime(expires_at, "%Y-%m-%dT%H:%M:%S")

        if not token or expires_at < datetime.utcnow() or force_refresh:
            res = self.create_token()
            token = res["token"]
            expires_at = datetime.strptime(res["expires_at"], "%Y-%m-%dT%H:%M:%SZ")

            self.integration.metadata.update(
                {"access_token": token, "expires_at": expires_at.isoformat()}
            )
            self.integration.save()

        return token

    def create_token(self):
        return self.post(
            u"/app/installations/{}/access_tokens".format(self.integration.external_id),
            headers={
                "Authorization": "Bearer %s" % self.get_jwt(),
                # TODO(jess): remove this whenever it's out of preview
                "Accept": "application/vnd.github.machine-man-preview+json",
            },
        )

    @transaction_start("GitHubClientMixin")
    def check_source_code_link(self, path):
        self.allow_text = True
        try:
            return self.head_cached(path=path).status_code
        except ApiError as e:
            return e.code


class GitHubAppsClient(GitHubClientMixin):
    def __init__(self, integration):
        self.integration = integration
        super(GitHubAppsClient, self).__init__()
