from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any
from urllib.parse import quote, urlencode

from django.utils.translation import gettext_lazy as _

from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.cursor_origin.client import CursorOriginSetupApiClient
from sentry.integrations.cursor_origin.constants import (
    CURSOR_ORIGIN_INSTALL_URL,
    CURSOR_ORIGIN_SCOPES,
    CURSOR_ORIGIN_WEB_BASE_URL,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.repository.model import RpcRepository
from sentry.integrations.source_code_management.repo_trees import RepoTreesIntegration
from sentry.integrations.source_code_management.repository import (
    RepositoryInfo,
    RepositoryIntegration,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganizationSummary
from sentry.pipeline.views.base import ApiPipelineSteps
from sentry.shared_integrations.exceptions import ApiError, IntegrationError

logger = logging.getLogger("sentry.integrations.cursor_origin")

DESCRIPTION = """
Connect your Cursor Origin repositories to Sentry. Origin is Cursor's git forge --
linking it lets Sentry suggest the right platform when you create a project, map
stack traces back to source, and give Seer access to your code.
"""

FEATURES = [
    FeatureDescription(
        """
        Suggest the right platform for a new project by inspecting the repository you
        pick during onboarding.
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Link stack traces directly to source code in Origin.
        """,
        IntegrationFeatures.STACKTRACE_LINK,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="Sentry",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/cursor_origin",
    aspects={},
)


class CursorOriginIntegration(
    RepositoryIntegration[CursorOriginSetupApiClient], RepoTreesIntegration
):
    codeowners_locations = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"]

    @property
    def integration_name(self) -> str:
        return IntegrationProviderSlug.CURSOR_ORIGIN.value

    def get_client(self) -> CursorOriginSetupApiClient:
        installation_id = self.model.external_id
        return CursorOriginSetupApiClient(installation_id=installation_id)

    # -- repositories --------------------------------------------------------

    def get_repo_external_id(self, repo: Mapping[str, Any]) -> str:
        return str(repo["id"])

    def get_repositories(
        self,
        query: str | None = None,
        page_number_limit: int | None = None,
        accessible_only: bool = False,
        use_cache: bool = False,
        raise_on_page_limit: bool = False,
        parallel: bool = False,
    ) -> list[RepositoryInfo]:
        """Repositories this installation can see.

        Origin has no repository search endpoint, so `query` is applied locally.
        The extra keyword arguments exist for base-class compatibility and are
        ignored -- the installation repo list is small enough to always fetch whole.
        """
        try:
            raw_repos = self.get_client().get_repositories()
        except ApiError as e:
            logger.info("cursor_origin.get_repositories.error", extra={"error": str(e)})
            return []

        repos: list[RepositoryInfo] = [
            {
                "name": repo["fullName"],
                "identifier": repo["fullName"],
                "external_id": str(repo["id"]),
                "default_branch": repo.get("defaultBranch"),
            }
            for repo in raw_repos
        ]

        if query:
            lowered = query.lower()
            repos = [repo for repo in repos if lowered in repo["name"].lower()]

        return repos

    def has_repo_access(self, repo: RpcRepository) -> bool:
        try:
            self.get_client().get_repo(repo.name)
        except ApiError:
            return False
        return True

    # -- stacktrace linking --------------------------------------------------

    def source_url_matches(self, url: str) -> bool:
        return url.startswith(CURSOR_ORIGIN_WEB_BASE_URL)

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        branch = branch or repo.config.get("default_branch") or "main"
        return f"{CURSOR_ORIGIN_WEB_BASE_URL}/{repo.name}/blob/{branch}/{quote(filepath)}"

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        prefix = f"{CURSOR_ORIGIN_WEB_BASE_URL}/{repo.name}/blob/"
        return url.replace(prefix, "").split("/")[0]

    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        prefix = f"{CURSOR_ORIGIN_WEB_BASE_URL}/{repo.name}/blob/"
        branch = self.extract_branch_from_source_url(repo, url)
        return url.replace(f"{prefix}{branch}/", "")


class CursorOriginIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.CURSOR_ORIGIN.value
    name = "Cursor Origin"
    metadata = metadata
    integration_cls = CursorOriginIntegration

    # Origin's install redirect hands back the installation directly, so unlike
    # GitHub there is no separate OAuth identity to link.
    needs_default_identity = False

    features = frozenset([IntegrationFeatures.COMMITS, IntegrationFeatures.STACKTRACE_LINK])

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        from sentry.integrations.cursor_origin.pipeline import CursorOriginInstallApiStep

        return [CursorOriginInstallApiStep()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        installation_id = state.get("installation_id")
        if not installation_id:
            raise IntegrationError("Cursor Origin did not return an installation.")

        client = CursorOriginSetupApiClient(installation_id=installation_id)
        try:
            installation = client.get_installation(installation_id)
        except ApiError as e:
            raise IntegrationError(f"Could not read the Cursor Origin installation: {e}")

        account = installation.get("account") or {}
        name = account.get("slug") or installation.get("ownerSlug") or installation_id

        return {
            "name": name,
            "external_id": installation_id,
            "metadata": {
                "installation_id": installation_id,
                "account": account,
                "domain_name": f"{CURSOR_ORIGIN_WEB_BASE_URL}/{name}",
            },
        }

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganizationSummary,
        *,
        extra: Mapping[str, Any],
    ) -> None:
        from sentry.integrations.github.tasks.link_all_repos import link_all_repos

        link_all_repos.apply_async(
            kwargs={
                "integration_key": self.key,
                "integration_id": integration.id,
                "organization_id": organization.id,
            }
        )

    def setup(self) -> None:
        from sentry.plugins.base import bindings

        from .repository import CursorOriginRepositoryProvider

        bindings.add(
            "integration-repository.provider",
            CursorOriginRepositoryProvider,
            id=f"integrations:{self.key}",
        )


def build_install_url(state: str, redirect_uri: str, scopes: Sequence[str] | None = None) -> str:
    """Where the user is sent to grant the app access to their codebase."""
    return f"{CURSOR_ORIGIN_INSTALL_URL}?" + urlencode(
        {
            "client_id": _app_id(),
            "scope": " ".join(scopes or CURSOR_ORIGIN_SCOPES),
            "redirect_uri": redirect_uri,
            "state": state,
        },
        # Encode the scope separator as %20 rather than "+". Both decode to a
        # space, but Origin is new enough that it is not worth relying on the
        # form-encoding convention.
        quote_via=quote,
    )


def _app_id() -> str:
    from sentry import options

    return str(options.get("cursor-origin-app.id"))
