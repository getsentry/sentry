from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping, Sequence

import sentry_sdk

from sentry.integrations.client import ApiClient
from sentry.integrations.github.utils import get_jwt, get_next_link
from sentry.models import Integration, Repository
from sentry.utils import jwt
from sentry.utils.json import JSONData


class GitHubClientMixin(ApiClient):  # type: ignore
    allow_redirects = True

    base_url = "https://api.github.com"
    integration_name = "github"

    def get_jwt(self) -> str:
        return get_jwt()

    def get_last_commits(self, repo: str, end_sha: str) -> Sequence[JSONData]:
        """
        Return API request that fetches last ~30 commits
        see https://developer.github.com/v3/repos/commits/#list-commits-on-a-repository
        using end_sha as parameter.
        """
        # Explicitly typing to satisfy mypy.
        commits: Sequence[JSONData] = self.get_cached(
            f"/repos/{repo}/commits", params={"sha": end_sha}
        )
        return commits

    def compare_commits(self, repo: str, start_sha: str, end_sha: str) -> JSONData:
        """
        See https://developer.github.com/v3/repos/commits/#compare-two-commits
        where start sha is oldest and end is most recent.
        """
        # Explicitly typing to satisfy mypy.
        diff: JSONData = self.get_cached(f"/repos/{repo}/compare/{start_sha}...{end_sha}")
        return diff

    def repo_hooks(self, repo: str) -> Sequence[JSONData]:
        # Explicitly typing to satisfy mypy.
        hooks: Sequence[JSONData] = self.get(f"/repos/{repo}/hooks")
        return hooks

    def get_commits(self, repo: str) -> Sequence[JSONData]:
        # Explicitly typing to satisfy mypy.
        commits: Sequence[JSONData] = self.get(f"/repos/{repo}/commits")
        return commits

    def get_commit(self, repo: str, sha: str) -> JSONData:
        # Explicitly typing to satisfy mypy.
        commit: JSONData = self.get_cached(f"/repos/{repo}/commits/{sha}")
        return commit

    def get_repo(self, repo: str) -> JSONData:
        # Explicitly typing to satisfy mypy.
        repository: JSONData = self.get(f"/repos/{repo}")
        return repository

    def get_repositories(self) -> Sequence[JSONData]:
        # Explicitly typing to satisfy mypy.
        repositories: JSONData = self.get("/installation/repositories", params={"per_page": 100})
        repos = repositories["repositories"]
        return [repo for repo in repos if not repo.get("archived")]

    def search_repositories(self, query: bytes) -> Mapping[str, Sequence[JSONData]]:
        # Explicitly typing to satisfy mypy.
        repositories: Mapping[str, Sequence[JSONData]] = self.get(
            "/search/repositories", params={"q": query}
        )
        return repositories

    def get_assignees(self, repo: str) -> Sequence[JSONData]:
        # Explicitly typing to satisfy mypy.
        assignees: Sequence[JSONData] = self.get_with_pagination(f"/repos/{repo}/assignees")
        return assignees

    def get_with_pagination(self, path: str, *args: Any, **kwargs: Any) -> Sequence[JSONData]:
        """
        Github uses the Link header to provide pagination links. Github
        recommends using the provided link relations and not constructing our
        own URL.
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

            while get_next_link(resp) and page_number < self.page_number_limit:
                resp = self.get(get_next_link(resp))
                output.extend(resp)
                page_number += 1
            return output

    def get_issues(self, repo: str) -> Sequence[JSONData]:
        issues: Sequence[JSONData] = self.get(f"/repos/{repo}/issues")
        return issues

    def search_issues(self, query: str) -> Mapping[str, Sequence[Mapping[str, Any]]]:
        # Explicitly typing to satisfy mypy.
        issues: Mapping[str, Sequence[Mapping[str, Any]]] = self.get(
            "/search/issues", params={"q": query}
        )
        return issues

    def get_issue(self, repo: str, number: str) -> JSONData:
        return self.get(f"/repos/{repo}/issues/{number}")

    def create_issue(self, repo: str, data: Mapping[str, Any]) -> JSONData:
        endpoint = f"/repos/{repo}/issues"
        return self.post(endpoint, data=data)

    def create_comment(self, repo: str, issue_id: str, data: Mapping[str, Any]) -> JSONData:
        endpoint = f"/repos/{repo}/issues/{issue_id}/comments"
        return self.post(endpoint, data=data)

    def get_user(self, gh_username: str) -> JSONData:
        return self.get(f"/users/{gh_username}")

    def request(
        self,
        method: str,
        path: str,
        headers: Mapping[str, Any] | None = None,
        data: Mapping[str, Any] | None = None,
        params: Mapping[str, Any] | None = None,
    ) -> JSONData:
        if headers is None:
            headers = {
                "Authorization": f"token {self.get_token()}",
                # TODO(jess): remove this whenever it's out of preview
                "Accept": "application/vnd.github.machine-man-preview+json",
            }
        return self._request(method, path, headers=headers, data=data, params=params)

    def get_token(self, force_refresh: bool = False) -> str:
        """
        Get token retrieves the active access token from the integration model.
        Should the token have expired, a new token will be generated and
        automatically persisted into the integration.
        """
        token: str | None = self.integration.metadata.get("access_token")
        expires_at: str | None = self.integration.metadata.get("expires_at")

        if (
            not token
            or not expires_at
            or (datetime.strptime(expires_at, "%Y-%m-%dT%H:%M:%S") < datetime.utcnow())
            or force_refresh
        ):
            res = self.create_token()
            token = res["token"]
            expires_at = datetime.strptime(res["expires_at"], "%Y-%m-%dT%H:%M:%SZ").isoformat()

            self.integration.metadata.update({"access_token": token, "expires_at": expires_at})
            self.integration.save()

        return token or ""

    def create_token(self) -> JSONData:
        headers = {
            # TODO(jess): remove this whenever it's out of preview
            "Accept": "application/vnd.github.machine-man-preview+json",
        }
        headers.update(jwt.authorization_header(self.get_jwt()))
        return self.post(
            f"/app/installations/{self.integration.external_id}/access_tokens",
            headers=headers,
        )

    def check_file(self, repo: Repository, path: str, version: str) -> str | None:
        file: str = self.head_cached(
            path=f"/repos/{repo.name}/contents/{path}", params={"ref": version}
        )
        return file

    def search_file(
        self, repo: Repository, filename: str
    ) -> Mapping[str, Sequence[Mapping[str, Any]]]:
        query = f"filename:{filename}+repo:{repo}"
        results: Mapping[str, Any] = self.get(path="/search/code", params={"q": query})
        return results

    def get_file(self, repo: Repository, path: str, ref: str) -> bytes:
        from base64 import b64decode

        contents = self.get(path=f"/repos/{repo.name}/contents/{path}", params={"ref": ref})
        encoded_content = contents["content"]
        return b64decode(encoded_content)


class GitHubAppsClient(GitHubClientMixin):
    def __init__(self, integration: Integration) -> None:
        self.integration = integration
        super().__init__()
