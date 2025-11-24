from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
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
View source code directly from error stack traces and identify suspect commits that
may have introduced issues.
"""

FEATURES = [
    FeatureDescription(
        """
        Link your Sentry stack traces back to your Perforce depot files with support
        for Helix Swarm web viewer. Automatically maps error locations to
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

    def __init__(
        self,
        model: Integration,
        organization_id: int,
    ):
        super().__init__(model=model, organization_id=organization_id)
        self._client: PerforceClient | None = None

    def get_client(self) -> PerforceClient:
        """Get the Perforce client instance."""
        if self._client is None:
            self._client = PerforceClient()
        return self._client

    def on_create_or_update_comment_error(self, api_error: ApiError, metrics_base: str) -> bool:
        """
        Handle errors from PR comment operations.
        Perforce doesn't have native pull requests, so this always returns False.
        """
        return False

    def source_url_matches(self, url: str) -> bool:
        """Check if URL is from this Perforce server."""
        return False

    def check_file(self, repo: Repository, filepath: str, branch: str | None = None) -> str | None:
        """
        Check if a file exists in the Perforce depot and return the URL.

        Uses the client's check_file method to verify file existence on the P4 server.

        Args:
            repo: Repository object
            filepath: File path (may be absolute depot path or relative path)
            branch: Branch/stream name (optional)

        Returns:
            Formatted URL if the file exists, None otherwise
        """
        return None

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        """
        Format source URL for stacktrace linking.

        The Symbolic transformer includes revision info directly in the filepath
        using Perforce's file revision syntax (e.g., "processor.cpp#1").

        Args:
            repo: Repository object
            filepath: File path, may include #revision (e.g., "app/file.cpp#1")
            branch: Stream name (e.g., "main", "dev") to be inserted after depot path.
                   For Perforce streams: //depot/stream/path/to/file

        Returns:
            Formatted URL (p4:// or Swarm web viewer URL)
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

    def get_organization_config(self) -> list[dict[str, Any]]:
        """
        Get configuration form fields for organization-level settings.
        These fields will be displayed in the integration settings UI.
        """
        return [
            {
                "name": "p4port",
                "type": "string",
                "label": "P4PORT (Server Address)",
                "placeholder": "ssl:perforce.company.com:1666",
                "help": "Perforce server address in P4PORT format. Examples: 'ssl:perforce.company.com:1666' (encrypted), 'perforce.company.com:1666' or 'tcp:perforce.company.com:1666' (plaintext). SSL is strongly recommended for production use.",
                "required": True,
            },
            {
                "name": "user",
                "type": "string",
                "label": "Perforce Username",
                "placeholder": "sentry-bot",
                "help": "Username for authenticating with Perforce. Required for both password and ticket authentication.",
                "required": True,
            },
            {
                "name": "password",
                "type": "secret",
                "label": "Password or P4 Ticket",
                "placeholder": "••••••••",
                "help": "Perforce password OR P4 authentication ticket. Tickets are obtained via 'p4 login -p' and are more secure than passwords. Both are supported in this field.",
                "required": True,
            },
            {
                "name": "ssl_fingerprint",
                "type": "string",
                "label": "SSL Fingerprint (Required for SSL)",
                "placeholder": "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01",
                "help": "SSL fingerprint for secure connections. Required when using 'ssl:' protocol. Obtain with: p4 -p ssl:host:port trust -y",
                "required": False,
            },
            {
                "name": "client",
                "type": "string",
                "label": "Perforce Client/Workspace (Optional)",
                "placeholder": "sentry-workspace",
                "help": "Optional: Specify a client workspace name",
                "required": False,
            },
            {
                "name": "web_url",
                "type": "string",
                "label": "Helix Swarm URL (Optional)",
                "placeholder": "https://swarm.company.com",
                "help": "Optional: URL to Helix Swarm web viewer for browsing files",
                "required": False,
            },
        ]


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
        ]
    )
    requires_feature_flag = True

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
        # Use p4port if available, otherwise fall back to host:port for legacy
        p4port = (
            state.get("p4port") or f"{state.get('host', 'localhost')}:{state.get('port', '1666')}"
        )

        return {
            "name": state.get("name", f"Perforce ({p4port})"),
            "external_id": p4port,
            "metadata": {
                "p4port": p4port,
                "user": state.get("user"),
                "password": state.get("password"),
                "client": state.get("client"),
                "ssl_fingerprint": state.get("ssl_fingerprint"),
                "web_url": state.get("web_url"),
            },
        }

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
        from sentry.plugins.base import bindings

        from .repository import PerforceRepositoryProvider

        bindings.add(
            "integration-repository.provider",
            PerforceRepositoryProvider,
            id="integrations:perforce",
        )


class PerforceInstallationView:
    """
    Installation view for Perforce configuration.

    This is a simple pass-through view. The actual configuration
    happens in the Settings tab after installation via get_organization_config().
    """

    def dispatch(self, request, pipeline):
        """
        Handle installation request.
        Args:
            request: HTTP request object
            pipeline: Installation pipeline
        """
        return pipeline.next_step()
