from __future__ import annotations

import hashlib
import logging
from collections.abc import Mapping, Sequence
from typing import Any, TypedDict

from django import forms
from django.http import HttpRequest, HttpResponseBase
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
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.repository import RpcRepository
from sentry.integrations.source_code_management.commit_context import CommitContextIntegration
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.pipeline.views.base import PipelineView
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized, IntegrationError
from sentry.web.frontend.base import determine_active_organization
from sentry.web.helpers import render_to_response

logger = logging.getLogger(__name__)


class PerforceMetadata(TypedDict, total=False):
    """Type definition for Perforce integration metadata stored in Integration.metadata."""

    p4port: str
    user: str
    password: str
    auth_type: str
    client: str
    ssl_fingerprint: str
    web_url: str


DESCRIPTION = """
Connect your Sentry organization to your P4 Core server to enable
stacktrace linking, commit tracking, suspect commit detection, and code ownership.
View source code directly from error stack traces and identify suspect commits that
may have introduced issues.
"""

FEATURES = [
    FeatureDescription(
        """
        Link your Sentry stack traces back to your Perforce depot files with support
        for P4 Code Review viewer. Automatically maps error locations to
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


class PerforceInstallationForm(forms.Form):
    """Form for Perforce installation configuration."""

    p4port = forms.CharField(
        label=_("P4PORT (Server Address)"),
        help_text=_(
            "Perforce server address in P4PORT format. "
            "Examples: 'ssl:perforce.company.com:1666' (encrypted), "
            "'perforce.company.com:1666' or 'tcp:perforce.company.com:1666' (plaintext). "
            "SSL is strongly recommended for production use."
        ),
        widget=forms.TextInput(attrs={"placeholder": "ssl:perforce.company.com:1666"}),
    )
    user = forms.CharField(
        label=_("Perforce Username"),
        help_text=_(
            "Username for authenticating with Perforce. "
            "Required for both password and ticket authentication."
        ),
        widget=forms.TextInput(attrs={"placeholder": "sentry-bot"}),
    )
    auth_type = forms.ChoiceField(
        label=_("Authentication Type"),
        choices=[
            ("password", _("Password")),
            ("ticket", _("P4 Ticket")),
        ],
        initial="password",
        help_text=_(
            "Select whether you're providing a password or a P4 ticket. "
            "Tickets are obtained via 'p4 login -p' and don't require re-authentication."
        ),
    )
    password = forms.CharField(
        label=_("Password / Ticket"),
        help_text=_(
            "Your Perforce password or P4 authentication ticket "
            "(depending on the authentication type selected above)."
        ),
        widget=forms.PasswordInput(attrs={"placeholder": "••••••••"}),
    )
    client = forms.CharField(
        label=_("Perforce Client/Workspace (Optional)"),
        help_text=_("Optional: Specify a client workspace name"),
        widget=forms.TextInput(attrs={"placeholder": "sentry-workspace"}),
        required=False,
    )
    ssl_fingerprint = forms.CharField(
        label=_("SSL Fingerprint (Required for SSL)"),
        help_text=_(
            "SSL fingerprint for secure connections. "
            "Required when using 'ssl:' protocol. "
            "Obtain with: p4 -p ssl:host:port trust -y"
        ),
        widget=forms.TextInput(
            attrs={"placeholder": "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01"}
        ),
        required=False,
    )
    web_url = forms.URLField(
        label=_("P4 Code Review URL (Optional)"),
        help_text=_("Optional: URL to P4 Code Review web viewer for browsing files"),
        widget=forms.URLInput(attrs={"placeholder": "https://swarm.company.com"}),
        required=False,
        assume_scheme="https",
    )

    def clean_p4port(self) -> str:
        """Strip off trailing / and whitespace from p4port"""
        return self.cleaned_data["p4port"].strip().rstrip("/")

    def clean_web_url(self) -> str:
        """Strip off trailing / from web_url"""
        web_url = self.cleaned_data.get("web_url", "")
        if web_url:
            return web_url.rstrip("/")
        return web_url


class PerforceIntegration(RepositoryIntegration, CommitContextIntegration):
    """
    Integration for P4 Core version control system.
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

        # Accessing self.org_integration will raise OrganizationIntegrationNotFound if it doesn't exist
        self._client = PerforceClient(
            integration=self.model,
            org_integration=self.org_integration,
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

    def get_stacktrace_link(
        self, repo: Repository, filepath: str, default: str, version: str | None
    ) -> str | None:
        """
        Get stacktrace link for Perforce file.

        For Perforce, version represents the file revision number.
        We append it to the filepath using Perforce's #revision syntax.
        """
        # Append version/revision to filepath if provided
        if version:
            filepath = f"{filepath}#{version}"

        # Use parent implementation with the modified filepath
        return self.check_file(repo, filepath, default)

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

        Raises:
            ApiUnauthorized: For authentication failures (should be shown to user)
            IntegrationError: For configuration errors (should be shown to user)
        """
        try:
            client = self.get_client()
            # Use client's check_file to verify file exists on P4 server
            result = client.check_file(repo, filepath, branch)
            if result is None:
                return None
            # File exists, return formatted URL
            return self.format_source_url(repo, filepath, branch)
        except (ApiUnauthorized, IntegrationError):
            # Re-raise auth/config errors so they're visible to users
            raise
        except ApiError:
            # Re-raise API errors for visibility
            raise
        except Exception:
            # For other errors (e.g., file not found), return None
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
        # Use client's build_depot_path to handle both relative and absolute paths correctly
        client = self.get_client()
        full_path = client.build_depot_path(repo, filepath, branch)

        # If Swarm web viewer is configured, use it
        # Web URL is stored in Integration.metadata
        web_url = self.model.metadata.get("web_url")

        if web_url:
            # Extract file revision from filepath if present (e.g., "file.cpp#1")
            revision = None
            path_without_rev = full_path
            if "#" in full_path:
                path_without_rev, revision = full_path.rsplit("#", 1)

            # Swarm format: /files/<depot_path>?v=<revision>
            if revision:
                url = f"{web_url}/files{path_without_rev}?v={revision}"
            else:
                url = f"{web_url}/files{full_path}"
            return url

        # Default: p4:// protocol URL with file revision (#) syntax
        # Strip leading // from full_path to avoid p4:////
        url = f"p4://{full_path.lstrip('/')}"
        return url

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

        # Handle Swarm web viewer URLs
        # Web URL is stored in Integration.metadata
        web_url = self.model.metadata.get("web_url")
        if web_url and url.startswith(web_url):
            # Strip Swarm base URL and /files prefix
            # e.g., "https://swarm.example.com/files//depot/path/file.cpp" -> "//depot/path/file.cpp"
            url = url[len(web_url) :]
            if url.startswith("/files"):
                url = url[6:]  # Remove "/files"

        # Remove p4:// prefix
        if url.startswith("p4://"):
            url = url[5:]

        # Remove revision specifier (#revision)
        if "#" in url:
            url = url.split("#")[0]

        # Remove query parameters (for web viewers)
        if "?" in url:
            url = url.split("?")[0]

        # Normalize both paths by stripping leading slashes for comparison
        # depot_path is typically "//depot" from config
        # url after stripping prefix is "depot/path/file.cpp"
        normalized_depot = depot_path.lstrip("/")
        normalized_url = url.lstrip("/")

        # Remove depot prefix to get relative path
        # Ensure exact match by checking for separator or exact equality
        if normalized_url.startswith(normalized_depot + "/") or normalized_url == normalized_depot:
            return normalized_url[len(normalized_depot) :].lstrip("/")

        return url

    def get_repositories(
        self, query: str | None = None, page_number_limit: int | None = None
    ) -> list[dict[str, Any]]:
        """
        Get list of depots/streams from Perforce server.

        Args:
            query: Optional search query to filter depot names
            page_number_limit: Ignored (kept for base class compatibility)

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
            raise IntegrationError(f"Failed to fetch repositories from Perforce: {str(e)}")

    def has_repo_access(self, repo: RpcRepository) -> bool:
        """Check if integration can access the depot."""
        try:
            client = self.get_client()
            depot_path = repo.config.get("depot_path", repo.name)

            # Verify depot exists by checking depot list instead of listing all files
            # Using "..." wildcard would fetch metadata for all files in large repos
            depots = client.get_depots()

            # Extract depot name from path (e.g., "//depot" -> "depot")
            depot_name = depot_path.lstrip("/").split("/")[0]

            # Check if depot exists in the list
            return any(depot["name"] == depot_name for depot in depots)

        except Exception:
            return False

    def get_unmigratable_repositories(self) -> list[RpcRepository]:
        """Get repositories that can't be migrated. Perforce doesn't need migration."""
        return []

    def get_organization_config(self) -> list[dict[str, Any]]:
        """
        Get configuration form fields for organization-level settings.

        Returns the form schema (field definitions, labels, help text, types).
        Current values are provided separately via get_config_data().
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
                "name": "auth_type",
                "type": "choice",
                "label": "Authentication Type",
                "choices": [
                    ["password", "Password"],
                    ["ticket", "P4 Ticket"],
                ],
                "help": "Select whether you're providing a password or a P4 ticket. Tickets are obtained via 'p4 login -p' and don't require re-authentication.",
                "required": True,
            },
            {
                "name": "password",
                "type": "secret",
                "label": "Password / Ticket",
                "placeholder": "••••••••",
                "help": "Your Perforce password or P4 authentication ticket (depending on the authentication type selected above).",
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
                "label": "P4 Core URL (Optional)",
                "placeholder": "https://swarm.company.com",
                "help": "Optional: URL to P4 Core web viewer for browsing files",
                "required": False,
            },
        ]

    def get_config_data(self) -> Mapping[str, Any]:
        """
        Get current configuration values for the integration.

        This is called by the serializer to populate the form fields with existing values.
        Since we store credentials in integration.metadata (not org_integration.config),
        we override the base implementation to read from metadata.

        Returns:
            Dictionary of current configuration values that will be used to populate
            the form fields defined in get_organization_config()
        """
        return self.model.metadata

    def update_organization_config(self, data: Mapping[str, Any]) -> None:
        """
        Update organization configuration by saving to integration.metadata.

        Since each organization has its own private Perforce integration instance,
        we store credentials in integration.metadata instead of org_integration.config.

        Only updates fields that are present in data, preserving existing values
        for fields not included in the update.

        Args:
            data: Updated configuration data from the form (only changed fields)
        """
        from sentry.integrations.services.integration import integration_service

        # Update integration metadata with new values
        metadata = dict(self.model.metadata)  # Create a mutable copy
        metadata.update(data)  # Only update fields present in data

        # Update the integration with new metadata
        integration_service.update_integration(
            integration_id=self.model.id,
            metadata=metadata,
        )

        # Refresh self.model from database to get updated metadata
        refreshed = integration_service.get_integration(integration_id=self.model.id)
        if refreshed:
            self.model = refreshed

        # Invalidate cached client so it gets recreated with new credentials
        self._client = None


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

    def get_pipeline_views(self) -> Sequence[PipelineView[IntegrationPipeline]]:
        """Get pipeline views for installation flow."""
        return [PerforceInstallationView()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        """
        Build integration data from installation state.

        Each organization gets its own private Perforce integration instance,
        even if multiple orgs connect to the same Perforce server. This ensures
        credentials and configuration are isolated per organization.

        Credentials are stored in Integration.metadata since each integration
        is unique per organization (external_id includes org_id).

        Args:
            state: Installation state from pipeline

        Returns:
            Integration data dictionary

        Raises:
            IntegrationError: If organization_id is not provided
        """
        # Validate organization_id is present
        organization_id = state.get("organization_id")
        if not organization_id:
            raise IntegrationError("Organization ID is required for Perforce integration")

        # Use p4port if available, otherwise fall back to host:port for legacy
        installation_data = state.get("installation_data", {})
        p4port = (
            installation_data.get("p4port")
            or state.get("p4port")
            or f"{state.get('host', 'localhost')}:{state.get('port', '1666')}"
        )

        # Create unique external_id per organization to ensure private integrations
        # Use hash to avoid exceeding 64-character external_id limit with long hostnames
        # Format: "perforce-org-{org_id}-{hash}" where hash is first 8 chars of SHA256(p4port)
        p4port_hash = hashlib.sha256(p4port.encode("utf-8")).hexdigest()[:8]
        external_id = f"perforce-org-{organization_id}-{p4port_hash}"

        # Store credentials in Integration.metadata
        metadata: PerforceMetadata = {
            "p4port": p4port,
            "user": installation_data.get("user", ""),
            "auth_type": installation_data.get("auth_type", "password"),  # Default to password
            "password": installation_data.get("password", ""),
        }

        # Add optional fields if provided
        if installation_data.get("client"):
            metadata["client"] = installation_data["client"]

        if installation_data.get("ssl_fingerprint"):
            metadata["ssl_fingerprint"] = installation_data["ssl_fingerprint"]

        if installation_data.get("web_url"):
            metadata["web_url"] = installation_data["web_url"]

        return {
            "name": state.get("name", f"Perforce ({p4port})"),
            "external_id": external_id,
            "metadata": dict(metadata),  # Cast TypedDict to dict for compatibility
        }

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganization,
        *,
        extra: dict[str, Any],
    ) -> None:
        """
        Actions after installation.

        Configuration is now stored in Integration.metadata (set by build_integration),
        so no additional setup is needed per organization.
        """
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
    Collects and validates Perforce server credentials during installation.
    """

    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipeline) -> HttpResponseBase:
        """
        Handle installation request with form validation.

        Args:
            request: HTTP request object
            pipeline: Installation pipeline

        Returns:
            HTTP response (form render or redirect to next step)
        """
        if request.method == "POST":
            form = PerforceInstallationForm(request.POST)
            if form.is_valid():
                form_data = form.cleaned_data

                # Verify connection to Perforce server before completing installation
                try:
                    client = PerforceClient(
                        integration=type(
                            "obj",
                            (object,),
                            {
                                "metadata": {
                                    "p4port": form_data.get("p4port"),
                                    "user": form_data.get("user"),
                                    "password": form_data.get("password"),
                                    "auth_type": form_data.get("auth_type", "password"),
                                    "client": form_data.get("client"),
                                    "ssl_fingerprint": form_data.get("ssl_fingerprint"),
                                }
                            },
                        )(),
                        org_integration=type("obj", (object,), {})(),
                    )
                    # Test connection by fetching depot list
                    client.get_depots()

                    pipeline.get_logger().info(
                        "perforce.setup.connection-verified",
                        extra={
                            "p4port": form_data.get("p4port"),
                            "user": form_data.get("user"),
                        },
                    )
                except ApiUnauthorized as e:
                    form.add_error(
                        None,
                        f"Authentication failed: {e}. Please check your username and password.",
                    )
                    return render_to_response(
                        template="sentry/integrations/perforce-config.html",
                        context={"form": form},
                        request=request,
                    )
                except ApiError as e:
                    form.add_error(
                        None,
                        f"Failed to connect to Perforce server: {e}. Please verify your server address and SSL fingerprint.",
                    )
                    return render_to_response(
                        template="sentry/integrations/perforce-config.html",
                        context={"form": form},
                        request=request,
                    )
                except Exception as e:
                    pipeline.get_logger().error(
                        "perforce.setup.connection-verification-failed",
                        extra={
                            "p4port": form_data.get("p4port"),
                            "error": str(e),
                        },
                        exc_info=True,
                    )
                    form.add_error(
                        None,
                        f"Unexpected error during connection verification: {e}",
                    )
                    return render_to_response(
                        template="sentry/integrations/perforce-config.html",
                        context={"form": form},
                        request=request,
                    )

                # Bind configuration data to pipeline state
                pipeline.bind_state("installation_data", form_data)
                # Include organization_id to create unique external_id per org
                active_org = determine_active_organization(request)
                if active_org:
                    pipeline.bind_state("organization_id", active_org.organization.id)

                pipeline.get_logger().info(
                    "perforce.setup.installation-config-view.success",
                    extra={
                        "p4port": form_data.get("p4port"),
                        "user": form_data.get("user"),
                        "has_ssl_fingerprint": bool(form_data.get("ssl_fingerprint")),
                        "has_web_url": bool(form_data.get("web_url")),
                    },
                )
                return pipeline.next_step()
        else:
            form = PerforceInstallationForm()

        return render_to_response(
            template="sentry/integrations/perforce-config.html",
            context={"form": form},
            request=request,
        )
