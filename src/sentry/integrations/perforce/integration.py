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
from sentry.shared_integrations.exceptions import ApiError, IntegrationError

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
        if self._client is not None:
            return self._client

        if not self.org_integration:
            raise IntegrationError("Organization Integration not found")

        # Credentials are stored in org_integration.config (per-organization)
        config = self.org_integration.config
        auth_mode = config.get("auth_mode", "password")

        if auth_mode == "ticket":
            # Ticket authentication mode
            self._client = PerforceClient(
                ticket=config.get("ticket"),
                client=config.get("client"),
            )
        else:
            # Password authentication mode
            self._client = PerforceClient(
                host=config.get("host", "localhost"),
                port=config.get("port", 1666),
                user=config.get("user", ""),
                password=config.get("password"),
                client=config.get("client"),
            )
        return self._client

    def on_create_or_update_comment_error(self, api_error: ApiError, metrics_base: str) -> bool:
        """
        Handle errors from PR comment operations.
        Perforce doesn't have native pull requests, so this always returns False.
        """
        return False

    def source_url_matches(self, url: str) -> bool:
        """Check if URL is from this Perforce server."""
        if url.startswith("p4://"):
            return True

        if self.org_integration:
            web_url = self.org_integration.config.get("web_url")
            if web_url and url.startswith(web_url):
                return True

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
        try:
            client = self.get_client()
            # Use client's check_file to verify file exists on P4 server
            result = client.check_file(repo, filepath, branch)
            if result is None:
                return None
            # File exists, return formatted URL
            return self.format_source_url(repo, filepath, branch)
        except Exception:
            # If any error occurs (auth, connection, etc), return None
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
        # Handle absolute depot paths (from SRCSRV transformer)
        if filepath.startswith("//"):
            full_path = filepath
        else:
            # Relative path - prepend depot_path
            depot_path = repo.config.get("depot_path", repo.name).rstrip("/")

            # Handle Perforce streams: if branch/stream is specified, insert after depot
            # Format: //depot/stream/path/to/file
            if branch:
                # depot_path is like "//depot", branch is like "main"
                # Result should be "//depot/main/path/to/file"
                full_path = f"{depot_path}/{branch}/{filepath.lstrip('/')}"
            else:
                filepath = filepath.lstrip("/")
                full_path = f"{depot_path}/{filepath}"

        # If web viewer is configured, use it
        web_url = None
        viewer_type = "swarm"
        if self.org_integration:
            web_url = self.org_integration.config.get("web_url")
            viewer_type = self.org_integration.config.get("web_viewer_type", "swarm")

        if web_url:

            # Extract revision from filepath if present (e.g., "file.cpp@42")
            revision = None
            path_without_rev = full_path
            if "@" in full_path:
                path_without_rev, revision = full_path.rsplit("@", 1)

            if viewer_type == "swarm":
                # Swarm format: /files/<depot_path>?v=<revision>
                if revision:
                    return f"{web_url}/files{path_without_rev}?v={revision}"
                return f"{web_url}/files{full_path}"
            elif viewer_type == "p4web":
                # P4Web format: <depot_path>?ac=64&rev1=<revision>
                if revision:
                    return f"{web_url}{path_without_rev}?ac=64&rev1={revision}"
                return f"{web_url}{full_path}?ac=64"

        # Default: p4:// protocol URL
        # Perforce uses @ for revisions, which is already in the filepath from Symbolic
        # Strip leading // from full_path to avoid p4:////
        return f"p4://{full_path.lstrip('/')}"

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
        depot_path = repo.config.get("depot_path", repo.name)

        # Remove p4:// prefix
        if url.startswith("p4://"):
            url = url[5:]

        # Remove revision specifier (#revision)
        if "#" in url:
            url = url.split("#")[0]

        # Remove query parameters (for web viewers)
        if "?" in url:
            url = url.split("?")[0]

        # Remove depot prefix to get relative path
        if url.startswith(depot_path):
            return url[len(depot_path) :].lstrip("/")

        return url

    def get_repositories(
        self, query: str | None = None, page_number_limit: int | None = None
    ) -> list[dict[str, Any]]:
        """
        Get list of depots/streams from Perforce server.

        Returns:
            List of repository dictionaries
        """
        try:
            client = self.get_client()
            depots = client.get_depots()

            repositories = []
            for depot in depots:
                depot_name = depot["name"]
                depot_path = f"//{depot_name}"

                # Filter by query if provided
                if query and query.lower() not in depot_name.lower():
                    continue

                repositories.append(
                    {
                        "name": depot_name,
                        "identifier": depot_path,
                        "default_branch": None,  # Perforce uses depot paths, not branch refs
                    }
                )

            return repositories

        except ApiError:
            # Re-raise authentication/connection errors so user sees them
            raise
        except Exception as e:
            logger.exception("perforce.get_repositories_failed")
            raise IntegrationError(f"Failed to fetch repositories from Perforce: {str(e)}")

    def has_repo_access(self, repo: RpcRepository) -> bool:
        """Check if integration can access the depot."""
        try:
            client = self.get_client()
            depot_path = repo.config.get("depot_path", repo.name)

            # Try to list files to verify access
            result = client.check_file(
                repo=type("obj", (object,), {"config": {"depot_path": depot_path}})(),
                path="...",
                version=None,
            )

            return result is not None

        except Exception:
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
                "name": "auth_mode",
                "type": "choice",
                "label": "Authentication Mode",
                "choices": [
                    ["password", "Username & Password"],
                    ["ticket", "P4 Ticket"],
                ],
                "help": "Choose how to authenticate with Perforce. P4 tickets are more secure and don't require storing passwords.",
                "required": True,
                "default": "password",
            },
            {
                "name": "ticket",
                "type": "secret",
                "label": "P4 Ticket",
                "placeholder": "••••••••••••••••••••••••••••••••",
                "help": "P4 authentication ticket (obtained via 'p4 login -p'). Tickets contain server/user info and are more secure than passwords.",
                "required": False,
                "depends_on": {"auth_mode": "ticket"},
            },
            {
                "name": "host",
                "type": "string",
                "label": "Perforce Server Host",
                "placeholder": "perforce.company.com",
                "help": "The hostname or IP address of your Perforce server",
                "required": False,
                "depends_on": {"auth_mode": "password"},
            },
            {
                "name": "port",
                "type": "number",
                "label": "Perforce Server Port",
                "placeholder": "1666",
                "help": "The port number for your Perforce server (default: 1666)",
                "required": False,
                "default": "1666",
                "depends_on": {"auth_mode": "password"},
            },
            {
                "name": "user",
                "type": "string",
                "label": "Perforce Username",
                "placeholder": "sentry-bot",
                "help": "Username for authenticating with Perforce",
                "required": False,
                "depends_on": {"auth_mode": "password"},
            },
            {
                "name": "password",
                "type": "secret",
                "label": "Perforce Password",
                "placeholder": "••••••••",
                "help": "Password for the Perforce user",
                "required": False,
                "depends_on": {"auth_mode": "password"},
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
                "name": "web_viewer_type",
                "type": "choice",
                "label": "Web Viewer Type",
                "choices": [
                    ["p4web", "P4Web"],
                    ["swarm", "Helix Swarm"],
                    ["other", "Other"],
                ],
                "help": "Type of web viewer (if web URL is provided)",
                "required": False,
                "default": "p4web",
            },
            {
                "name": "web_url",
                "type": "string",
                "label": "Web Viewer URL (Optional)",
                "placeholder": "https://p4web.company.com",
                "help": "Optional: URL to P4Web, Swarm, or other web-based Perforce viewer",
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
        return {
            "name": state.get("name", f"Perforce ({state['host']})"),
            "external_id": f"{state['host']}:{state['port']}",
            "metadata": {
                "host": state["host"],
                "port": state["port"],
                "user": state["user"],
                "password": state.get("password"),
                "client": state.get("client"),
                "ssl_fingerprint": state.get("ssl_fingerprint"),
                "web_url": state.get("web_url"),
                "web_viewer_type": state.get("web_viewer_type", "p4web"),
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
        # Set some default values that users will configure later
        pipeline.bind_state("host", "localhost")
        pipeline.bind_state("port", "1666")
        pipeline.bind_state("user", "")
        pipeline.bind_state("name", "Perforce Integration")

        return pipeline.next_step()
