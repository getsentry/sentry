from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from sentry.shared_integrations.exceptions import IntegrationConfigurationError

GCP_PROJECT_ID_RE = re.compile(r"^[a-z][a-z0-9-]{4,28}[a-z0-9]$")

GCP_MCP_URLS: tuple[str, ...] = (
    "https://logging.googleapis.com/mcp",
    "https://monitoring.googleapis.com/mcp",
    "https://cloudtrace.googleapis.com/mcp",
)

GCP_SERVICE_LABELS: Mapping[str, str] = {
    "logging": "Cloud Logging",
    "monitoring": "Cloud Monitoring",
    "cloudtrace": "Cloud Trace",
}

# Connection statuses returned by Seer's GCP verification endpoint. Mirrors
# ConnectionStatus in seer/automation/agent/mcp/gcp_verification.py.
GCP_CONNECTION_STATUSES: tuple[str, ...] = (
    "connected",
    "permission_denied",
    "api_disabled",
    "project_not_found",
    "error",
)

GCP_STATUS_UNVERIFIED = "unverified"

MAX_CUSTOMER_SA_EMAIL_LENGTH = 255


def validate_gcp_project_id(project_id: str) -> None:
    if not GCP_PROJECT_ID_RE.match(project_id):
        raise IntegrationConfigurationError(
            "Invalid GCP project ID. Must be 6-30 characters: lowercase letters, "
            "digits, and hyphens. Must start with a letter and cannot end with a hyphen."
        )


def parse_gcp_project_ids(value: Any) -> list[str]:
    if isinstance(value, str):
        raw: list[Any] = value.split(",")
    elif isinstance(value, (list, tuple)):
        raw = list(value)
    else:
        raise IntegrationConfigurationError(
            "GCP project IDs must be a comma-separated list of project IDs."
        )

    project_ids = list(dict.fromkeys(str(item).strip() for item in raw if str(item).strip()))
    if not project_ids:
        raise IntegrationConfigurationError("At least one GCP project ID is required.")

    for project_id in project_ids:
        validate_gcp_project_id(project_id)

    return project_ids


def parse_customer_sa_email(value: Any) -> str:
    email = str(value or "").strip()
    if not email:
        raise IntegrationConfigurationError("A service account email is required.")
    if len(email) > MAX_CUSTOMER_SA_EMAIL_LENGTH:
        raise IntegrationConfigurationError(
            f"Service account email must be at most {MAX_CUSTOMER_SA_EMAIL_LENGTH} characters."
        )
    return email


def resolve_project_error_detail(project: Mapping[str, Any]) -> str | None:
    existing = project.get("error_detail")
    if existing:
        return str(existing)

    failed = [
        service for service in project.get("services", []) if service.get("status") != "connected"
    ]
    if not failed:
        return None

    return "; ".join(
        "{label}: {detail}".format(
            label=GCP_SERVICE_LABELS.get(service.get("service", ""), service.get("service", "")),
            detail=service.get("error_detail") or "Unknown error",
        )
        for service in failed
    )
