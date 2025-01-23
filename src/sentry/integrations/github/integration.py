from __future__ import annotations

import logging
import re
from collections.abc import Mapping, Sequence
from enum import StrEnum
from typing import Any
from urllib.parse import parse_qsl

from django.http.response import HttpResponseBase
from django.urls import reverse
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _
from rest_framework.request import Request

from sentry import features, options
from sentry.constants import ObjectStatus
from sentry.http import safe_urlopen, safe_urlread
from sentry.identity.github import GitHubIdentityProvider, get_user_info
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationDomain,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.github.constants import RATE_LIMITED_MESSAGE
from sentry.integrations.github.tasks.link_all_repos import link_all_repos
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.repository import RpcRepository, repository_service
from sentry.integrations.source_code_management.commit_context import CommitContextIntegration
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.integrations.tasks.migrate_repo import migrate_repo
from sentry.integrations.utils.metrics import (
    IntegrationPipelineViewEvent,
    IntegrationPipelineViewType,
)
from sentry.issues.auto_source_code_config.code_mapping import RepoTree
from sentry.models.repository import Repository
from sentry.organizations.absolute_url import generate_organization_url
from sentry.organizations.services.organization import RpcOrganizationSummary, organization_service
from sentry.pipeline import Pipeline, PipelineView
from sentry.shared_integrations.constants import ERR_INTERNAL, ERR_UNAUTHORIZED
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.utils import metrics
from sentry.utils.http import absolute_uri
from sentry.web.helpers import render_to_response

from .client import GitHubApiClient, GitHubBaseClient
from .issues import GitHubIssuesSpec
from .repository import GitHubRepositoryProvider

logger = logging.getLogger("sentry.integrations.github")

DESCRIPTION = """
Connect your Sentry organization into your GitHub organization or user account.
Take a step towards augmenting your sentry issues with commits from your
repositories ([using releases](https://docs.sentry.io/learn/releases/)) and
linking up your GitHub issues and pull requests directly to issues in Sentry.
"""

