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
        auth_mode = metadata.get("auth_mode", "password")

        if auth_mode == "ticket":
            # Ticket authentication mode
            self._client = PerforceClient(
                ticket=metadata.get("ticket"),
                client=metadata.get("client"),
            )
        else:
            # Password authentication mode
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
        TODO: How to integrate this with Swarm?
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
        depot_path = repo.config.get("depot_path", repo.name)

        # If filepath is absolute depot path, check if it starts with depot_path
        if filepath.startswith("//"):
            return filepath.startswith(depot_path)

        # Relative paths always match (will be prepended with depot_path)
        return True

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        """
        Format source URL for stacktrace linking with revision support.

        When the transformer remaps paths using SRCSRV data, it stores the revision
        in the branch parameter as "revision:<number>". This method extracts that
        revision and includes it in the generated URL.

        Args:
            repo: Repository object
            filepath: File path (can be depot path or relative path)
            branch: Revision info in format "revision:<number>" or None

        Returns:
            Formatted URL (p4:// or web viewer URL) with revision anchor
        """
        # Extract revision from branch if present (from SRCSRV transformer)
        revision = None
        if branch and branch.startswith("revision:"):
            revision = branch.split(":", 1)[1]

        # Handle absolute depot paths (from SRCSRV transformer)
        if filepath.startswith("//"):
            full_path = filepath
        else:
            # Relative path - prepend depot_path
            depot_path = repo.config.get("depot_path", repo.name)
            filepath = filepath.lstrip("/")
            full_path = f"{depot_path}/{filepath}"

        # Add revision specifier if available
        if revision:
            full_path_with_rev = f"{full_path}#{revision}"
        else:
            full_path_with_rev = full_path

        # If web viewer is configured, use it
        web_url = self.model.metadata.get("web_url")
        if web_url:
            viewer_type = self.model.metadata.get("web_viewer_type", "p4web")

            if viewer_type == "swarm":
                # Swarm format: /files/<depot_path>?v=<revision>
                if revision:
                    return f"{web_url}/files{full_path}?v={revision}"
                return f"{web_url}/files{full_path}"
            elif viewer_type == "p4web":
                # P4Web format: <depot_path>?ac=64&rev1=<revision>
                if revision:
                    return f"{web_url}{full_path}?ac=64&rev1={revision}"
                return f"{web_url}{full_path}?ac=64"

        # Default: p4:// protocol URL with revision
        return f"p4://{full_path_with_rev}"

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        """
        TODO: How to do that?
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

    def update_organization_config(self, data: Mapping[str, Any]) -> None:
        """
        Update organization config and optionally validate credentials.
        Only tests connection when password or ticket is changed to avoid annoying
        validations on every field blur.
        """
        from sentry.integrations.services.integration import integration_service

        # Check if credentials are being updated
        password_changed = "password" in data
        ticket_changed = "ticket" in data
        credentials_changed = password_changed or ticket_changed

        # First update the integration metadata with new credentials
        if self.model:
            metadata = dict(self.model.metadata or {})

            # Update metadata with any provided fields
            for key in [
                "auth_mode",
                "host",
                "port",
                "user",
                "password",
                "ticket",
                "client",
                "web_url",
                "web_viewer_type",
            ]:
                if key in data:
                    metadata[key] = data[key]

            integration_service.update_integration(integration_id=self.model.id, metadata=metadata)

            # Clear cached client when credentials change
            if credentials_changed:
                self._client = None

        # Only test connection if password or ticket was changed
        if credentials_changed:
            try:
                result = self.test_connection()
                if result["status"] != "success":
                    raise IntegrationError(f"Connection test failed: {result['message']}")
            except Exception as e:
                logger.exception("perforce.credentials_validation_failed")
                raise IntegrationError(
                    f"Failed to connect to Perforce server with provided credentials: {str(e)}"
                )

        # Call parent to update org integration config
        super().update_organization_config(data)


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
