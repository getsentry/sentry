from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any

from sentry.constants import ObjectStatus
from sentry.integrations.errors import OrganizationIntegrationNotFound
from sentry.integrations.github.client import GitHubBaseClient
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.types import PullRequestFileStatus
from sentry.shared_integrations.exceptions import IntegrationError

logger = logging.getLogger(__name__)

MAX_PR_FILES = 100

_VALID_STATUSES = {s.value for s in PullRequestFileStatus}


def normalize_github_pr_files(files_data: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    """Map raw GitHub ``/pulls/{n}/files`` JSON to per-file stats, churn-sorted desc.
    Drops entries with an invalid filename or an unsupported status (``copied`` etc).
    """
    out: list[dict[str, Any]] = []
    for file_data in files_data:
        filename = file_data.get("filename")
        if not filename or not isinstance(filename, str):
            logger.warning(
                "pr_file_stats.parse.missing_filename",
                extra={"keys": list(file_data.keys()) if file_data else None},
            )
            continue
        status = file_data.get("status")
        if not isinstance(status, str) or status not in _VALID_STATUSES:
            logger.warning(
                "pr_file_stats.parse.unrecognized_status",
                extra={"status": status, "file_name": filename},
            )
            continue
        out.append(
            {
                "path": filename,
                "additions": file_data.get("additions") or 0,
                "deletions": file_data.get("deletions") or 0,
                "status": status,
            }
        )
    out.sort(key=lambda f: f["additions"] + f["deletions"], reverse=True)
    return out


def _repo_name(repository: Repository) -> str:
    config = repository.config
    config_name = config.get("name") if isinstance(config, dict) else None
    if isinstance(config_name, str) and config_name:
        return config_name
    return repository.name


def _github_client_for_repository(
    organization: Organization, repository: Repository
) -> GitHubBaseClient | None:
    # Resolve from the row we already hold via its integration_id, not by re-querying
    # on name (ambiguous across providers). A non-GitHub client yields None.
    if repository.integration_id is None:
        return None
    integration = integration_service.get_integration(
        integration_id=repository.integration_id,
        organization_id=organization.id,
        status=ObjectStatus.ACTIVE,
    )
    if integration is None:
        return None
    try:
        client = integration.get_installation(organization_id=organization.id).get_client()
    except (IntegrationError, OrganizationIntegrationNotFound):
        return None
    return client if isinstance(client, GitHubBaseClient) else None


def fetch_pr_file_stats(
    organization: Organization, repository: Repository, pr_key: str
) -> list[dict[str, Any]]:
    """Fetch per-file diff stats for a pull request from GitHub.

    Returns churn-sorted normalized stats, or ``[]`` on any failure, a non-GitHub
    provider, or a missing client. Never raises into the caller.
    """
    client = _github_client_for_repository(organization, repository)
    if client is None:
        return []

    try:
        repo_name = _repo_name(repository)
        # get_pull_request_files fetches only GitHub's first page (up to 100 files).
        raw_files = client.get_pull_request_files(repo_name, pr_key)
        # A list body yields SequenceApiResponse (a list subclass); object/empty bodies
        # yield MappingApiResponse/TextApiResponse. Only a list is usable here.
        if not isinstance(raw_files, list):
            logger.warning(
                "pr_file_stats.unexpected_response_type",
                extra={"repo_id": repository.id, "pr_key": pr_key},
            )
            return []
        return normalize_github_pr_files(raw_files[:MAX_PR_FILES])
    except Exception:
        logger.exception(
            "pr_file_stats.fetch_error", extra={"repo_id": repository.id, "pr_key": pr_key}
        )
        return []
