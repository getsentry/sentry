"""
Coding agent launch support for Explorer runs.

This module provides functions to launch coding agents from Explorer runs.
It reuses the core coding agent infrastructure from sentry.seer.autofix.coding_agent.
"""

from __future__ import annotations

import logging

import sentry_sdk
from requests import HTTPError
from rest_framework.exceptions import PermissionDenied, ValidationError

from sentry import features
from sentry.integrations.claude_code.integration import PROVIDER_KEY as CLAUDE_CODE_PROVIDER_KEY
from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.integration import CodingAgentIntegration
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.cursor.integration import CursorAgentIntegration
from sentry.integrations.github_copilot.client import GithubCopilotAgentClient
from sentry.integrations.services.github_copilot_identity import github_copilot_identity_service
from sentry.integrations.services.integration import integration_service
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


def _resolve_client(
    organization: Organization,
    integration_id: int | None,
    provider: str | None,
    user_id: int | None,
) -> tuple[CodingAgentClient | None, CodingAgentIntegration | None]:
    """
    Resolve the coding agent client and/or installation for the given parameters.

    For API-driven agents (GitHub Copilot, Claude Code), returns a client directly.
    For UI-handoff agents (Cursor), returns an installation.

    Returns:
        Tuple of (client, installation). Exactly one will be non-None.
    """
    if provider == "github_copilot":
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
        return GithubCopilotAgentClient(user_access_token), None

    if integration_id is not None:
        integration, installation = _validate_and_get_integration(organization, integration_id)

        # API-driven agents (e.g., Claude Code) get a direct client
        if integration.provider == CLAUDE_CODE_PROVIDER_KEY:
            return installation.get_client(), None

        # UI-handoff agents (e.g., Cursor) use installation.launch()
        return None, installation

    raise ValidationError("Either integration_id or provider must be provided")


def launch_coding_agents(
    organization: Organization,
    integration_id: int | None,
    run_id: int,
    prompt: str,
    repos: list[SeerRepoDefinition],
    branch_name_base: str = "explorer-fix",
    auto_create_pr: bool = False,
    provider: str | None = None,
    user_id: int | None = None,
) -> dict[str, list]:
    """
    Launch coding agents for an Explorer run.

    Args:
        organization: The organization
        integration_id: The coding agent integration ID (for org-installed integrations)
        run_id: The Explorer run ID (used to store coding agent state)
        prompt: The instruction/prompt for the coding agent
        repos: List of SeerRepoDefinition objects with full repo metadata
        branch_name_base: Base name for the branch (random suffix will be added)
        auto_create_pr: Whether to automatically create a PR when agent finishes
        provider: The coding agent provider (e.g., 'github_copilot') - alternative to integration_id
        user_id: The user ID (required for user-authenticated providers like GitHub Copilot)

    Returns:
        Dictionary with 'successes' and 'failures' lists

    Raises:
        NotFound: If integration not found
        PermissionDenied: If GitHub Copilot is not enabled for the organization
        ValidationError: If integration is invalid
    """
    client, installation = _resolve_client(organization, integration_id, provider, user_id)
    is_github_copilot = provider == "github_copilot"

    successes = []
    failures = []
    states_to_store: list[CodingAgentState] = []

    for repo in repos:
        repo_name = f"{repo.owner}/{repo.name}"

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
                # Set integration_id here for org-installed integrations like Claude Code.
                if integration_id is not None:
                    coding_agent_state.integration_id = integration_id
            elif installation is not None:
                # Org-installed integration (e.g., Cursor)
                coding_agent_state = installation.launch(launch_request)
            else:
                raise ValidationError("No valid client or installation available")
        except (HTTPError, ApiError, ValueError) as e:
            logger.exception(
                "explorer.coding_agent.launch_error",
                extra={
                    "organization_id": organization.id,
                    "run_id": run_id,
                    "repo_name": repo_name,
                    "provider": provider,
                },
            )
            failure_type = "generic"
            error_message = "Failed to launch coding agent"
            github_installation_id: str | None = None
            if isinstance(e, ApiError):
                if e.code == 403 and is_github_copilot:
                    if e.text and "not licensed" in e.text.lower():
                        failure_type = "github_copilot_not_licensed"
                        error_message = "Your GitHub account does not have an active Copilot license. Please check your GitHub Copilot subscription."
                    else:
                        failure_type = "github_app_permissions"
                        error_message = f"The Sentry GitHub App installation does not have the required permissions for {repo_name}. Please update your GitHub App permissions to include 'contents:write'."
                        try:
                            github_integrations = integration_service.get_integrations(
                                organization_id=organization.id,
                                providers=["github"],
                            )
                            if github_integrations:
                                github_installation_id = github_integrations[0].external_id
                        except Exception:
                            sentry_sdk.capture_exception(level="warning")
                elif (
                    isinstance(installation, CursorAgentIntegration)
                    and e.code == 400
                    and e.text
                    and "Failed to verify existence of branch" in e.text
                ):
                    failure_type = "cursor_github_access"
                    error_message = "Cursor does not have GitHub access to this repository. Please install the Cursor GitHub App to grant access."

            failure: dict = {
                "repo_name": repo_name,
                "error_message": error_message,
                "failure_type": failure_type,
            }
            if github_installation_id:
                failure["github_installation_id"] = github_installation_id
            failures.append(failure)
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
                "repos": [f"{r.owner}/{r.name}" for r in repos],
            },
        )

    logger.info(
        "explorer.coding_agent.launch_result",
        extra={
            "organization_id": organization.id,
            "integration_id": integration_id,
            "provider": provider,
            "run_id": run_id,
            "repos_succeeded": len(successes),
            "repos_failed": len(failures),
        },
    )

    return {"successes": successes, "failures": failures}
