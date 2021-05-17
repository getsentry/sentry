from datetime import datetime

import sentry_sdk

from sentry.integrations.client import ApiClient
from sentry.integrations.github.utils import get_jwt


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
        return self.get_cached(f"/repos/{repo}/commits", params={"sha": end_sha})

    def compare_commits(self, repo, start_sha, end_sha):
        # see https://developer.github.com/v3/repos/commits/#compare-two-commits
        # where start sha is oldest and end is most recent
        return self.get_cached(f"/repos/{repo}/compare/{start_sha}...{end_sha}")

    def repo_hooks(self, repo):
        return self.get(f"/repos/{repo}/hooks")

    def get_commits(self, repo):
        return self.get(f"/repos/{repo}/commits")

    def get_commit(self, repo, sha):
        return self.get_cached(f"/repos/{repo}/commits/{sha}")

    def get_repo(self, repo):
        return self.get(f"/repos/{repo}")

    def get_repositories(self):
        repositories = self.get("/installation/repositories", params={"per_page": 100})
        repos = repositories["repositories"]
        return [repo for repo in repos if not repo.get("archived")]

    def search_repositories(self, query):
        return self.get("/search/repositories", params={"q": query})

    def get_assignees(self, repo):
        return self.get_with_pagination(f"/repos/{repo}/assignees")

    def get_with_pagination(self, path, *args, **kwargs):
        """
        Github uses the Link header to provide pagination links. Github recommends using the provided link relations and not constructing our own URL.
        https://docs.github.com/en/rest/guides/traversing-with-pagination
        """
        try:
            with sentry_sdk.configure_scope() as scope:
                parent_span_id = scope.span.span_id
                trace_id = scope.span.trace_id
        except AttributeError:
            parent_span_id = None
            trace_id = None

        with sentry_sdk.start_transaction(
            op=f"{self.integration_type}.http.pagination",
            name=f"{self.integration_type}.http_response.pagination.{self.name}",
            parent_span_id=parent_span_id,
            trace_id=trace_id,
            sampled=True,
        ):
            output = []
            resp = self.get(path, params={"per_page": self.page_size})
            output.extend(resp)
            page_number = 1

            def get_next_link(resp):
                link = resp.headers.get("link")
                if link is None:
                    return None

                # Should be a comma separated string of links
                links = link.split(",")

                for link in links:
                    # If there is a 'next' link return the URL between the angle brackets, or None
                    if 'rel="next"' in link:
                        return link[link.find("<") + 1 : link.find(">")]

                return None

            while get_next_link(resp) and page_number < self.page_number_limit:
                resp = self.get(get_next_link(resp))
                output.extend(resp)
                page_number += 1
            return output

    def get_issues(self, repo):
        return self.get(f"/repos/{repo}/issues")

    def search_issues(self, query):
        return self.get("/search/issues", params={"q": query})

    def get_issue(self, repo, number):
        return self.get(f"/repos/{repo}/issues/{number}")

    def create_issue(self, repo, data):
        endpoint = f"/repos/{repo}/issues"
        return self.post(endpoint, data=data)

    def create_comment(self, repo, issue_id, data):
        endpoint = f"/repos/{repo}/issues/{issue_id}/comments"
        return self.post(endpoint, data=data)

    def get_user(self, gh_username):
        return self.get(f"/users/{gh_username}")

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
            f"/app/installations/{self.integration.external_id}/access_tokens",
            headers={
                "Authorization": b"Bearer %s" % self.get_jwt(),
                # TODO(jess): remove this whenever it's out of preview
                "Accept": "application/vnd.github.machine-man-preview+json",
            },
        )

    def check_file(self, repo, path, version):
        repo_name = repo.name
        return self.head_cached(path=f"/repos/{repo_name}/contents/{path}", params={"ref": version})

    def search_file(self, repo, filename):
        query = f"filename:{filename}+repo:{repo}"
        results = self.get(path="/search/code", params={"q": query})
        return results

    def get_file(self, repo, path):
        from base64 import b64decode

        # default ref will be the default_branch
        contents = self.get(path=f"/repos/{repo}/contents/{path}")
        encoded_content = contents["content"]
        return b64decode(encoded_content)


class GitHubAppsClient(GitHubClientMixin):
    def __init__(self, integration):
        self.integration = integration
        super().__init__()
