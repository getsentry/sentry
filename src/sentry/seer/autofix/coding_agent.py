from __future__ import annotations

import logging
import re
import secrets
import string
from typing import Any

from rest_framework.exceptions import NotFound, ValidationError


class IntegrationNotFound(NotFound):
    pass


from sentry.constants import ObjectStatus
from sentry.integrations.claude_code.integration import ClaudeCodeAgentIntegrationProvider
from sentry.integrations.claude_code.utils import ClaudeSessionEvent, ClaudeSessionEventStatus
from sentry.integrations.coding_agent.integration import CodingAgentIntegration
from sentry.integrations.coding_agent.utils import get_coding_agent_providers
from sentry.integrations.github_copilot.client import GithubCopilotAgentClient
from sentry.integrations.services.github_copilot_identity import github_copilot_identity_service
from sentry.integrations.services.integration import integration_service
from sentry.models.pullrequest import PullRequestAttributionSignalType
from sentry.pr_metrics.attribution import attribute_delegated_agent_pull_request
from sentry.seer.autofix.coding_agent_handoffs import sync_coding_agent_status
from sentry.seer.autofix.constants import CodingAgentStatus
from sentry.seer.autofix.utils import (
    AutofixState,
    CodingAgentProviderType,
    CodingAgentResult,
    CodingAgentState,
    StoreCodingAgentStatesRequest,
    make_store_coding_agent_states_request,
)
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import SeerViewerContext

logger = logging.getLogger(__name__)


# Follows the GitHub branch name rules:
# https://docs.github.com/en/get-started/using-git/dealing-with-special-characters-in-branch-and-tag-names#naming-branches-and-tags
# As our coding agent integration only supports launching on GitHub right now.
VALID_BRANCH_NAME_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_/"


def sanitize_branch_name(branch_name: str) -> str:
    """
    Sanitize a branch name by taking the first 3 words, converting to lowercase,
    removing/replacing special characters, and adding 6 unique random characters.

    Args:
        branch_name: The raw branch name to sanitize

    Returns:
        A sanitized branch name safe for use as a Git branch
    """
    # Take only the first 3 words
    words = branch_name.strip().split()[:3]
    truncated_name = " ".join(words)

    # Although underscores are allowed, we standardize to kebab case.
    kebab_case = truncated_name.replace(" ", "-").replace("_", "-").lower()
    sanitized = "".join(c for c in kebab_case if c in VALID_BRANCH_NAME_CHARS)
    sanitized = sanitized.rstrip("/")

    # Generate 6 unique random characters (alphanumeric)
    # This is to avoid potential branch name conflicts.
    random_suffix = "".join(
        secrets.choice(string.ascii_lowercase + string.digits) for _ in range(6)
    )

    # Combine sanitized name with random suffix
    return f"{sanitized}-{random_suffix}" if sanitized else f"branch-{random_suffix}"


def store_coding_agent_states_to_seer(
    run_id: int,
    coding_agent_states: list[CodingAgentState],
    organization_id: int | None = None,
) -> None:
    """Store multiple coding agent states via Seer batch API."""
    if not coding_agent_states:
        return
    body = StoreCodingAgentStatesRequest(
        run_id=run_id,
        coding_agent_states=[state.dict() for state in coding_agent_states],
    )
    viewer_context: SeerViewerContext | None = None
    if organization_id is not None:
        viewer_context = SeerViewerContext(organization_id=organization_id)
    response = make_store_coding_agent_states_request(
        body, timeout=30, viewer_context=viewer_context
    )

    if response.status >= 400:
        raise SeerApiError(response.data.decode("utf-8"), response.status)

    logger.info(
        "coding_agent.states_stored_to_seer",
        extra={
            "run_id": run_id,
            "status_code": response.status,
            "num_states": len(coding_agent_states),
        },
    )


def validate_and_get_integration(organization, integration_id: int):
    """Validate request and get the coding agent integration."""
    integration_id_int = integration_id

    org_integration = integration_service.get_organization_integration(
        organization_id=organization.id,
        integration_id=integration_id_int,
    )

    if not org_integration or org_integration.status != ObjectStatus.ACTIVE:
        raise IntegrationNotFound("Integration not found")

    integration = integration_service.get_integration(
        organization_integration_id=org_integration.id,
        status=ObjectStatus.ACTIVE,
    )

    if not integration:
        raise IntegrationNotFound("Integration not found")

    # Verify it's a coding agent integration
    if integration.provider not in get_coding_agent_providers():
        raise ValidationError("Not a coding agent integration")

    # Get the installation
    installation = integration.get_installation(organization.id)
    if not isinstance(installation, CodingAgentIntegration):
        raise ValidationError("Invalid coding agent integration")

    return integration, installation


