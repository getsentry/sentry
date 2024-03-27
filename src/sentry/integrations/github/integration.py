from __future__ import annotations

import logging
import re
from collections.abc import Collection, Mapping, Sequence
from typing import Any
from urllib.parse import parse_qsl

from django.http import HttpResponse
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _
from rest_framework.request import Request

from sentry import features, options
from sentry.api.utils import generate_organization_url
from sentry.constants import ObjectStatus
from sentry.identity.github import GitHubIdentityProvider, get_user_info
from sentry.integrations import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.mixins import RepositoryMixin
from sentry.integrations.mixins.commit_context import CommitContextMixin
from sentry.integrations.utils.code_mapping import RepoTree
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.repository import Repository
from sentry.pipeline import Pipeline, PipelineView
from sentry.services.hybrid_cloud.organization import RpcOrganizationSummary, organization_service
from sentry.services.hybrid_cloud.repository import RpcRepository, repository_service
from sentry.shared_integrations.constants import ERR_INTERNAL, ERR_UNAUTHORIZED
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.tasks.integrations import migrate_repo
from sentry.tasks.integrations.github.constants import RATE_LIMITED_MESSAGE
from sentry.tasks.integrations.link_all_repos import link_all_repos
from sentry.utils import metrics
from sentry.web.helpers import render_to_response

from .client import GitHubAppsClient, GitHubClientMixin
from .issues import GitHubIssueBasic
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


def get_document_origin(org) -> str:
    if org and features.has("organizations:customer-domains", org.organization):
        return f'"{generate_organization_url(org.organization.slug)}"'
    return "document.origin"


# Github App docs and list of available endpoints
# https://docs.github.com/en/rest/apps/installations
# https://docs.github.com/en/rest/overview/endpoints-available-for-github-apps
class GitHubIntegration(IntegrationInstallation, GitHubIssueBasic, RepositoryMixin, CommitContextMixin):  # type: ignore
    repo_search = True
    codeowners_locations = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"]

    def get_client(self) -> GitHubClientMixin:
        if not self.org_integration:
            raise IntegrationError("Organization Integration does not exist")
        return GitHubAppsClient(integration=self.model, org_integration_id=self.org_integration.id)

    def is_rate_limited_error(self, exc: Exception) -> bool:
        if exc.json and RATE_LIMITED_MESSAGE in exc.json.get("message", ""):
            metrics.incr("github.link_all_repos.rate_limited_error")
            return True

        return False

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

    def get_repositories(
        self, query: str | None = None, fetch_max_pages: bool = False
    ) -> Sequence[Mapping[str, Any]]:
        """
        This fetches all repositories accessible to a Github App
        https://docs.github.com/en/rest/apps/installations#list-repositories-accessible-to-the-app-installation

        per_page: The number of results per page (max 100; default 30).
        """
        if not query:
            return [
                {
                    "name": i["name"],
                    "identifier": i["full_name"],
                    "default_branch": i.get("default_branch"),
                }
                for i in self.get_client().get_repositories(fetch_max_pages)
            ]

        full_query = build_repository_query(self.model.metadata, self.model.name, query)
        response = self.get_client().search_repositories(full_query)
        return [
            {
                "name": i["name"],
                "identifier": i["full_name"],
                "default_branch": i.get("default_branch"),
            }
            for i in response.get("items", [])
        ]

    def search_issues(self, query: str) -> Mapping[str, Sequence[Mapping[str, Any]]]:
        return self.get_client().search_issues(query)

    def source_url_matches(self, url: str) -> bool:
        return url.startswith("https://{}".format(self.model.metadata["domain_name"]))

    def format_source_url(self, repo: Repository, filepath: str, branch: str) -> str:
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

    def get_unmigratable_repositories(self) -> Collection[RpcRepository]:
        accessible_repos = self.get_repositories()
        accessible_repo_names = [r["identifier"] for r in accessible_repos]

        existing_repos = repository_service.get_repositories(
            organization_id=self.organization_id, providers=["github"]
        )

        return [repo for repo in existing_repos if repo.name not in accessible_repo_names]

    def reinstall(self) -> None:
        self.reinstall_repositories()

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

    def get_client(self) -> GitHubClientMixin:
        # XXX: This is very awkward behaviour as we're not passing the client an Integration
        # object it expects. Instead we're passing the Installation object and hoping the client
        # doesn't try to invoke any bad fields/attributes on it.
        return GitHubAppsClient(integration=self.integration_cls)

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
        return [GitHubInstallation(), GitHubUserValidation()]

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

        if state.get("reinstall_id"):
            integration["reinstall_id"] = state["reinstall_id"]

        return integration

    def setup(self) -> None:
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider", GitHubRepositoryProvider, id="integrations:github"
        )


