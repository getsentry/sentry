from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any
from urllib.parse import quote, unquote, urlencode, urlparse

from django.utils.translation import gettext_lazy as _

from sentry import options
from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidIdentity
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.cursor_origin.client import (
    CursorOriginApiClient,
    CursorOriginSetupApiClient,
)
from sentry.integrations.cursor_origin.constants import (
    CURSOR_ORIGIN_INSTALL_URL,
    CURSOR_ORIGIN_SCOPES,
    CURSOR_ORIGIN_WEB_BASE_URL,
)
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.repository.model import RpcRepository
from sentry.integrations.source_code_management.repo_trees import RepoTreesIntegration
from sentry.integrations.source_code_management.repository import (
    HaltReason,
    RepositoryInfo,
    RepositoryIntegration,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.repository import Repository
from sentry.pipeline.views.base import ApiPipelineSteps
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiPaginationTruncated,
    IntegrationError,
)

logger = logging.getLogger("sentry.integrations.cursor_origin")


class CursorOriginIntegration(RepositoryIntegration[CursorOriginApiClient], RepoTreesIntegration):
    codeowners_locations = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"]

    @property
    def integration_name(self) -> str:
        return IntegrationProviderSlug.CURSOR_ORIGIN.value

    @property
    def repo_search(self) -> bool:
        return False

    def get_client(self) -> CursorOriginApiClient:
        return CursorOriginApiClient(
            integration=self.model, org_integration_id=self.org_integration.id
        )

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

        The remaining keyword arguments exist for base-class compatibility. Origin has no
        search endpoint, so `query` filters locally.
        """

        def to_repository_info(raw: list[dict[str, Any]]) -> list[RepositoryInfo]:
            return [
                {
                    "name": repo["fullName"],
                    "identifier": repo["fullName"],
                    "external_id": self.get_repo_external_id(repo),
                    "default_branch": repo["defaultBranch"],
                }
                for repo in raw
            ]

        try:
            raw_repos = self.get_client().get_repositories()
        except ApiPaginationTruncated as e:
            if raise_on_page_limit:
                raise ApiPaginationTruncated(to_repository_info(e.partial_data)) from e
            raw_repos = e.partial_data
        except ApiError as e:
            logger.info("cursor_origin.get_repositories.error", extra={"error": str(e)})
            self.raise_error(e)

        repos = to_repository_info(raw_repos)

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

    def is_rate_limited_error(self, exc: ApiError) -> bool:
        return exc.code == 429

    def is_broken_integration_error(self, exc: Exception) -> HaltReason | None:
        if isinstance(exc, ApiError) and exc.url and "access_tokens" in exc.url:
            if self.is_rate_limited_error(exc):
                return "rate_limited"
            if exc.code in (401, 403, 404):
                return "installation_suspended"

        # raise_error converts a 401 into InvalidIdentity, which the base class does not
        # unwrap the way it unwraps IntegrationError.
        if isinstance(exc, InvalidIdentity) and isinstance(exc.__context__, Exception):
            return self.is_broken_integration_error(exc.__context__)

        return super().is_broken_integration_error(exc)

    def source_url_matches(self, url: str) -> bool:
        domain = self.model.metadata["domain_name"]
        return url == domain or url.startswith(f"{domain}/")

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        branch = branch or repo.config["default_branch"]
        return (
            f"{CURSOR_ORIGIN_WEB_BASE_URL}/{quote(repo.name)}/blob/"
            f"{quote(branch, safe='')}/{quote(filepath)}"
        )

    def encode_source_url(self, url: str) -> str:
        return url

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        return unquote(self._split_blob_url(repo, url)[0])

    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        return unquote(self._split_blob_url(repo, url)[1])

    def _split_blob_url(self, repo: Repository, url: str) -> tuple[str, str]:
        prefix = f"{urlparse(CURSOR_ORIGIN_WEB_BASE_URL).path}/{quote(repo.name)}/blob/"
        path = urlparse(url).path
        if not path.startswith(prefix):
            return "", ""
        branch, _, filepath = path[len(prefix) :].partition("/")
        return branch, filepath

    def uninstall(self) -> None:
        """Remove the installation on Origin; a failure must not block disconnecting."""
        from sentry.integrations.services.integration import integration_service

        # One Origin installation can serve several Sentry organizations. Deleting it
        # while another still uses it would stop that one minting tokens.
        org_integrations = integration_service.get_organization_integrations(
            integration_id=self.model.id,
            providers=[IntegrationProviderSlug.CURSOR_ORIGIN.value],
        )
        active = [
            oi
            for oi in org_integrations
            if oi.status not in (ObjectStatus.PENDING_DELETION, ObjectStatus.DELETION_IN_PROGRESS)
        ]
        if len(active) > 1:
            return

        installation_id = self.model.external_id
        try:
            CursorOriginSetupApiClient().delete_installation(installation_id)
        except ApiError as e:
            if e.code == 404:
                # Already gone on Origin's side.
                return
            logger.warning(
                "cursor_origin.uninstall.failed",
                extra={"installation_id": installation_id, "status": e.code},
            )
        except Exception:
            # Includes an app whose signing key is no longer configured, which raises
            # before the request is even made.
            logger.exception(
                "cursor_origin.uninstall.failed", extra={"installation_id": installation_id}
            )


DESCRIPTION = """
Connect your Cursor Origin repositories to Sentry. Origin is SpaceXAI's git forge --
linking it lets Sentry suggest the right platform when you create a project and map
stack traces back to source.
"""

FEATURES = [
    FeatureDescription(
        """
        Add your Origin repositories to Sentry to tie issues back to the code they come
        from.
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


class CursorOriginIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.CURSOR_ORIGIN.value
    name = "Cursor Origin"
    metadata = metadata
    integration_cls = CursorOriginIntegration

    # Origin's install redirect returns the installation directly, so unlike GitHub
    # there is no separate OAuth identity to link.
    needs_default_identity = False

    features = frozenset([IntegrationFeatures.COMMITS, IntegrationFeatures.STACKTRACE_LINK])

    requires_feature_flag = True

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        from sentry.integrations.cursor_origin.pipeline import CursorOriginInstallApiStep

        return [CursorOriginInstallApiStep()]

    def get_initial_data_serializer_cls(self) -> type:
        from sentry.integrations.cursor_origin.pipeline import ExternalInstallSerializer

        return ExternalInstallSerializer

    def build_integration(self, state: Mapping[str, str]) -> IntegrationData:
        installation_id = state["installation_id"]

        try:
            installation = CursorOriginSetupApiClient().get_installation(installation_id)
        except ApiError as e:
            raise IntegrationError(f"Could not read the Cursor Origin installation: {e}")

        name = installation["target"]["slug"]

        return {
            "name": name,
            "external_id": installation_id,
            "metadata": {
                "installation_id": installation_id,
                "target": installation["target"],
                "scopes": installation["scopes"],
                "repo_selection_mode": installation["repoSelectionMode"],
                "domain_name": f"{CURSOR_ORIGIN_WEB_BASE_URL}/{name}",
            },
        }

    def setup(self) -> None:
        from sentry.plugins.base import bindings

        from .repository import CursorOriginRepositoryProvider

        bindings.add(
            "integration-repository.provider",
            CursorOriginRepositoryProvider,
            id=f"integrations:{self.key}",
        )


def build_install_url(state: str, redirect_uri: str, scopes: Sequence[str] | None = None) -> str:
    """Where a workspace admin is sent to grant the app access to their codebase."""
    return f"{CURSOR_ORIGIN_INSTALL_URL}?" + urlencode(
        {
            "client_id": options.get("cursor-origin-app.id"),
            "scope": " ".join(scopes or CURSOR_ORIGIN_SCOPES),
            "redirect_uri": redirect_uri,
            "state": state,
        },
        quote_via=quote,
    )
