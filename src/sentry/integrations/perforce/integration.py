from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from django.utils.translation import gettext_lazy as _

from sentry.integrations.base import (
    FeatureDescription,
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
        if self._client is not None:
            return self._client

        if not self.model:
            raise IntegrationError("Integration model not found")

        metadata = self.model.metadata
        self._client = PerforceClient(
            host=metadata.get("host", "localhost"),
            port=metadata.get("port", 1666),
            user=metadata.get("user", ""),
            password=metadata.get("password"),
            client=metadata.get("client"),
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

        web_url = self.model.metadata.get("web_url")
        if web_url and url.startswith(web_url):
            return True

        return False

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        """
        Format source URL for stacktrace linking.

        Args:
            repo: Repository object
            filepath: File path relative to depot root
            branch: Changelist number (version)

        Returns:
            Formatted URL (p4:// or web viewer URL)
        """
        depot_path = repo.config.get("depot_path", repo.name)
        filepath = filepath.lstrip("/")
        full_path = f"{depot_path}/{filepath}"

        if branch:
            full_path = f"{full_path}@{branch}"

        # If web viewer is configured, use it
        web_url = self.model.metadata.get("web_url")
        if web_url:
            # Common formats: P4Web, Swarm, etc.
            # P4Web: http://server:8080/depot/path?ac=64&rev=123
            # Swarm: http://server/files/depot/path?v=123
            viewer_type = self.model.metadata.get("web_viewer_type", "p4web")

            if viewer_type == "swarm":
                return f"{web_url}/files{full_path}"
            elif viewer_type == "p4web":
                if branch:
                    return f"{web_url}{full_path.replace('@', '?ac=64&rev=')}"
                return f"{web_url}{full_path}?ac=64"

        # Default: p4:// protocol URL
        return f"p4://{full_path}"

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        """Extract changelist number from URL."""
        # From p4://depot/path@123 -> 123
        if "@" in url:
            return url.split("@")[-1]

        # From web URL query params
        if "rev=" in url:
            return url.split("rev=")[-1].split("&")[0]
        if "v=" in url:
            return url.split("v=")[-1].split("&")[0]

        return ""

    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        """Extract file path from URL."""
        depot_path = repo.config.get("depot_path", repo.name)

        # Remove p4:// prefix
        if url.startswith("p4://"):
            url = url[5:]

        # Remove @ version suffix
        if "@" in url:
            url = url.split("@")[0]

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
            logger.info("perforce.get_repositories", extra={"query": query})
            client = self.get_client()
            depots = client.get_depots()
            logger.info("perforce.get_repositories.fetched", extra={"depot_count": len(depots)})

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
                        "default_branch": "head",  # P4 uses @head for latest
                    }
                )

            logger.info(
                "perforce.get_repositories.success", extra={"repo_count": len(repositories)}
            )
            return repositories

        except Exception as e:
            logger.exception("perforce.get_repositories.error", extra={"error": str(e)})
            return []

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

        except Exception as e:
            logger.warning(
                "perforce.has_repo_access.failed", extra={"repo": repo.name, "error": str(e)}
            )
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
        try:
            client = self.get_client()
            info = client.get_depot_info()

            return {
                "status": "success",
                "message": f"Connected to Perforce server at {info.get('server_address')}",
                "server_info": info,
            }
        except Exception as e:
            logger.exception("perforce.test_connection.failed")
            return {
                "status": "error",
                "message": f"Failed to connect to Perforce server: {str(e)}",
                "error": str(e),
            }

    def get_organization_config(self) -> list[dict[str, Any]]:
        """
        Get configuration form fields for organization-level settings.
        These fields will be displayed in the integration settings UI.
        """
        return [
            {
                "name": "host",
                "type": "string",
                "label": "Perforce Server Host",
                "placeholder": "perforce.company.com",
                "help": "The hostname or IP address of your Perforce server",
                "required": True,
            },
            {
                "name": "port",
                "type": "number",
                "label": "Perforce Server Port",
                "placeholder": "1666",
                "help": "The port number for your Perforce server (default: 1666)",
                "required": True,
                "default": "1666",
            },
            {
                "name": "user",
                "type": "string",
                "label": "Perforce Username",
                "placeholder": "sentry-bot",
                "help": "Username for authenticating with Perforce",
                "required": True,
            },
            {
                "name": "password",
                "type": "secret",
                "label": "Perforce Password or Ticket",
                "placeholder": "••••••••",
                "help": "Password or authentication ticket for the Perforce user. For security, consider using a P4 ticket instead of a password.",
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
                "label": "Web Viewer URL (Optional)",
                "placeholder": "https://p4web.company.com",
                "help": "Optional: URL to P4Web, Swarm, or other web-based Perforce viewer",
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
            IntegrationFeatures.CODEOWNERS,
        ]
    )

    def get_pipeline_views(self) -> Sequence[PipelineView]:
        """Get pipeline views for installation flow."""
        return [PerforceInstallationView()]

    def build_integration(self, state: Mapping[str, Any]) -> dict[str, Any]:
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
        logger.info(
            "perforce.post_install",
            extra={
                "integration_id": integration.id,
                "organization_id": organization.id,
                "host": integration.metadata.get("host"),
            },
        )

    def setup(self) -> None:
        """Setup integration provider."""
        from sentry.plugins.base import bindings

        from .repository import PerforceRepositoryProvider

        logger.info("perforce.setup: Registering Perforce repository provider")
        bindings.add(
            "integration-repository.provider",
            PerforceRepositoryProvider,
            id="integrations:perforce",
        )
        logger.info("perforce.setup.complete: Perforce repository provider registered")


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
        # Set some default values that users will configure later
        pipeline.bind_state("host", "localhost")
        pipeline.bind_state("port", "1666")
        pipeline.bind_state("user", "")
        pipeline.bind_state("name", "Perforce Integration")

        return pipeline.next_step()