FEATURES = [
    FeatureDescription(
        """
        Authorize repositories to be added to your Sentry organization to augment
        sentry issues with commit data with [deployment
        tracking](https://docs.sentry.io/learn/releases/).
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Create and link Sentry issue groups directly to a GitHub issue or pull
        request in any of your repositories, providing a quick way to jump from
        Sentry bug to tracked issue or PR!
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
    FeatureDescription(
        """
        Link your Sentry stack traces back to your GitHub source code with stack
        trace linking.
        """,
        IntegrationFeatures.STACKTRACE_LINK,
    ),
    FeatureDescription(
        """
        Import your GitHub [CODEOWNERS file](https://docs.sentry.io/product/integrations/source-code-mgmt/github/#code-owners) and use it alongside your ownership rules to assign Sentry issues.
        """,
        IntegrationFeatures.CODEOWNERS,
    ),
    FeatureDescription(
        """
        Automatically create GitHub issues based on Issue Alert conditions.
        """,
        IntegrationFeatures.TICKET_RULES,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=GitHub%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/github",
    aspects={},
)

API_ERRORS = {
    404: "If this repository exists, ensure"
    " that your installation has permission to access this repository"
    " (https://github.com/settings/installations).",
    401: ERR_UNAUTHORIZED,
}

ERR_INTEGRATION_EXISTS_ON_ANOTHER_ORG = _(
    "It seems that your GitHub account has been installed on another Sentry organization. Please uninstall and try again."
)
ERR_INTEGRATION_INVALID_INSTALLATION_REQUEST = _(
    "We could not verify the authenticity of the installation request. We recommend restarting the installation process."
)
ERR_INTEGRATION_PENDING_DELETION = _(
    "It seems that your Sentry organization has an installation pending deletion. Please wait ~15min for the uninstall to complete and try again."
)


def build_repository_query(metadata: Mapping[str, Any], name: str, query: str) -> bytes:
    account_type = "user" if metadata["account_type"] == "User" else "org"
    return f"{account_type}:{name} {query}".encode()


def error(
    request,
    org,
    error_short="Invalid installation request.",
    error_long=ERR_INTEGRATION_INVALID_INSTALLATION_REQUEST,
):
    logger.error(
        "github.installation_error",
        extra={"org_id": org.organization.id, "error_short": error_short},
    )

    return render_to_response(
        "sentry/integrations/github-integration-failed.html",
        context={
            "error": error_long,
            "payload": {
                "success": False,
                "data": {"error": _(error_short)},
            },
            "document_origin": get_document_origin(org),
        },
        request=request,
    )


def get_document_origin(org) -> str:
    if org and features.has("system:multi-region"):
        return f'"{generate_organization_url(org.organization.slug)}"'
    return "document.origin"


# Github App docs and list of available endpoints
# https://docs.github.com/en/rest/apps/installations
# https://docs.github.com/en/rest/overview/endpoints-available-for-github-apps


class GitHubIntegration(RepositoryIntegration, GitHubIssuesSpec, CommitContextIntegration):
    codeowners_locations = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"]

    @property
    def integration_name(self) -> str:
        return "github"

    def get_client(self) -> GitHubBaseClient:
        if not self.org_integration:
            raise IntegrationError("Organization Integration does not exist")
        return GitHubApiClient(integration=self.model, org_integration_id=self.org_integration.id)

    # IntegrationInstallation methods

    def is_rate_limited_error(self, exc: Exception) -> bool:
        if exc.json and RATE_LIMITED_MESSAGE in exc.json.get("message", ""):
            metrics.incr("github.link_all_repos.rate_limited_error")
            return True

        return False

    def message_from_error(self, exc: Exception) -> str:
        if not isinstance(exc, ApiError):
            return ERR_INTERNAL

        if not exc.code:
            message = ""
        else:
            message = API_ERRORS.get(exc.code, "")

        if exc.code == 404 and exc.url and re.search(r"/repos/.*/(compare|commits)", exc.url):
            message += (
                " Please also confirm that the commits associated with "
                f"the following URL have been pushed to GitHub: {exc.url}"
            )

        if not message:
            message = exc.json.get("message", "unknown error") if exc.json else "unknown error"
        return f"Error Communicating with GitHub (HTTP {exc.code}): {message}"

    # RepositoryIntegration methods

    def source_url_matches(self, url: str) -> bool:
        return url.startswith("https://{}".format(self.model.metadata["domain_name"]))

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        # Must format the url ourselves since `check_file` is a head request
        # "https://github.com/octokit/octokit.rb/blob/master/README.md"
        return f"https://github.com/{repo.name}/blob/{branch}/{filepath}"

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        url = url.replace(f"{repo.url}/blob/", "")
        branch, _, _ = url.partition("/")
        return branch

    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        url = url.replace(f"{repo.url}/blob/", "")
        _, _, source_path = url.partition("/")
        return source_path

    def get_repositories(self, query: str | None = None, **kwargs: Any) -> list[dict[str, Any]]:
        """
        args:
        * query - a query to filter the repositories by

        kwargs:
        * fetch_max_pages - fetch as many repos as possible using pagination (slow)

        This fetches all repositories accessible to the Github App
        https://docs.github.com/en/rest/apps/installations#list-repositories-accessible-to-the-app-installation

        It uses page_size from the base class to specify how many items per page (max 100; default 30).
        The upper bound of requests is controlled with self.page_number_limit to prevent infinite requests.
        """
        if not query:
            fetch_max_pages = kwargs.get("fetch_max_pages", False)
            repos = self.get_client().get_repos(fetch_max_pages)
            return [
                {
                    "id": i["id"],
                    "name": i["name"],
                    "identifier": i["full_name"],
                    "default_branch": i.get("default_branch"),
                }
                for i in [repo for repo in repos if not repo.get("archived")]
            ]

        full_query = build_repository_query(self.model.metadata, self.model.name, query)
        response = self.get_client().search_repositories(full_query)
        return [
            {
                "id": i["id"],
                "name": i["name"],
                "identifier": i["full_name"],
                "default_branch": i.get("default_branch"),
            }
            for i in response.get("items", [])
        ]

    def get_unmigratable_repositories(self) -> list[RpcRepository]:
        accessible_repos = self.get_repositories()
        accessible_repo_names = [r["identifier"] for r in accessible_repos]

        existing_repos = repository_service.get_repositories(
            organization_id=self.organization_id, providers=["github"]
        )

        return [repo for repo in existing_repos if repo.name not in accessible_repo_names]

    def has_repo_access(self, repo: RpcRepository) -> bool:
        client = self.get_client()
        try:
            # make sure installation has access to this specific repo
            # use hooks endpoint since we explicitly ask for those permissions
            # when installing the app (commits can be accessed for public repos)
            # https://docs.github.com/en/rest/webhooks/repo-config#list-hooks
            client.repo_hooks(repo.config["name"])
        except ApiError:
            return False
        return True

    # for derive code mappings - TODO(cathy): define in an ABC
    def get_trees_for_org(self, cache_seconds: int = 3600 * 24) -> dict[str, RepoTree]:
        trees: dict[str, RepoTree] = {}
        domain_name = self.model.metadata["domain_name"]
        extra = {"metadata": self.model.metadata}
        if domain_name.find("github.com/") == -1:
            logger.warning("We currently only support github.com domains.", extra=extra)
            return trees

        gh_org = domain_name.split("github.com/")[1]
        extra.update({"gh_org": gh_org})
        org_exists = organization_service.check_organization_by_id(
            id=self.org_integration.organization_id, only_visible=False
        )
        if not org_exists:
            logger.error(
                "No organization information was found. Continuing execution.", extra=extra
            )
        else:
            trees = self.get_client().get_trees_for_org(gh_org=gh_org, cache_seconds=cache_seconds)

        return trees

    def search_issues(self, query: str | None, **kwargs) -> dict[str, Any]:
        resp = self.get_client().search_issues(query)
        assert isinstance(resp, dict)
        return resp


class GitHubIntegrationProvider(IntegrationProvider):
    key = "github"
    name = "GitHub"
    metadata = metadata
    integration_cls = GitHubIntegration
    features = frozenset(
        [
            IntegrationFeatures.COMMITS,
            IntegrationFeatures.ISSUE_BASIC,
            IntegrationFeatures.STACKTRACE_LINK,
            IntegrationFeatures.CODEOWNERS,
        ]
    )

    setup_dialog_config = {"width": 1030, "height": 1000}

    def get_client(self) -> GitHubBaseClient:
        # XXX: This is very awkward behaviour as we're not passing the client an Integration
        # object it expects. Instead we're passing the Installation object and hoping the client
        # doesn't try to invoke any bad fields/attributes on it.
        return GitHubApiClient(integration=self.integration_cls)

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganizationSummary,
        extra: Mapping[str, Any] | None = None,
    ) -> None:
        repos = repository_service.get_repositories(
            organization_id=organization.id,
            providers=["github", "integrations:github"],
            has_integration=False,
        )

        for repo in repos:
            migrate_repo.apply_async(
                kwargs={
                    "repo_id": repo.id,
                    "integration_id": integration.id,
                    "organization_id": organization.id,
                }
            )

        link_all_repos.apply_async(
            kwargs={
                "integration_key": self.key,
                "integration_id": integration.id,
                "organization_id": organization.id,
            }
        )

    def get_pipeline_views(self) -> Sequence[PipelineView]:
        return [OAuthLoginView(), GitHubInstallation()]

    def get_installation_info(self, installation_id: str) -> Mapping[str, Any]:
        client = self.get_client()
        resp: Mapping[str, Any] = client.get(f"/app/installations/{installation_id}")
        return resp

    def build_integration(self, state: Mapping[str, str]) -> Mapping[str, Any]:
        try:
            installation = self.get_installation_info(state["installation_id"])
        except ApiError as api_error:
            if api_error.code == 404:
                raise IntegrationError("The GitHub installation could not be found.")
            raise

        integration = {
            "name": installation["account"]["login"],
            # TODO(adhiraj): This should be a constant representing the entire github cloud.
            "external_id": installation["id"],
            # GitHub identity is associated directly to the application, *not*
            # to the installation itself.
            "idp_external_id": installation["app_id"],
            "metadata": {
                # The access token will be populated upon API usage
                "access_token": None,
                "expires_at": None,
                "icon": installation["account"]["avatar_url"],
                "domain_name": installation["account"]["html_url"].replace("https://", ""),
                "account_type": installation["account"]["type"],
            },
        }

        if state.get("sender"):
            integration["metadata"]["sender"] = state["sender"]

        return integration

    def setup(self) -> None:
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider", GitHubRepositoryProvider, id="integrations:github"
        )


class GitHubInstallationError(StrEnum):
    INVALID_STATE = "Invalid state"
    MISSING_TOKEN = "Missing access token"
    MISSING_LOGIN = "Missing login info"
    PENDING_DELETION = "GitHub installation pending deletion."
    INSTALLATION_EXISTS = "Github installed on another Sentry organization."
    USER_MISMATCH = "Authenticated user is not the same as who installed the app."
    MISSING_INTEGRATION = "Integration does not exist."


def record_event(event: IntegrationPipelineViewType):
    return IntegrationPipelineViewEvent(
        event, IntegrationDomain.SOURCE_CODE_MANAGEMENT, GitHubIntegrationProvider.key
    )


class OAuthLoginView(PipelineView):
    def dispatch(self, request: Request, pipeline: Pipeline) -> HttpResponseBase:
        with record_event(IntegrationPipelineViewType.OAUTH_LOGIN).capture() as lifecycle:
            self.determine_active_organization(request)
            lifecycle.add_extra(
                "organization_id",
                self.active_organization.organization.id if self.active_organization else None,
            )

            ghip = GitHubIdentityProvider()
            github_client_id = ghip.get_oauth_client_id()
            github_client_secret = ghip.get_oauth_client_secret()

            installation_id = request.GET.get("installation_id")
            if installation_id:
                pipeline.bind_state("installation_id", installation_id)

            if not request.GET.get("state"):
                state = pipeline.signature

                redirect_uri = absolute_uri(
                    reverse("sentry-extension-setup", kwargs={"provider_id": "github"})
                )
                return self.redirect(
                    f"{ghip.get_oauth_authorize_url()}?client_id={github_client_id}&state={state}&redirect_uri={redirect_uri}"
                )

            # At this point, we are past the GitHub "authorize" step
            if request.GET.get("state") != pipeline.signature:
                lifecycle.record_failure(GitHubInstallationError.INVALID_STATE)
                return error(
                    request,
                    self.active_organization,
                    error_short=GitHubInstallationError.INVALID_STATE,
                )

            # similar to OAuth2CallbackView.get_token_params
            data = {
                "code": request.GET.get("code"),
                "client_id": github_client_id,
                "client_secret": github_client_secret,
            }

            # similar to OAuth2CallbackView.exchange_token
            req = safe_urlopen(url=ghip.get_oauth_access_token_url(), data=data)

            try:
                body = safe_urlread(req).decode("utf-8")
                payload = dict(parse_qsl(body))
            except Exception:
                payload = {}

            if "access_token" not in payload:
                lifecycle.record_failure(GitHubInstallationError.MISSING_TOKEN)
                return error(
                    request,
                    self.active_organization,
                    error_short=GitHubInstallationError.MISSING_TOKEN,
                )

            authenticated_user_info = get_user_info(payload["access_token"])
            if "login" not in authenticated_user_info:
                lifecycle.record_failure(GitHubInstallationError.MISSING_LOGIN)
                return error(
                    request,
                    self.active_organization,
                    error_short=GitHubInstallationError.MISSING_LOGIN,
                )

            pipeline.bind_state("github_authenticated_user", authenticated_user_info["login"])
            return pipeline.next_step()


class GitHubInstallation(PipelineView):
    def get_app_url(self) -> str:
        name = options.get("github-app.name")
        return f"https://github.com/apps/{slugify(name)}"

    def dispatch(self, request: Request, pipeline: Pipeline) -> HttpResponseBase:
        with record_event(IntegrationPipelineViewType.GITHUB_INSTALLATION).capture() as lifecycle:
            installation_id = request.GET.get(
                "installation_id", pipeline.fetch_state("installation_id")
            )
            if installation_id is None:
                return self.redirect(self.get_app_url())

            pipeline.bind_state("installation_id", installation_id)
            self.determine_active_organization(request)
            lifecycle.add_extra(
                "organization_id",
                self.active_organization.organization.id if self.active_organization else None,
            )

            integration_pending_deletion_exists = False
            if self.active_organization:
                # We want to wait until the scheduled deletions finish or else the
                # post install to migrate repos do not work.
                integration_pending_deletion_exists = OrganizationIntegration.objects.filter(
                    integration__provider=GitHubIntegrationProvider.key,
                    organization_id=self.active_organization.organization.id,
                    status=ObjectStatus.PENDING_DELETION,
                ).exists()

            if integration_pending_deletion_exists:
                lifecycle.record_failure(GitHubInstallationError.PENDING_DELETION)
                return error(
                    request,
                    self.active_organization,
                    error_short=GitHubInstallationError.PENDING_DELETION,
                    error_long=ERR_INTEGRATION_PENDING_DELETION,
                )

            try:
                # We want to limit GitHub integrations to 1 organization
                installations_exist = OrganizationIntegration.objects.filter(
                    integration=Integration.objects.get(external_id=installation_id)
                ).exists()

            except Integration.DoesNotExist:
                return pipeline.next_step()

            if installations_exist:
                lifecycle.record_failure(GitHubInstallationError.INSTALLATION_EXISTS)
                return error(
                    request,
                    self.active_organization,
                    error_short=GitHubInstallationError.INSTALLATION_EXISTS,
                    error_long=ERR_INTEGRATION_EXISTS_ON_ANOTHER_ORG,
                )

            # OrganizationIntegration does not exist, but Integration does exist.
            try:
                integration = Integration.objects.get(
                    external_id=installation_id, status=ObjectStatus.ACTIVE
                )
            except Integration.DoesNotExist:
                lifecycle.record_failure(GitHubInstallationError.MISSING_INTEGRATION)
                return error(request, self.active_organization)

            # Check that the authenticated GitHub user is the same as who installed the app.
            if (
                pipeline.fetch_state("github_authenticated_user")
                != integration.metadata["sender"]["login"]
            ):
                lifecycle.record_failure(GitHubInstallationError.USER_MISMATCH)
                return error(
                    request,
                    self.active_organization,
                    error_short=GitHubInstallationError.USER_MISMATCH,
                )

            return pipeline.next_step()
