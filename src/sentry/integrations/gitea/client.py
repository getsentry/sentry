from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from requests import PreparedRequest

from sentry.identity.services.identity.model import RpcIdentity
from sentry.integrations.gitea.utils import (
    OAUTH_ACCESS_TOKEN_PATH,
    GiteaApiPath,
    build_api_url,
    get_rate_limit_info_from_response,
    quote_path,
)
from sentry.integrations.source_code_management.repository import RepositoryClient
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.repository import Repository
from sentry.shared_integrations.client.proxy import IntegrationProxyClient
from sentry.shared_integrations.exceptions import ApiPaginationTruncated, ApiUnauthorized
from sentry.silo.base import SiloMode, control_silo_function
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.integrations.gitea.integration import GiteaIntegration

logger = logging.getLogger("sentry.integrations.gitea")


class GiteaSetupApiClient(IntegrationProxyClient):
    """
    API client that doesn't require an installation.

    Used during the install pipeline to fetch the data that goes into the
    integration metadata, before an ``Integration`` row exists.
    """

    integration_name = "gitea_setup"

    def __init__(self, base_url: str, access_token: str, verify_ssl: bool = True) -> None:
        super().__init__(verify_ssl=verify_ssl)
        self.base_url = base_url
        self.token = access_token

    def build_url(self, path: str) -> str:
        return super().build_url(path=build_api_url(self.base_url, path))

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        prepared_request.headers["Authorization"] = f"Bearer {self.token}"
        return prepared_request

    @control_silo_function
    def get_version(self) -> str | None:
        """
        The instance version, e.g. ``"1.27.1"``.

        Self-hosters run a wide spread of Gitea versions, so we record what we
        saw at install time to make later degradation legible. This is
        best-effort: ``/version`` can require auth when ``REQUIRE_SIGNIN_VIEW``
        is on (hence calling it post-auth) and an unknown version is not a
        reason to fail the install.
        """
        response = self.get(GiteaApiPath.version)
        version = response.json.get("version") if isinstance(response.json, dict) else None
        return version if isinstance(version, str) else None


