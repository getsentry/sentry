from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, Mapping, Sequence

from django.utils.text import slugify
from django.utils.translation import ugettext_lazy as _
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options
from sentry.api.utils import generate_organization_url
from sentry.constants import ObjectStatus
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
from sentry.models import Integration, Organization, OrganizationIntegration, Repository
from sentry.pipeline import Pipeline, PipelineView
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.shared_integrations.constants import ERR_INTERNAL, ERR_UNAUTHORIZED
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.tasks.integrations import migrate_repo
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


def build_repository_query(metadata: Mapping[str, Any], name: str, query: str) -> bytes:
    account_type = "user" if metadata["account_type"] == "User" else "org"
    return f"{account_type}:{name} {query}".encode()


# Github App docs and list of available endpoints
# https://docs.github.com/en/rest/apps/installations
# https://docs.github.com/en/rest/overview/endpoints-available-for-github-apps
class GitHubIntegration(IntegrationInstallation, GitHubIssueBasic, RepositoryMixin, CommitContextMixin):  # type: ignore
    repo_search = True
    codeowners_locations = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"]

    def get_client(self) -> GitHubClientMixin:
        return GitHubAppsClient(integration=self.model, org_integration_id=self.org_integration.id)

    def get_trees_for_org(self, cache_seconds: int = 3600 * 24) -> Dict[str, RepoTree]:
        trees: Dict[str, RepoTree] = {}
        domain_name = self.model.metadata["domain_name"]
        extra = {"metadata": self.model.metadata}
        if domain_name.find("github.com/") == -1:
            logger.warning("We currently only support github.com domains.", extra=extra)
            return trees

        gh_org = domain_name.split("github.com/")[1]
        extra.update({"gh_org": gh_org})
        organization_context = organization_service.get_organization_by_id(
            id=self.org_integration.organization_id, user_id=None
        )
        if not organization_context:
            logger.exception(
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

    def format_source_url(self, repo: Repository, filepath: str, branch: str) -> str:
        # Must format the url ourselves since `check_file` is a head request
        # "https://github.com/octokit/octokit.rb/blob/master/README.md"
        return f"https://github.com/{repo.name}/blob/{branch}/{filepath}"

    def get_unmigratable_repositories(self) -> Sequence[Repository]:
        accessible_repos = self.get_repositories()
        accessible_repo_names = [r["identifier"] for r in accessible_repos]

        existing_repos = Repository.objects.filter(
            organization_id=self.organization_id, provider="github"
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

    def has_repo_access(self, repo: Repository) -> bool:
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

    def get_commit_context(
        self, repo: Repository, filepath: str, ref: str, event_frame: Mapping[str, Any]
    ) -> Mapping[str, str] | None:
        lineno = event_frame.get("lineno", 0)
        if not lineno:
            return None
        try:
            blame_range: Sequence[Mapping[str, Any]] | None = self.get_blame_for_file(
                repo, filepath, ref, lineno
            )

            if blame_range is None:
                return None
        except ApiError as e:
            raise e

        try:
            commit: Mapping[str, Any] = max(
                (
                    blame
                    for blame in blame_range
                    if blame.get("startingLine", 0) <= lineno <= blame.get("endingLine", 0)
                ),
                key=lambda blame: datetime.strptime(
                    blame.get("commit", {}).get("committedDate"), "%Y-%m-%dT%H:%M:%SZ"
                ),
                default={},
            )
            if not commit:
                return None
        except (ValueError, IndexError):
            return None

        commitInfo = commit.get("commit")
        if not commitInfo:
            return None
        else:
            return {
                "commitId": commitInfo.get("oid"),
                "committedDate": commitInfo.get("committedDate"),
                "commitMessage": commitInfo.get("message"),
                "commitAuthorName": commitInfo.get("author", {}).get("name"),
                "commitAuthorEmail": commitInfo.get("author", {}).get("email"),
            }


class GitHubIntegrationProvider(IntegrationProvider):  # type: ignore
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
        organization: Organization,
        extra: Mapping[str, Any] | None = None,
    ) -> None:
        repo_ids = Repository.objects.filter(
            organization_id=organization.id,
            provider__in=["github", "integrations:github"],
            integration_id__isnull=True,
        ).values_list("id", flat=True)

        for repo_id in repo_ids:
            migrate_repo.apply_async(
                kwargs={
                    "repo_id": repo_id,
                    "integration_id": integration.id,
                    "organization_id": organization.id,
                }
            )

    def get_pipeline_views(self) -> Sequence[PipelineView]:
        return [GitHubInstallationRedirect()]

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
            raise api_error

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

        if state.get("reinstall_id"):
            integration["reinstall_id"] = state["reinstall_id"]

        return integration

    def setup(self) -> None:
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider", GitHubRepositoryProvider, id="integrations:github"
        )


class GitHubInstallationRedirect(PipelineView):
    def get_app_url(self) -> str:
        name = options.get("github-app.name")
        return f"https://github.com/apps/{slugify(name)}"

    def dispatch(self, request: Request, pipeline: Pipeline) -> Response:
        if "reinstall_id" in request.GET:
            pipeline.bind_state("reinstall_id", request.GET["reinstall_id"])

        if "installation_id" in request.GET:
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
                document_origin = "document.origin"
                if self.active_organization and features.has(
                    "organizations:customer-domains", self.active_organization.organization
                ):
                    document_origin = (
                        f'"{generate_organization_url(self.active_organization.organization.slug)}"'
                    )
                return render_to_response(
                    "sentry/integrations/integration-pending-deletion.html",
                    context={
                        "payload": {
                            "success": False,
                            "data": {"error": _("GitHub installation pending deletion.")},
                        },
                        "document_origin": document_origin,
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
                document_origin = "document.origin"
                if self.active_organization and features.has(
                    "organizations:customer-domains", self.active_organization.organization
                ):
                    document_origin = (
                        f'"{generate_organization_url(self.active_organization.organization.slug)}"'
                    )
                return render_to_response(
                    "sentry/integrations/github-integration-exists-on-another-org.html",
                    context={
                        "payload": {
                            "success": False,
                            "data": {
                                "error": _("Github installed on another Sentry organization.")
                            },
                        },
                        "document_origin": document_origin,
                    },
                    request=request,
                )

        return self.redirect(self.get_app_url())