def poll_github_copilot_agents(
    autofix_state: AutofixState | None = None,
    user_id: int = 0,
    coding_agents: dict[str, Any] | None = None,
    organization_id: int = 0,
    run_id: int | None = None,
) -> None:
    agents = coding_agents or (autofix_state.coding_agents if autofix_state else None)
    if not agents:
        return

    # Mirror poll_claude_code_agents: fall back to the run's org when a caller
    # passes autofix_state without an explicit organization_id.
    organization_id = organization_id or (
        autofix_state.request.organization_id if autofix_state else 0
    )
    run_id = run_id if run_id is not None else (autofix_state.run_id if autofix_state else None)

    user_access_token: str | None = None

    for agent_id, agent_state in agents.items():
        if agent_state.provider != CodingAgentProviderType.GITHUB_COPILOT_AGENT:
            continue

        if agent_state.status != CodingAgentStatus.RUNNING:
            continue

        decoded = GithubCopilotAgentClient.decode_agent_id(agent_id)
        if not decoded:
            logger.warning(
                "coding_agent.github_copilot.invalid_agent_id",
                extra={"agent_id": agent_id},
            )
            continue

        owner, repo, task_id = decoded

        if user_access_token is None:
            user_access_token = github_copilot_identity_service.get_access_token_for_user(
                user_id=user_id
            )
            if not user_access_token:
                logger.warning(
                    "coding_agent.github_copilot.no_user_token",
                    extra={"user_id": user_id, "agent_id": agent_id},
                )
                return

        try:
            client = GithubCopilotAgentClient(user_access_token)
            task_status = client.get_task_status(owner, repo, task_id)

            # Find PR and branch artifacts
            pr_artifact = next(
                (a for a in (task_status.artifacts or []) if a.data and a.data.type == "pull"),
                None,
            )
            branch_artifact = next(
                (a for a in (task_status.artifacts or []) if a.type == "branch"),
                None,
            )
            branch_name = (
                branch_artifact.data.head_ref if branch_artifact and branch_artifact.data else None
            )

            # Map the Copilot task lifecycle to our status. The Copilot API uses
            # `state` (not `status`). Derive this purely from `state` so a
            # terminal task is never left on RUNNING just because a (possibly
            # draft) PR exists on its head branch.
            is_task_done = task_status.state == "completed"
            is_task_failed = task_status.state in ("failed", "timed_out")

            # Resolve PR details. The documented path is the PR artifact's
            # `global_id` -> GraphQL node lookup, but the Copilot API
            # intermittently returns an empty `global_id` even for completed
            # tasks whose PR exists. Fall back to resolving the PR from the head
            # branch, which relies only on the reliably-populated branch artifact
            # and public PR fields.
            #
            # PR resolution is enrichment only: isolate its failures so a GitHub
            # API error (these clients raise on HTTP errors) can never block the
            # terminal status update below and leave the agent stuck on RUNNING.
            pr_info = None
            try:
                if pr_artifact and pr_artifact.data and pr_artifact.data.global_id:
                    pr_info = client.get_pr_from_graphql(pr_artifact.data.global_id)
                if pr_info is None and branch_name:
                    pr_info = client.get_pr_from_branch(owner, repo, branch_name)
            except Exception:
                logger.exception(
                    "coding_agent.github_copilot.pr_resolution_failed",
                    extra={
                        "agent_id": agent_id,
                        "owner": owner,
                        "repo": repo,
                        "task_id": task_id,
                    },
                )

            if is_task_done:
                new_status = CodingAgentStatus.COMPLETED
            elif is_task_failed:
                new_status = CodingAgentStatus.FAILED
            else:
                new_status = CodingAgentStatus.RUNNING

            # Push an update when the task reached a terminal state (so the
            # status never gets stuck) or when we have PR details to surface
            # while it is still running.
            if is_task_done or is_task_failed or pr_info is not None:
                pr_url = None
                result = None
                if pr_info:
                    pr_url = pr_info.url
                    result = CodingAgentResult(
                        description=pr_info.title,
                        repo_provider="github",
                        repo_full_name=f"{owner}/{repo}",
                        pr_url=pr_url,
                        branch_name=branch_name,
                    )

                sync_coding_agent_status(
                    agent_id=agent_id,
                    organization_id=organization_id,
                    status=new_status,
                    agent_url=task_status.html_url,
                    result=result,
                )

                if is_task_done and pr_url:
                    try:
                        attribute_delegated_agent_pull_request(
                            organization_id=organization_id,
                            signal_type=PullRequestAttributionSignalType.SEER_DELEGATED_GITHUB_COPILOT,
                            repo_full_name=f"{owner}/{repo}",
                            repo_provider="github",
                            pr_url=pr_url,
                            agent_id=agent_id,
                            run_id=run_id,
                        )
                    except Exception:
                        logger.exception(
                            "coding_agent.github_copilot.pr_attribution_failed",
                            extra={"agent_id": agent_id, "pr_url": pr_url},
                        )

                logger.info(
                    "coding_agent.github_copilot.pr_update",
                    extra={
                        "agent_id": agent_id,
                        "pr_url": pr_url,
                        "task_state": task_status.state,
                        "is_task_done": is_task_done,
                        "is_task_failed": is_task_failed,
                    },
                )

        except Exception:
            logger.exception(
                "coding_agent.github_copilot.poll_error",
                extra={"agent_id": agent_id, "owner": owner, "repo": repo, "task_id": task_id},
            )