class GitHubInstallation(PipelineView):
    def get_app_url(self) -> str:
        name = options.get("github-app.name")
        return f"https://github.com/apps/{slugify(name)}"

    def dispatch(self, request: Request, pipeline: Pipeline) -> HttpResponse:
        if "reinstall_id" in request.GET:
            pipeline.bind_state("reinstall_id", request.GET["reinstall_id"])

        if "installation_id" not in request.GET:
            return self.redirect(self.get_app_url())

        self.determine_active_organization(request)

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
            return render_to_response(
                "sentry/integrations/github-integration-failed.html",
                context={
                    "error": ERR_INTEGRATION_PENDING_DELETION,
                    "payload": {
                        "success": False,
                        "data": {"error": _("GitHub installation pending deletion.")},
                    },
                    "document_origin": get_document_origin(self.active_organization),
                },
                request=request,
            )

        try:
            # We want to limit GitHub integrations to 1 organization
            installations_exist = OrganizationIntegration.objects.filter(
                integration=Integration.objects.get(external_id=request.GET["installation_id"])
            ).exists()

        except Integration.DoesNotExist:
            pipeline.bind_state("installation_id", request.GET["installation_id"])
            return pipeline.next_step()

        if installations_exist:
            return render_to_response(
                "sentry/integrations/github-integration-failed.html",
                context={
                    "error": ERR_INTEGRATION_EXISTS_ON_ANOTHER_ORG,
                    "payload": {
                        "success": False,
                        "data": {"error": _("Github installed on another Sentry organization.")},
                    },
                    "document_origin": get_document_origin(self.active_organization),
                },
                request=request,
            )

        # OrganizationIntegration does not exist, but Integration does exist.
        pipeline.bind_state("installation_id", request.GET["installation_id"])
        return pipeline.next_step()


class GitHubUserValidation(PipelineView):
    def error(self, request):
        return render_to_response(
            "sentry/integrations/github-integration-failed.html",
            context={
                "error": ERR_INTEGRATION_INVALID_INSTALLATION_REQUEST,
                "payload": {
                    "success": False,
                    "data": {"error": _("Invalid installation request.")},
                },
                "document_origin": get_document_origin(self.active_organization),
            },
            request=request,
        )

    def dispatch(self, request: Request, pipeline: Pipeline) -> HttpResponse:
        self.determine_active_organization(request)

        ghip = GitHubIdentityProvider()
        github_client_id = ghip.get_oauth_client_id()
        github_client_secret = ghip.get_oauth_client_secret()

        if not request.GET.get("state"):
            state = pipeline.signature

            return self.redirect(
                f"{ghip.get_oauth_authorize_url()}?client_id={github_client_id}&state={state}"
            )

        # At this point, we are past the GitHub "authorize" step
        if request.GET.get("state") != pipeline.signature:
            return self.error(request)

        # similar to OAuth2CallbackView.get_token_params
        data = {
            "code": request.GET.get("code"),
            "client_id": github_client_id,
            "client_secret": github_client_secret,
        }

        # similar to OAuth2CallbackView.exchange_token
        from sentry.http import safe_urlopen, safe_urlread

        req = safe_urlopen(url=ghip.get_oauth_access_token_url(), data=data)

        try:
            body = safe_urlread(req).decode("utf-8")
            payload = dict(parse_qsl(body))
        except Exception:
            payload = {}

        if "access_token" not in payload:
            return self.error(request)

        # Check that the authenticated GitHub user is the same as who installed the app.
        authenticated_user_info = get_user_info(payload["access_token"])
        try:
            integration = Integration.objects.get(
                external_id=pipeline.fetch_state("installation_id"), status=ObjectStatus.ACTIVE
            )
        except Integration.DoesNotExist:
            return self.error(request)

        if authenticated_user_info["login"] != integration.metadata["sender"]["login"]:
            return self.error(request)

        return pipeline.next_step()
