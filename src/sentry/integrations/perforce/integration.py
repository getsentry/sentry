from __future__ import annotations

from typing import TypedDict

from django.http import HttpRequest, HttpResponseBase
from django.utils.translation import gettext_lazy as _

from sentry.integrations.base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.perforce.depot import PerforceDepot
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.source_code_management.code_store import CodeStoreIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.pipeline.views.base import render_react_view

from .client import PerforceClient

DESCRIPTION = """
Connect your Sentry organization with your Perforce server to enable stacktrace linking.
This integration allows you to view source code files directly from your Perforce repository
when viewing stack traces in Sentry.
"""

FEATURES = [
    FeatureDescription(
        """
        Link your Sentry stack traces back to your Perforce source code with stack
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
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Perforce%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/perforce",
    aspects={},
)


class PerforceFileInfo(TypedDict):
    depot_path: str
    revision: int
    file_size: int
    file_type: str
    file_name: str


class PerforceIntegration(CodeStoreIntegration):
    """
    Perforce SCM integration using P4 Code Review Files REST API.

    This integration provides file content retrieval capabilities for Perforce
    repositories via the P4 Code Review v11 Files REST API.
    """

    integration_name = IntegrationProviderSlug.PERFORCE

    def __init__(self, model, organization_id: int):
        """Initialize Perforce integration installation."""
        super().__init__(model, organization_id)
        self._client: PerforceClient | None = None

    def get_client(self) -> PerforceClient:
        """Get the Perforce client instance using config from the model."""
        if self._client is None:
            config = self.model.metadata
            self._client = PerforceClient(
                base_url=config["base_url"],
                username=config["username"],
                password=config["password"],
                verify_ssl=config.get("verify_ssl", True),
            )
        return self._client

    # CodeStoreIntegration methods
    def source_url_matches(self, url: str) -> bool:
        """Check if this integration can handle the given URL."""
        # Perforce URLs can be custom, so we check against configured base_url
        base_url = self.model.metadata.get("base_url", "")
        return base_url and url.startswith(base_url)

    def format_source_url(self, filepath: str, revision: int | None = None) -> str:
        """
        Format a source URL for viewing a file in Perforce.

        For Perforce, we'll construct a URL to the P4 Code Review interface.
        """
        base_url = self.model.metadata.get("base_url", "").rstrip("/")
        depot_name = self.model.metadata.get("depot_name", "")
        assert depot_name, "Depot name is required"
        depot = PerforceDepot(depot_name)
        # Return a URL to the P4 Code Review file viewer
        if revision:
            return f"{base_url}/files/{depot.encode_path(filepath)}#{revision}"

        return f"{base_url}/files/{depot.encode_path(filepath)}"

    def extract_source_path_from_source_url(self, url: str) -> str:
        """Extract source path from URL."""
        base_url = self.model.metadata.get("base_url", "").rstrip("/")
        if url.startswith(f"{base_url}/files"):
            path = url.replace(f"{base_url}/files", "")
            # Remove revision info if present
            if "#" in path:
                path = path.split("#")[0]
            return path
        return url

    # Additional Perforce-specific methods
    def get_file_content(self, depot_path: str, revision: int | None = None) -> str:
        """
        Get file contents from Perforce repository.

        Args:
            depot_path: File path in the Perforce depot (e.g. //depot/path/to/file.py)
            revision: Specific revision number

        Returns:
            File contents as string
        """
        client = self.get_client()
        return client.get_file_content(depot_path, revision)

    def get_file_info(
        self, depot_path: str, revision: int | None = None
    ) -> PerforceFileInfo | None:
        """
        Get file information from P4 Code Review.

        Args:
            depot_path: File path in the Perforce depot
            revision: Specific revision number

        Returns:
            PerforceFileInfo instance or None if file doesn't exist
        """
        client = self.get_client()
        return client.get_file_info(depot_path, revision)


class PerforceConfigurationView:
    """
    Pipeline view for configuring Perforce connection details.
    """

    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipeline) -> HttpResponseBase:
        if request.method == "POST":
            # Get configuration from form
            base_url = request.POST.get("base_url", "").strip()
            username = request.POST.get("username", "").strip()
            password = request.POST.get("password", "").strip()
            depot_name = request.POST.get("depot_name", "main").strip()
            verify_ssl = request.POST.get("verify_ssl") == "on"

            if not all([base_url, username, password]):
                props = {
                    "error": "All fields are required",
                    "base_url": base_url,
                    "username": username,
                    "depot_name": depot_name,
                    "verify_ssl": verify_ssl,
                }
                return render_react_view(
                    request=request,
                    pipeline_name="perforceConfiguration",
                    props=props,
                )

            # Store configuration in pipeline state
            pipeline.bind_state(
                "config",
                {
                    "base_url": base_url,
                    "username": username,
                    "password": password,
                    "depot_name": depot_name,
                    "verify_ssl": verify_ssl,
                },
            )

            return pipeline.next_step()

        # GET request - show configuration form
        props = {
            "base_url": "",
            "username": "",
            "depot_name": "main",
            "verify_ssl": True,
        }
        return render_react_view(
            request=request,
            pipeline_name="perforceConfiguration",
            props=props,
        )


class PerforceIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.PERFORCE.value
    name = "Perforce"
    metadata = metadata
    integration_cls = PerforceIntegration
    features = frozenset([IntegrationFeatures.STACKTRACE_LINK])

    def get_pipeline_views(self):
        return [PerforceConfigurationView()]

    def build_integration(self, state):
        config = state["config"]
        return {
            "external_id": f"{config['base_url']}-{config['username']}",
            "name": f"Perforce ({config['depot_name']})",
            "metadata": {
                "base_url": config["base_url"],
                "depot_name": config["depot_name"],
                "username": config["username"],
                "password": config["password"],
                "verify_ssl": config["verify_ssl"],
            },
            "config": config,
        }