def poll_claude_code_agents(
    autofix_state: AutofixState | None = None,
    organization_id: int | None = None,
    coding_agents: dict[str, Any] | None = None,
    run_id: int | None = None,
) -> None:
    """
    Poll Claude Code Agent sessions for status updates.

    Mirrors the pattern of poll_github_copilot_agents but uses the
    Claude Code API to check session status.

    Args:
        autofix_state: Full autofix state (used to get coding_agents and organization_id).
        organization_id: Organization ID to look up the Claude Code integration.
        coding_agents: Dict of coding agent states (alternative to autofix_state).
    """
    agents = coding_agents or (autofix_state.coding_agents if autofix_state else None)
    if not agents:
        return

    org_id = organization_id or (autofix_state.request.organization_id if autofix_state else None)
    if not org_id:
        logger.warning("coding_agent.claude_code.no_organization_id")
        return

    clients: dict[int, Any] = {}

    run_id = run_id if run_id is not None else (autofix_state.run_id if autofix_state else None)

    for agent_id, agent_state in agents.items():
        poll_claude_agent(clients, agent_id, org_id, agent_state, run_id=run_id)


def poll_claude_agent(
    clients, agent_id, org_id, agent_state: CodingAgentState, run_id: int | None = None
) -> None:
    if agent_state.provider != CodingAgentProviderType.CLAUDE_CODE_AGENT:
        return

    if agent_state.status not in (CodingAgentStatus.RUNNING, CodingAgentStatus.PENDING):
        return

    client = get_claude_code_client(clients, agent_id, org_id, agent_state.integration_id)
    if not client:
        return

    # Fetch all events — the API returns events in chronological order,
    # so the last element is the most recent event.
    raw_events = client.list_session_events(agent_id)
    if not raw_events:
        return

    all_events = [ClaudeSessionEvent.parse_obj(e) for e in raw_events]
    last_event_type = all_events[-1].type

    if (
        last_event_type == ClaudeSessionEventStatus.IDLE
        or last_event_type == ClaudeSessionEventStatus.TERMINATED
    ):
        new_status = CodingAgentStatus.COMPLETED

        result, new_status = build_result_from_events(
            all_events, client, agent_id, agent_state.name, new_status
        )

        if new_status != agent_state.status:
            sync_coding_agent_status(
                agent_id=agent_id,
                organization_id=org_id,
                status=new_status,
                result=result,
            )

            if new_status == CodingAgentStatus.COMPLETED and result is not None and result.pr_url:
                try:
                    attribute_delegated_agent_pull_request(
                        organization_id=org_id,
                        signal_type=PullRequestAttributionSignalType.SEER_DELEGATED_CLAUDE_CODE,
                        repo_full_name=result.repo_full_name,
                        repo_provider=result.repo_provider,
                        pr_url=result.pr_url,
                        agent_id=agent_id,
                        run_id=run_id,
                    )
                except Exception:
                    logger.exception(
                        "coding_agent.claude_code.pr_attribution_failed",
                        extra={"agent_id": agent_id, "pr_url": result.pr_url},
                    )

        logger.info(
            "coding_agent.claude_code.poll_update",
            extra={
                "agent_id": agent_id,
                "last_event_type": last_event_type,
                "new_status": new_status.value,
                "pr_url": result.pr_url if result else None,
            },
        )

    elif last_event_type == ClaudeSessionEventStatus.RESCHEDULING:
        if agent_state.status != CodingAgentStatus.PENDING:
            sync_coding_agent_status(
                agent_id=agent_id, organization_id=org_id, status=CodingAgentStatus.PENDING
            )

    else:
        # Any other event (status_running, agent, tool_result, etc.) means active.
        if agent_state.status != CodingAgentStatus.RUNNING:
            sync_coding_agent_status(
                agent_id=agent_id, organization_id=org_id, status=CodingAgentStatus.RUNNING
            )


