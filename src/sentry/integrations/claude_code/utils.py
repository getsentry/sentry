"""
Utility functions for Claude Code Agent integration.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from sentry.constants import ObjectStatus
from sentry.integrations.github.client import GitHubBaseClient
from sentry.integrations.services.integration import integration_service

logger = logging.getLogger(__name__)


def get_github_token_for_repo(
    integration_id: int | None,
    organization_id: int | None,
    repo_owner: str,
    repo_name: str,
) -> str | None:
    """
    Get a GitHub access token for the specified repository.

    Args:
        integration_id: The GitHub integration ID.
        organization_id: The Sentry organization ID.
        repo_owner: The repository owner (org or user).
        repo_name: The repository name.

    Returns:
        GitHub access token if available, None otherwise.
    """
    if not integration_id:
        logger.warning(
            "claude_code.get_github_token.no_integration_id",
            extra={"repo": f"{repo_owner}/{repo_name}"},
        )
        return None

    integration = integration_service.get_integration(
        integration_id=int(integration_id),
        status=ObjectStatus.ACTIVE,
    )

    if not integration:
        logger.warning(
            "claude_code.get_github_token.integration_not_found",
            extra={
                "integration_id": integration_id,
                "repo": f"{repo_owner}/{repo_name}",
            },
        )
        return None

    if integration.provider != "github":
        logger.warning(
            "claude_code.get_github_token.not_github_integration",
            extra={
                "integration_id": integration_id,
                "provider": integration.provider,
            },
        )
        return None

    if not organization_id:
        logger.warning(
            "claude_code.get_github_token.no_organization_id",
            extra={"repo": f"{repo_owner}/{repo_name}"},
        )
        return None

    installation = integration.get_installation(organization_id=organization_id)
    client = installation.get_client()

    if not isinstance(client, GitHubBaseClient):
        logger.warning(
            "claude_code.get_github_token.unexpected_client_type",
            extra={"client_type": type(client).__name__},
        )
        return None

    token_data = client.get_access_token(token_minimum_validity_time=timedelta(minutes=30))
    if not token_data:
        logger.warning(
            "claude_code.get_github_token.token_not_found",
            extra={"repo": f"{repo_owner}/{repo_name}"},
        )
        return None

    return token_data["access_token"]


def parse_github_repo_url(repo_url: str) -> tuple[str, str] | None:
    """
    Parse a GitHub repository URL to extract owner and repo name.

    Args:
        repo_url: GitHub repository URL (e.g., https://github.com/owner/repo)

    Returns:
        Tuple of (owner, repo_name) or None if parsing fails.
    """
    # Handle various GitHub URL formats
    # https://github.com/owner/repo
    # https://github.com/owner/repo.git
    # git@github.com:owner/repo.git

    repo_url = repo_url.strip()

    if repo_url.startswith("git@github.com:"):
        # SSH format: git@github.com:owner/repo.git
        path = repo_url.replace("git@github.com:", "")
        path = path.rstrip(".git")
    elif "github.com" in repo_url:
        # HTTPS format
        parts = repo_url.split("github.com/")
        if len(parts) != 2:
            return None
        path = parts[1].rstrip("/").rstrip(".git")
    else:
        return None

    parts = path.split("/")
    if len(parts) < 2:
        return None

    return parts[0], parts[1]


def map_session_status(claude_status: str) -> str:
    """
    Map Claude Code session status to a normalized status.

    Args:
        claude_status: Status from Claude Code API.

    Returns:
        Normalized status string.
    """
    status_mapping = {
        "pending": "pending",
        "running": "running",
        "idle": "completed",
        "closed": "completed",
    }
    return status_mapping.get(claude_status.lower(), "unknown")
