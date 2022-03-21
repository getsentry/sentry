from __future__ import annotations

import re
from typing import Any, Mapping, Sequence

from django.utils.text import slugify
from django.utils.translation import ugettext_lazy as _
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.mixins import RepositoryMixin
from sentry.models import Integration, Organization, OrganizationIntegration, Repository
from sentry.pipeline import Pipeline, PipelineView
from sentry.shared_integrations.constants import ERR_INTERNAL, ERR_UNAUTHORIZED
from sentry.shared_integrations.exceptions import ApiError
from sentry.tasks.integrations import migrate_repo
from sentry.utils import jwt
from sentry.web.helpers import render_to_response

from .client import GitHubAppsClient, GitHubClientMixin
from .issues import GitHubIssueBasic
from .repository import GitHubRepositoryProvider
from .utils import get_jwt

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


class GitHubIntegration(IntegrationInstallation, GitHubIssueBasic, RepositoryMixin):  # type: ignore
    repo_search = True
    codeowners_locations = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"]

    def get_client(self) -> GitHubClientMixin:
        return GitHubAppsClient(integration=self.model)

    def get_repositories(self, query: str | None = None) -> Sequence[Mapping[str, Any]]:
        if not query:
            return [
                {"name": i["name"], "identifier": i["full_name"]}
                for i in self.get_client().get_repositories()
            ]

        full_query = build_repository_query(self.model.metadata, self.model.name, query)
        response = self.get_client().search_repositories(full_query)
        return [
            {"name": i["name"], "identifier": i["full_name"]} for i in response.get("items", [])
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
            # https://developer.github.com/v3/repos/hooks/#list-hooks
            client.repo_hooks(repo.config["name"])
        except ApiError:
            return False
        return True


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
        headers = {
            # TODO(jess): remove this whenever it's out of preview
            "Accept": "application/vnd.github.machine-man-preview+json",
        }
        headers.update(jwt.authorization_header(get_jwt()))

        resp: Mapping[str, Any] = client.get(
            f"/app/installations/{installation_id}", headers=headers
        )
        return resp

    def build_integration(self, state: Mapping[str, str]) -> Mapping[str, Any]:
        installation = self.get_installation_info(state["installation_id"])

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


class GitHubInstallationRedirect(PipelineView):  # type: ignore
    def get_app_url(self) -> str:
        name = options.get("github-app.name")
        return f"https://github.com/apps/{slugify(name)}"

    def dispatch(self, request: Request, pipeline: Pipeline) -> Response:
        if "reinstall_id" in request.GET:
            pipeline.bind_state("reinstall_id", request.GET["reinstall_id"])

        if "installation_id" in request.GET:
            organization = self.get_active_organization(request)

            # We want to wait until the scheduled deletions finish or else the post install to migrate repos do not work.
            integration_pending_deletion_exists = OrganizationIntegration.objects.filter(
                integration__provider=GitHubIntegrationProvider.key,
                organization=organization,
                status=ObjectStatus.PENDING_DELETION,
            ).exists()

            if integration_pending_deletion_exists:
                return render_to_response(
                    "sentry/integrations/integration-pending-deletion.html",
                    context={
                        "payload": {
                            "success": False,
                            "data": {"error": _("GitHub installation pending deletion.")},
                        }
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
                    "sentry/integrations/github-integration-exists-on-another-org.html",
                    context={
                        "payload": {
                            "success": False,
                            "data": {
                                "error": _("Github installed on another Sentry organization.")
                            },
                        }
                    },
                    request=request,
                )

        return self.redirect(self.get_app_url())