def get_claude_code_client(clients, agent_id, org_id, integration_id: int | None) -> Any | None:
    if integration_id is None:
        logger.warning(
            "coding_agent.claude_code.missing_integration_id",
            extra={"agent_id": agent_id},
        )
        return None
    if integration_id in clients:
        return clients[integration_id]

    org_integration = integration_service.get_organization_integration(
        organization_id=org_id,
        integration_id=integration_id,
    )
    if not org_integration:
        logger.warning(
            "coding_agent.claude_code.integration_not_found",
            extra={"organization_id": org_id, "integration_id": integration_id},
        )
        return None

    integration = integration_service.get_integration(integration_id=integration_id)
    if not integration:
        logger.warning(
            "coding_agent.claude_code.integration_not_found",
            extra={"organization_id": org_id, "integration_id": integration_id},
        )
        return None

    installation = ClaudeCodeAgentIntegrationProvider.get_installation(integration, org_id)
    try:
        client = installation.get_client()
    except Exception:
        logger.exception(
            "coding_agent.claude_code.get_client_failed",
            extra={"organization_id": org_id, "integration_id": integration_id},
        )
        return None
    clients[integration_id] = client
    return client


def extract_result_from_events(
    events: list[ClaudeSessionEvent],
) -> tuple[str | None, str | None, str | None]:
    """Extract a GitHub PR or branch URL and its surrounding text block from session events.

    Returns:
        Tuple of (url, text_block, branch_name). branch_name is populated when the agent
        returned a branch URL instead of a PR URL (i.e. auto_create_pr=False).
        text_block is the full text content of the agent event block that contained the URL.
    """
    pr_pattern = re.compile(r"https://github\.com/[^/]+/[^/]+/pull/\d+")
    branch_pattern = re.compile(r"https://github\.com/[^/]+/[^/]+/tree/([-\w./]*[-\w])")

    for event in reversed(events):
        if event.type != "agent.message":
            continue
        for block in getattr(event, "content", []):
            if isinstance(block, dict) and block.get("type") == "text":
                text = block.get("text", "")
                pr_match = pr_pattern.search(text)
                if pr_match:
                    return pr_match.group(0), text, None
                branch_match = branch_pattern.search(text)
                if branch_match:
                    return branch_match.group(0), text, branch_match.group(1)

    return None, None, None


def build_result_from_events(
    events: list[ClaudeSessionEvent],
    client: Any,
    agent_id: str,
    agent_name: str,
    new_status: CodingAgentStatus,
) -> tuple[Any | None, CodingAgentStatus]:
    result = None
    pr_url = None
    branch_name = None
    description: str | None = None
    if new_status == CodingAgentStatus.COMPLETED:
        pr_url, description, branch_name = extract_result_from_events(events)
        if not pr_url:
            logger.warning(
                "coding_agent.claude_code.no_result_url_in_response",
                extra={"agent_id": agent_id},
            )
            new_status = CodingAgentStatus.FAILED

    try:
        result = client.build_result_from_session(
            agent_name=agent_name,
            pr_url=pr_url,
        )
        if result:
            result.description = description or ""
            result.branch_name = branch_name
    except Exception:
        logger.exception(
            "coding_agent.claude_code.build_result_error",
            extra={"agent_id": agent_id},
        )
        new_status = CodingAgentStatus.FAILED

    return result, new_status
