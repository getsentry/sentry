"""
Coding agent handoff support for Explorer runs.

This module provides functions to launch coding agents (like Cursor) from Explorer runs.
It reuses the core coding agent infrastructure from sentry.seer.autofix.coding_agent.
"""

from __future__ import annotations

import logging

from requests import HTTPError
from rest_framework.exceptions import PermissionDenied, ValidationError

from sentry import features
from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.integration import CodingAgentIntegration
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.github_copilot.client import GithubCopilotAgentClient
from sentry.integrations.services.github_copilot_identity import github_copilot_identity_service
from sentry.models.organization import Organization
from sentry.seer.autofix.coding_agent import (
    _validate_and_get_integration,
    sanitize_branch_name,
    store_coding_agent_states_to_seer,
)
from sentry.seer.autofix.utils import CodingAgentState
from sentry.seer.models import SeerApiError, SeerRepoDefinition
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger(__name__)


def launch_coding_agents(
    organization: Organization,
    integration_id: int | None,
    run_id: int,
    prompt: str,
    repos: list[str],
    branch_name_base: str = "explorer-fix",
    auto_create_pr: bool = False,
    provider: str | None = None,
    user_id: int | None = None,
) -> dict[str, list]:
    """
    Launch third-party coding agents for an Explorer run.

    Args:
        organization: The organization
        integration_id: The coding agent integration ID (for org-installed integrations like Cursor)
        run_id: The Explorer run ID (used to store coding agent state)
        prompt: The instruction/prompt for the coding agent
        repos: List of repo names to target (format: "owner/name")
        branch_name_base: Base name for the branch (random suffix will be added)
        auto_create_pr: Whether to automatically create a PR when agent finishes
        provider: The coding agent provider (e.g., 'github_copilot') - alternative to integration_id
        user_id: The user ID (required for user-authenticated providers like GitHub Copilot)

    Returns:
        Dictionary with 'successes' and 'failures' lists

    Raises:
        NotFound: If integration not found
        PermissionDenied: If feature not enabled for the organization
        ValidationError: If integration is invalid
    """
    if not features.has("organizations:seer-coding-agent-integrations", organization):
        raise PermissionDenied("Feature not available")

    integration = None
    installation: CodingAgentIntegration | None = None
    client: CodingAgentClient | None = None
    is_github_copilot = provider == "github_copilot"

    if is_github_copilot:
        if not features.has("organizations:integrations-github-copilot-agent", organization):
            raise PermissionDenied("GitHub Copilot is not enabled for this organization")
        user_access_token: str | None = None
        if user_id is not None:
            user_access_token = github_copilot_identity_service.get_access_token_for_user(
                user_id=user_id
            )
        if not user_access_token:
            raise PermissionDenied(
                "GitHub Copilot requires user authorization. Please connect your GitHub account."
            )
        client = GithubCopilotAgentClient(user_access_token)
    elif integration_id is not None:
        integration, installation = _validate_and_get_integration(organization, integration_id)
    else:
        raise ValidationError("Either integration_id or provider must be provided")

    successes = []
    failures = []
    states_to_store: list[CodingAgentState] = []

    for repo_name in repos:
        # Parse repo_name into owner/name
        parts = repo_name.split("/")
        if len(parts) != 2:
            failures.append(
                {
                    "repo_name": repo_name,
                    "error_message": f"Invalid repository name format: {repo_name}",
                }
            )
            continue

        owner, name = parts

        # Create a SeerRepoDefinition for the launch request
        repo = SeerRepoDefinition(
            provider="github",  # TODO: Support other providers
            owner=owner,
            name=name,
            external_id=repo_name,  # Using full name as external_id for now
        )

        launch_request = CodingAgentLaunchRequest(
            prompt=prompt,
            repository=repo,
            branch_name=sanitize_branch_name(branch_name_base),
            auto_create_pr=auto_create_pr,
        )

        try:
            if client is not None:
                # User-authenticated client (e.g., GitHub Copilot)
                coding_agent_state = client.launch(webhook_url="", request=launch_request)
            elif installation is not None:
                # Org-installed integration (e.g., Cursor)
                coding_agent_state = installation.launch(launch_request)
            else:
                raise ValidationError("No valid client or installation available")
        except (HTTPError, ApiError):
            logger.exception(
                "explorer.coding_agent.launch_error",
                extra={
                    "organization_id": organization.id,
                    "run_id": run_id,
                    "repo_name": repo_name,
                    "provider": provider,
                },
            )
            failures.append(
                {
                    "repo_name": repo_name,
                    "error_message": "Failed to launch coding agent",
                }
            )
            continue

        states_to_store.append(coding_agent_state)
        successes.append(
            {
                "repo_name": repo_name,
                "coding_agent_state": coding_agent_state.dict(),
            }
        )

    # Store the coding agent states to Seer
    try:
        store_coding_agent_states_to_seer(run_id=run_id, coding_agent_states=states_to_store)
    except SeerApiError:
        logger.exception(
            "explorer.coding_agent.seer_storage_error",
            extra={
                "organization_id": organization.id,
                "run_id": run_id,
                "repos": repos,
            },
        )

    logger.info(
        "explorer.coding_agent.launch_result",
        extra={
            "organization_id": organization.id,
            "integration_id": integration_id,
            "provider": provider or (integration.provider if integration else None),
            "run_id": run_id,
            "repos_succeeded": len(successes),
            "repos_failed": len(failures),
        },
    )

    return {"successes": successes, "failures": failures}
