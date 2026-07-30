from __future__ import annotations

import re

from sentry.shared_integrations.exceptions import IntegrationConfigurationError

GCP_PROJECT_ID_RE = re.compile(r"^[a-z][a-z0-9-]{4,28}[a-z0-9]$")

GCP_MCP_URLS: tuple[str, ...] = (
    "https://logging.googleapis.com/mcp",
    "https://monitoring.googleapis.com/mcp",
    "https://cloudtrace.googleapis.com/mcp",
)


def validate_gcp_project_id(project_id: str) -> None:
    if not GCP_PROJECT_ID_RE.match(project_id):
        raise IntegrationConfigurationError(
            "Invalid GCP project ID. Must be 6-30 characters: lowercase letters, "
            "digits, and hyphens. Must start with a letter and cannot end with a hyphen."
        )