class GiteaApiClient(IntegrationProxyClient, RepositoryClient):
    # Gitea caps list responses at `[api] MAX_RESPONSE_ITEMS`, which defaults
    # to 50. Asking for more than the cap makes `get_with_pagination` read the
    # short page as "last page" and stop after one, silently truncating.
    page_size = 50

    def __init__(self, installation: GiteaIntegration) -> None:
        self.installation = installation
        self.is_refreshing_token = False
        self.base_url = self.metadata["base_url"]
        self.integration_name = IntegrationProviderSlug.GITEA

        super().__init__(
            integration_id=installation.model.id,
            org_integration_id=(
                installation.org_integration.id if installation.org_integration else None
            ),
            verify_ssl=self.metadata.get("verify_ssl", True),
        )

    @property
    def identity(self) -> RpcIdentity:
        return self.installation.default_identity

    @property
    def metadata(self) -> dict[str, Any]:
        return self.installation.model.metadata

    def build_url(self, path: str) -> str:
        return super().build_url(path=build_api_url(self.base_url, path))

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        access_token = self.identity.data["access_token"]
        prepared_request.headers["Authorization"] = f"Bearer {access_token}"
        return prepared_request

    @control_silo_function
    def get_access_token(self) -> dict[str, str | None] | None:
        if self.identity.data["access_token"]:
            return {"access_token": self.identity.data["access_token"], "permissions": None}
        return None

    # Auth / token refresh

    def _refresh_auth(self) -> None:
        """
        Swap the expired access token for a fresh one.

        The provider mutates ``identity.data`` on the very object
        ``self.identity`` hands back (``default_identity`` is cached on the
        installation), so the retried request picks up the new token without
        any rebinding here.
        """
        self.identity.get_identity().refresh_identity(
            self.identity,
            refresh_token_url=f"{self.base_url.rstrip('/')}{OAUTH_ACCESS_TOKEN_PATH}",
            verify_ssl=self.metadata.get("verify_ssl", True),
        )

    def request(self, *args: Any, **kwargs: Any) -> Any:
        # Gitea has a single credential set - the identity of the user who
        # authorized the install. Accepting and dropping the argument keeps the
        # client compatible with the `scm.types.ApiClient` protocol.
        kwargs.pop("credentials_set", None)

        if SiloMode.get_current_mode() == SiloMode.CELL:
            # Skip token refreshes in Cell silo, as these will be handled below
            # by the control silo when the integration proxy invokes the client.
            return super().request(*args, **kwargs)

        return self._issue_request_with_auto_token_refresh(*args, **kwargs)

    def _issue_request_with_auto_token_refresh(self, *args: Any, **kwargs: Any) -> Any:
        try:
            response = super().request(*args, **kwargs)
        except ApiUnauthorized:
            if self.is_refreshing_token:
                raise
            return self._attempt_request_after_refreshing_token(*args, **kwargs)

        if (
            kwargs.get("raw_response", False)
            and response.status_code == 401
            and not self.is_refreshing_token
        ):
            # Callers using `raw_response` get the status code rather than an
            # exception, so the auth failure has to be spotted by hand.
            return self._attempt_request_after_refreshing_token(*args, **kwargs)

        self._track_rate_limit(response)
        return response

    def _attempt_request_after_refreshing_token(self, *args: Any, **kwargs: Any) -> Any:
        assert not self.is_refreshing_token, "A token refresh is already occurring"
        self.is_refreshing_token = True
        try:
            self._refresh_auth()
            return super().request(*args, **kwargs)
        finally:
            self.is_refreshing_token = False

    def _track_rate_limit(self, response: Any) -> None:
        """
        Stock Gitea does not rate limit, but hosted instances behind a proxy do
        and announce it in headers. Surface the moment we run out so a stalled
        integration is diagnosable.
        """
        rate_limit = get_rate_limit_info_from_response(response)
        if rate_limit is None or rate_limit.remaining > 0:
            return

        metrics.incr("integrations.gitea.rate_limit_exhausted")
        logger.info(
            "gitea.rate-limit-exhausted",
            extra={
                "integration_id": self.installation.model.id,
                "limit": rate_limit.limit,
                "reset": rate_limit.reset,
            },
        )

    # Repositories

    def get_repo(self, repo_path: str) -> Any:
        """https://docs.gitea.com/api/1.22/#tag/repository/operation/repoGet"""
        return self.get(GiteaApiPath.repo.format(repo=repo_path))

    def search_repos(
        self,
        query: str | None = None,
        uid: int | str | None = None,
        raise_on_page_limit: bool = False,
    ) -> list[dict[str, Any]]:
        """
        Repositories the given user owns or collaborates on.

        ``uid`` is what scopes the search to one user. Without it Gitea
        searches every repository on the instance - on a shared host, gitea.com
        above all, that is tens of thousands of strangers' public repositories
        ordered by recent activity, and the customer's own repositories are
        nowhere near the first page. Gitea reads it as "owned by *or*
        collaborated with", so the organization repositories the user belongs
        to come along too. This is the analogue of GitLab scoping to a group.

        See https://docs.gitea.com/api/1.22/#tag/repository/operation/repoSearch
        """

        def gen_params(page_number: int, page_size: int) -> dict[str, Any]:
            params: dict[str, Any] = {
                "q": query,
                "sort": "updated",
                "order": "desc",
                # Gitea pages from 1 and calls the page size `limit`.
                "page": page_number + 1,
                "limit": page_size,
            }
            if uid is not None:
                params["uid"] = uid
            return params

        def get_results(resp: Any) -> list[dict[str, Any]]:
            # Unlike most Gitea list endpoints, search wraps its results.
            return resp.get("data", []) if isinstance(resp, dict) else resp

        repos = self.get_with_pagination(GiteaApiPath.repo_search, gen_params, get_results)

        # `get_with_pagination` returns the moment it sees a short page, so a
        # result that filled every page it was allowed to fetch is the one
        # shape that means "the cap stopped us" rather than "that was all of
        # them". The repo sync leans on the distinction: a truncated fetch it
        # cannot recognise reads as "these repositories disappeared", and it
        # starts disabling repositories that are still very much there.
        if raise_on_page_limit and len(repos) >= self.page_size * self.page_number_limit:
            raise ApiPaginationTruncated(repos)

        return repos

    def get_default_branch(self, repo_path: str) -> str:
        return self.get_repo(repo_path)["default_branch"]

    def get_branches(self, repo_path: str) -> Any:
        """https://docs.gitea.com/api/1.22/#tag/repository/operation/repoListBranches"""
        return self.get(GiteaApiPath.branches.format(repo=repo_path))

    def get_branch(self, repo_path: str, branch: str) -> Any:
        """https://docs.gitea.com/api/1.22/#tag/repository/operation/repoGetBranch"""
        return self.get(
            GiteaApiPath.branch.format(repo=repo_path, branch=quote_path(branch)),
        )

    # Commits

    def get_commit(self, repo_path: str, sha: str) -> Any:
        """https://docs.gitea.com/api/1.22/#tag/repository/operation/repoGetSingleCommit"""
        return self.get_cached(GiteaApiPath.commit.format(repo=repo_path, sha=sha))

    def get_commits(
        self, repo_path: str, sha: str | None = None, path: str | None = None
    ) -> list[dict[str, Any]]:
        """
        Commits on a ref, optionally limited to those touching ``path``.

        The path filter is what powers suspect commits: Gitea exposes no REST
        blame endpoint, so the commit list by file is the substitute.

        See https://docs.gitea.com/api/1.22/#tag/repository/operation/repoGetAllCommits
        """
        params: dict[str, str] = {}
        if sha:
            params["sha"] = sha
        if path:
            params["path"] = path
        return self.get(GiteaApiPath.commits.format(repo=repo_path), params=params)

    def compare_commits(self, repo_path: str, start_sha: str, end_sha: str) -> Any:
        """
        Commits between two SHAs.

        See https://docs.gitea.com/api/1.22/#tag/repository/operation/repoCompareDiff
        """
        return self.get(
            GiteaApiPath.compare.format(repo=repo_path, basehead=f"{start_sha}...{end_sha}")
        )

    # Files

    def check_file(self, repo: Repository, path: str, version: str | None) -> object | None:
        """
        Whether a file exists, for stacktrace linking.

        Gitea has no HEAD route for contents, so this is a GET whose body we
        throw away.
        """
        return self.get_cached(
            GiteaApiPath.contents.format(repo=self.repo_path(repo), path=quote_path(path)),
            params={"ref": version} if version else {},
        )

    def get_file(
        self, repo: Repository, path: str, ref: str | None, codeowners: bool = False
    ) -> str:
        """
        File contents.

        ``/raw`` hands back the bytes directly, saving the base64 round trip
        that ``/contents`` would require.
        """
        contents = self.get(
            GiteaApiPath.raw.format(repo=self.repo_path(repo), path=quote_path(path)),
            params={"ref": ref} if ref else {},
            raw_response=True,
        )
        return contents.content.decode("utf-8")

    # Issues

    def create_issue(self, repo_path: str, data: dict[str, Any]) -> Any:
        """https://docs.gitea.com/api/1.22/#tag/issue/operation/issueCreateIssue"""
        return self.post(GiteaApiPath.issues.format(repo=repo_path), data=data)

    def get_issue(self, repo_path: str, issue_index: str | int) -> Any:
        """https://docs.gitea.com/api/1.22/#tag/issue/operation/issueGetIssue"""
        return self.get(GiteaApiPath.issue.format(repo=repo_path, issue_index=issue_index))

    def create_issue_comment(
        self, repo_path: str, issue_index: str | int, data: dict[str, Any]
    ) -> Any:
        """https://docs.gitea.com/api/1.22/#tag/issue/operation/issueCreateComment"""
        return self.post(
            GiteaApiPath.issue_comments.format(repo=repo_path, issue_index=issue_index), data=data
        )

    def search_issues(self, repo_path: str, query: str | None) -> list[dict[str, Any]]:
        """
        Open issues in a repository, optionally matching a keyword.

        ``type=issues`` is not optional: Gitea models pull requests as issues
        and lists them from this endpoint too, so without it the issue-linking
        autocomplete offers pull requests that cannot be linked.

        See https://docs.gitea.com/api/1.22/#tag/issue/operation/issueListIssues
        """
        params: dict[str, Any] = {"state": "open", "type": "issues"}
        if query:
            params["q"] = query
        return self.get(GiteaApiPath.issues.format(repo=repo_path), params=params)

    def get_labels(self, repo_path: str) -> list[dict[str, Any]]:
        """
        Every label defined on a repository, for the create-issue form.

        Paginated because the labels a customer wants are as likely to be at the
        end of a long list as the start, and Gitea caps a page at 50.

        See https://docs.gitea.com/api/1.22/#tag/issue/operation/issueListLabels
        """

        def gen_params(page_number: int, page_size: int) -> dict[str, Any]:
            return {"page": page_number + 1, "limit": page_size}

        def get_results(resp: Any) -> list[dict[str, Any]]:
            return resp

        return self.get_with_pagination(
            GiteaApiPath.labels.format(repo=repo_path), gen_params, get_results
        )

    def get_assignees(self, repo_path: str) -> list[dict[str, Any]]:
        """
        Users who can be assigned an issue in a repository.

        Unpaginated on Gitea's side - it returns the collaborator list whole.

        See https://docs.gitea.com/api/1.22/#tag/repository/operation/repoGetAssignees
        """
        return self.get(GiteaApiPath.assignees.format(repo=repo_path))

    # Webhooks

    def webhook_secret(self) -> str:
        """
        The composite ``{organization_id}:{integration_id}:{webhook_secret}``
        HMAC key.

        Gitea never transmits the hook secret - not in the body, not in a
        header - it only signs the body with it, so this value never travels.
        Which organization and integration a delivery is for is carried by the
        hook URL instead; this authenticates that claim.

        Binding both route components into the key is what stops a replay
        across organizations: two organizations that installed with the same
        OAuth app share an ``Integration`` row and therefore the stored secret,
        so a body signed for one would otherwise validate verbatim at the
        other's endpoint. It does not defend against a Gitea repo admin, who
        can simply read the secret out of Gitea's own hook settings.
        """
        model = self.installation.model
        return "{}:{}:{}".format(
            self.installation.organization_id, model.id, model.metadata["webhook_secret"]
        )

    def create_repo_webhook(self, repo_path: str, webhook_url: str) -> int:
        """
        Register the per-repo hook that feeds commits and pull requests.

        See https://docs.gitea.com/api/1.22/#tag/repository/operation/repoCreateHook
        """
        response = self.post(
            GiteaApiPath.hooks.format(repo=repo_path),
            data={
                "type": "gitea",
                "active": True,
                "events": ["push", "pull_request"],
                "config": {
                    "url": webhook_url,
                    "content_type": "json",
                    "secret": self.webhook_secret(),
                },
            },
        )
        return response["id"]

    def get_repo_webhooks(self, repo_path: str) -> list[dict[str, Any]]:
        """
        Every hook on a repository.

        Paginated because this backs hook reconciliation: a CI-heavy repo can
        carry more hooks than one page holds, and the one we are looking for
        hiding on page two would silently defeat the reconciliation.

        See https://docs.gitea.com/api/1.22/#tag/repository/operation/repoListHooks
        """

        def gen_params(page_number: int, page_size: int) -> dict[str, Any]:
            return {"page": page_number + 1, "limit": page_size}

        def get_results(resp: Any) -> list[dict[str, Any]]:
            return resp

        return self.get_with_pagination(
            GiteaApiPath.hooks.format(repo=repo_path), gen_params, get_results
        )

    def delete_repo_webhook(self, repo_path: str, hook_id: str | int) -> Any:
        """https://docs.gitea.com/api/1.22/#tag/repository/operation/repoDeleteHook"""
        return self.delete(GiteaApiPath.hook.format(repo=repo_path, hook_id=hook_id))

    # Pull requests

    def get_pull_request(self, repo_path: str, pull_index: str | int) -> Any:
        """https://docs.gitea.com/api/1.22/#tag/repository/operation/repoGetPullRequest"""
        return self.get(GiteaApiPath.pull.format(repo=repo_path, pull_index=pull_index))

    def get_pull_requests(self, repo_path: str, state: str | None = None) -> Any:
        """https://docs.gitea.com/api/1.22/#tag/repository/operation/repoListPullRequests"""
        return self.get(
            GiteaApiPath.pulls.format(repo=repo_path),
            params={"state": state} if state else {},
        )

    @staticmethod
    def repo_path(repo: Repository) -> str:
        """The ``owner/name`` pair every repository route is keyed on."""
        return repo.config["path"]
