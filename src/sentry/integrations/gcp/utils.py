from __future__ import annotations

import re

from sentry.shared_integrations.exceptions import IntegrationConfigurationError

GCP_PROJECT_ID_RE = re.compile(r"^[a-z][a-z0-9-]{4,28}[a-z0-9]$")


def validate_gcp_project_id(project_id: str) -> None:
    if not GCP_PROJECT_ID_RE.match(project_id):
        raise IntegrationConfigurationError(
            "Invalid GCP project ID. Must be 6-30 characters: lowercase letters, "
            "digits, and hyphens. Must start with a letter and cannot end with a hyphen."
        )


def generate_sentry_sa(org_id: int) -> str:
    # TODO(CW-1667): Create per-customer SA in sentry-connectors via GCP IAM API. For now, return a deterministic placeholder based on org ID.
    return f"sentry-org-{org_id}@sentry-connectors.iam.gserviceaccount.com"
