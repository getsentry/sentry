from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from django.utils.translation import gettext_lazy as _

from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.perforce.client import PerforceClient
from sentry.integrations.services.repository import RpcRepository
from sentry.integrations.source_code_management.commit_context import CommitContextIntegration
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.pipeline.views.base import PipelineView
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger(__name__)

DESCRIPTION = """
Connect your Sentry organization to your Perforce/Helix Core server to enable
stacktrace linking, commit tracking, suspect commit detection, and code ownership.
View source code directly from error stack traces, identify suspect commits that
may have introduced issues, and automatically determine code owners using Perforce
annotate (blame) information.
"""

FEATURES = [
    FeatureDescription(
        """
        Link your Sentry stack traces back to your Perforce depot files with support
        for P4Web and Helix Swarm web viewers. Automatically maps error locations to
        source code using configurable code mappings.
        """,
        IntegrationFeatures.STACKTRACE_LINK,
    ),
    FeatureDescription(
        """
        Track commits and changelists from your Perforce depots. Browse and add
        depots to your Sentry projects for comprehensive source code integration.
        Suspect commits are automatically identified by analyzing which changelists
        modified the code where errors occur.
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Import your Perforce CODEOWNERS file and use it alongside your ownership rules
        to assign Sentry issues. Uses Perforce annotate to identify code owners based
        on who last modified each line.
        """,
        IntegrationFeatures.CODEOWNERS,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="Sentry",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/perforce",
    aspects={
        "alerts": [],
        "configure_integration": {"title": "Configure your Perforce server connection"},
    },
)


class PerforceIntegration(RepositoryIntegration, CommitContextIntegration):
    """
    Integration for Perforce/Helix Core version control system.
    Provides stacktrace linking to depot files and suspect commit detection.
    """

    integration_name = "perforce"
    codeowners_locations = ["CODEOWNERS", ".perforce/CODEOWNERS", "docs/CODEOWNERS"]

    def __init__(
        self,
        model: Integration,
        organization_id: int,
    ):
        super().__init__(model=model, organization_id=organization_id)
        self._client: PerforceClient | None = None

    def get_client(self) -> PerforceClient:
        """Get the Perforce client instance."""
        raise NotImplementedError

    def on_create_or_update_comment_error(self, api_error: ApiError, metrics_base: str) -> bool:
        """
        Handle errors from PR comment operations.
        Perforce doesn't have native pull requests, so this always returns False.
        """
        return False

    def source_url_matches(self, url: str) -> bool:
        """Check if URL is from this Perforce server."""
        return False

    def matches_repository_depot_path(self, repo: Repository, filepath: str) -> bool:
        """
        Check if a file path matches this repository's depot path.

        When SRCSRV transformers remap paths to absolute depot paths (e.g.,
        //depot/project/src/file.cpp), this method verifies that the depot path
        matches the repository's configured depot_path.

        Args:
            repo: Repository object
            filepath: File path (may be absolute depot path or relative path)

        Returns:
            True if the filepath matches this repository's depot
        """
        return False

    def check_file(self, repo: Repository, filepath: str, branch: str | None = None) -> str | None:
        """
        Check if a filepath belongs to this Perforce repository and return the URL.

        Perforce doesn't have a REST API to check file existence, so we just
        verify the filepath matches the depot_path configuration and return
        the formatted URL.

        Args:
            repo: Repository object
            filepath: File path (may be absolute depot path or relative path)
            branch: Branch/stream name (optional)

        Returns:
            Formatted URL if the filepath matches this repository, None otherwise
        """
        return None

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        """
        Format source URL for stacktrace linking.

        The Symbolic transformer includes revision info directly in the filepath
        using Perforce's native @revision syntax (e.g., "processor.cpp@42").

        Args:
            repo: Repository object
            filepath: File path, may include @revision (e.g., "app/file.cpp@42")
            branch: Stream name (e.g., "main", "dev") to be inserted after depot path.
                   For Perforce streams: //depot/stream/path/to/file

        Returns:
            Formatted URL (p4:// or web viewer URL)
        """
        return ""

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        """
        Extract branch/stream from URL.
        For Perforce, streams are part of the depot path, not separate refs.
        Returns empty string as we don't use branch refs.
        """
        return ""

    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        """
        Extract file path from URL, removing revision specifiers.

        Handles URLs with revisions like:
        - p4://depot/path/file.cpp#42
        - https://swarm/files//depot/path/file.cpp?v=42

        Returns just the file path without revision info.
        """
        return ""

    def get_repositories(
        self, query: str | None = None, page_number_limit: int | None = None
    ) -> list[dict[str, Any]]:
        """
        Get list of depots/streams from Perforce server.

        Returns:
            List of repository dictionaries
        """
        return []

    def has_repo_access(self, repo: RpcRepository) -> bool:
        """Check if integration can access the depot."""
        return False

    def get_unmigratable_repositories(self) -> list[RpcRepository]:
        """Get repositories that can't be migrated. Perforce doesn't need migration."""
        return []

    def test_connection(self) -> dict[str, Any]:
        """
        Test the Perforce connection with current credentials.

        Returns:
            Dictionary with connection status and server info
        """
        return {}

    def get_organization_config(self) -> list[dict[str, Any]]:
        """
        Get configuration form fields for organization-level settings.
        These fields will be displayed in the integration settings UI.
        """
        return []

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        """
        Update organization config and optionally validate credentials.
        Only tests connection when password or ticket is changed to avoid annoying
        validations on every field blur.
        """
        pass


class PerforceIntegrationProvider(IntegrationProvider):
    """Provider for Perforce integration."""

    key = "perforce"
    name = "Perforce"
    metadata = metadata
    integration_cls = PerforceIntegration
    features = frozenset(
        [
            IntegrationFeatures.STACKTRACE_LINK,
            IntegrationFeatures.COMMITS,
            IntegrationFeatures.CODEOWNERS,
        ]
    )

    def get_pipeline_views(self) -> Sequence[PipelineView]:
        """Get pipeline views for installation flow."""
        return [PerforceInstallationView()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        """
        Build integration data from installation state.

        Args:
            state: Installation state from pipeline

        Returns:
            Integration data dictionary
        """
        return {"external_id": ""}

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganization,
        *,
        extra: dict[str, Any],
    ) -> None:
        """Actions after installation."""
        pass

    def setup(self) -> None:
        """Setup integration provider."""
        pass


class PerforceInstallationView:
    """
    Installation view for Perforce configuration.

    This is a simple pass-through view. The actual configuration
    happens in the Settings tab after installation via get_organization_config().
    """

    def dispatch(self, request, pipeline):
        """
        Handle installation request.

        Since Perforce doesn't use OAuth and configuration is done through
        the Settings form, we just pass through to create the integration.
        Users will configure P4 server details in the Settings tab.
        """
        pass
