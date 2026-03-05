from __future__ import annotations

import logging
import secrets
import string
from typing import Any

import sentry_sdk
from django.conf import settings as django_settings
from requests import HTTPError
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError

from sentry import features
from sentry.constants import ObjectStatus
from sentry.integrations.claude_code.integration import (
    ClaudeCodeIntegrationMetadata,
)
from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.integration import CodingAgentIntegration
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.coding_agent.utils import get_coding_agent_providers
from sentry.integrations.github_copilot.client import GithubCopilotAgentClient
from sentry.integrations.services.github_copilot_identity import github_copilot_identity_service
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.seer.autofix.utils import (
    AutofixState,
    AutofixTriggerSource,
    CodingAgentProviderType,
    CodingAgentResult,
    CodingAgentState,
    CodingAgentStatus,
    StoreCodingAgentStatesRequest,
    get_autofix_state,
    get_coding_agent_prompt,
    get_project_seer_preferences,
    make_store_coding_agent_states_request,
    update_coding_agent_state,
)
from sentry.seer.models import SeerApiError, SeerApiResponseValidationError
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.imports import import_string

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
    run_id: int, coding_agent_states: list[CodingAgentState]
) -> None:
    """Store multiple coding agent states via Seer batch API."""
    if not coding_agent_states:
        return
    body = StoreCodingAgentStatesRequest(
        run_id=run_id,
        coding_agent_states=[state.dict() for state in coding_agent_states],
    )
    response = make_store_coding_agent_states_request(body, timeout=30)

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


def _validate_and_get_integration(organization, integration_id: int):
    """Validate request and get the coding agent integration."""
    integration_id_int = integration_id

    org_integration = integration_service.get_organization_integration(
        organization_id=organization.id,
        integration_id=integration_id_int,
    )

    if not org_integration or org_integration.status != ObjectStatus.ACTIVE:
        raise NotFound("Integration not found")

    integration = integration_service.get_integration(
        organization_integration_id=org_integration.id,
        status=ObjectStatus.ACTIVE,
    )

    if not integration:
        raise NotFound("Integration not found")

    # Verify it's a coding agent integration
    if integration.provider not in get_coding_agent_providers():
        raise ValidationError("Not a coding agent integration")

    # Get the installation
    installation = integration.get_installation(organization.id)
    if not isinstance(installation, CodingAgentIntegration):
        raise ValidationError("Invalid coding agent integration")

    return integration, installation


def _get_autofix_state(run_id: int, organization: Organization) -> AutofixState | None:
    """Extract and validate run_id and get autofix state."""
    autofix_state = get_autofix_state(run_id=run_id, organization_id=organization.id)

    if not autofix_state:
        logger.warning(
            "coding_agent.post.autofix_state_not_found",
            extra={
                "organization_id": organization.id,
                "run_id": run_id,
            },
        )
        return None

    return autofix_state


def _extract_repos_from_root_cause(autofix_state: AutofixState) -> list[str]:
    """Extract repository names from autofix state root cause."""
    root_cause_step = next(
        (step for step in autofix_state.steps if step["key"] == "root_cause_analysis"), None
    )

    if not root_cause_step or not root_cause_step["causes"]:
        return []

    cause = root_cause_step["causes"][0]

    if "relevant_repos" not in cause:
        return []

    return list(set(cause["relevant_repos"])) or []


def _extract_repos_from_solution(autofix_state: AutofixState) -> list[str]:
    """Extract repository names from autofix state solution."""
    repos = set()
    solution_step = next((step for step in autofix_state.steps if step["key"] == "solution"), None)

    if not solution_step:
        return []

    for solution_item in solution_step["solution"]:
        if (
            solution_item["relevant_code_file"]
            and "repo_name" in solution_item["relevant_code_file"]
            and solution_item["relevant_code_file"]["repo_name"]
        ):
            repos.add(solution_item["relevant_code_file"]["repo_name"])

    return list(repos)


def _launch_agents_for_repos(
    autofix_state: AutofixState,
    run_id: int,
    organization,
    trigger_source: AutofixTriggerSource,
    instruction: str | None = None,
    client: CodingAgentClient | None = None,
    webhook_url: str = "",
    installation: CodingAgentIntegration | None = None,
) -> dict[str, list]:
    """
    Launch coding agents for all repositories in the solution.

    Returns:
        Dictionary with 'successes' and 'failures' lists
    """

    # Fetch project preferences to get auto_create_pr setting from automation_handoff
    auto_create_pr = False
    try:
        preference_response = get_project_seer_preferences(autofix_state.request.project_id)
        if preference_response and preference_response.preference:
            if preference_response.preference.automation_handoff:
                auto_create_pr = preference_response.preference.automation_handoff.auto_create_pr
    except (SeerApiError, SeerApiResponseValidationError):
        logger.exception(
            "coding_agent.get_project_seer_preferences_error",
            extra={
                "organization_id": organization.id,
                "run_id": run_id,
                "project_id": autofix_state.request.project_id,
            },
        )

    repos = set(
        _extract_repos_from_root_cause(autofix_state)
        if trigger_source == AutofixTriggerSource.ROOT_CAUSE
        else _extract_repos_from_solution(autofix_state)
    )

    autofix_state_repos = {f"{repo.owner}/{repo.name}" for repo in autofix_state.request.repos}

    # Repos that were in the repos but not in the autofix state
    repos_not_found = repos - autofix_state_repos
    if repos_not_found:
        logger.warning(
            "coding_agent.post.repos_not_found",
            extra={
                "organization_id": organization.id,
                "run_id": run_id,
                "repos_not_found": repos_not_found,
            },
        )

    validated_repos = repos - repos_not_found

    repos_to_launch = validated_repos or autofix_state_repos

    if not repos_to_launch:
        raise NotFound(
            "There are no repos in the Seer state to launch coding agents with, make sure you have repos connected to Seer and rerun this Issue Fix."
        )

    short_id = None
    if autofix_state:
        short_id = autofix_state.request.issue.get("short_id")

    prompt = get_coding_agent_prompt(run_id, trigger_source, instruction, short_id)

    if not prompt:
        raise APIException("Issue fetching prompt to send to coding agents.")

    successes = []
    failures = []
    states_to_store: list[CodingAgentState] = []

    for repo_name in repos_to_launch:
        repo = next(
            (
                repo
                for repo in autofix_state.request.repos
                if f"{repo.owner}/{repo.name}" == repo_name
            ),
            None,
        )
        if not repo:
            logger.error(
                "coding_agent.repo_not_found",
                extra={
                    "organization_id": organization.id,
                    "run_id": run_id,
                    "repo_name": repo_name,
                },
            )
            failures.append(
                {
                    "repo_name": repo_name,
                    "error_message": f"Repository {repo_name} not found in autofix state",
                    "failure_type": "generic",
                }
            )
            continue

        launch_request = CodingAgentLaunchRequest(
            prompt=prompt,
            repository=repo,
            branch_name=sanitize_branch_name(autofix_state.request.issue["title"]),
            auto_create_pr=auto_create_pr,
        )

        try:
            if client:
                coding_agent_state = client.launch(webhook_url=webhook_url, request=launch_request)
            elif installation:
                coding_agent_state = installation.launch(launch_request)
            else:
                raise ValidationError("Either client or installation must be provided")
        except (HTTPError, ApiError, ValueError) as e:
            logger.exception(
                "coding_agent.repo_launch_error",
                extra={
                    "organization_id": organization.id,
                    "run_id": run_id,
                    "repo_name": repo_name,
                },
            )
            error_message = str(e)
            failure_type = "generic"
            github_installation_id: str | None = None
            if isinstance(e, ApiError):
                url_part = f" ({e.url})" if e.url else ""
                if e.code == 403 and client is not None:
                    if e.text and "not licensed" in e.text.lower():
                        failure_type = "github_copilot_not_licensed"
                        error_message = "Your GitHub account does not have an active Copilot license. Please check your GitHub Copilot subscription."
                    else:
                        failure_type = "github_app_permissions"
                        error_message = f"The Sentry GitHub App installation does not have the required permissions for {repo_name}. Please update your GitHub App permissions to include 'contents:write'."
                        if repo and repo.integration_id:
                            try:
                                sentry_integration = integration_service.get_integration(
                                    integration_id=int(repo.integration_id)
                                )
                                if sentry_integration:
                                    github_installation_id = sentry_integration.external_id
                            except Exception:
                                sentry_sdk.capture_exception(level="warning")
                elif e.code == 401:
                    error_message = f"Failed to make request to coding agent{url_part}. Please check that your API credentials are correct: {e.code} Error: {e.text}"
                else:
                    error_message = f"Failed to make request to coding agent{url_part}. {e.code} Error: {e.text}"
            elif isinstance(e, HTTPError) and e.response is not None:
                status_code = e.response.status_code
                if status_code == 401:
                    error_message = "Authentication failed. Please check that your API credentials are correct and have access to the required API endpoints."
                else:
                    error_message = f"Failed to launch coding agent: {status_code} Error: {e}"

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
                "coding_agent_state": coding_agent_state,
            }
        )

    try:
        store_coding_agent_states_to_seer(run_id=run_id, coding_agent_states=states_to_store)
    except SeerApiError:
        logger.exception(
            "coding_agent.seer_storage_error",
            extra={
                "organization_id": organization.id,
                "run_id": run_id,
                "repos": list(repos_to_launch),
            },
        )

    return {"successes": successes, "failures": failures}


def launch_coding_agents_for_run(
    organization_id: int,
    run_id: int,
    integration_id: int | None = None,
    provider: str | None = None,
    trigger_source: AutofixTriggerSource = AutofixTriggerSource.SOLUTION,
    instruction: str | None = None,
    user_id: int | None = None,
) -> dict[str, list]:
    """
    Launch coding agents for an autofix run.

    Args:
        organization_id: The organization ID
        run_id: The autofix run ID
        integration_id: The coding agent integration ID (for integration-based agents like Cursor)
        provider: The coding agent provider key (for provider-based agents like GitHub Copilot)
        trigger_source: The trigger source (ROOT_CAUSE or SOLUTION)
        instruction: Optional custom instruction to append to the prompt
        user_id: The user ID (required for per-user token integrations like GitHub Copilot)

    Returns:
        Dictionary with 'successes' and 'failures' lists

    Raises:
        NotFound: If organization, integration, autofix state, or repos are not found
        PermissionDenied: If GitHub Copilot is not enabled for the organization
        ValidationError: If integration is invalid
        APIException: If there's an error launching agents
    """
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        raise NotFound("Organization not found")

    integration = None
    installation: CodingAgentIntegration | None = None
    client: CodingAgentClient | None = None
    webhook_url = ""
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

    autofix_state = _get_autofix_state(run_id, organization)
    if autofix_state is None:
        raise NotFound("Autofix state not found")

    logger.info(
        "coding_agent.launch_request",
        extra={
            "organization_id": organization.id,
            "integration_id": integration.id if integration else None,
            "provider": provider or (integration.provider if integration else None),
            "run_id": run_id,
        },
    )

    results = _launch_agents_for_repos(
        autofix_state,
        run_id,
        organization,
        trigger_source,
        instruction,
        client=client,
        webhook_url=webhook_url,
        installation=installation,
    )

    if not results["successes"] and not results["failures"]:
        raise APIException("No agents were launched")

    logger.info(
        "coding_agent.launch_result",
        extra={
            "organization_id": organization.id,
            "integration_id": integration.id if integration else None,
            "provider": provider or (integration.provider if integration else None),
            "run_id": run_id,
            "repos_succeeded": len(results["successes"]),
            "repos_failed": len(results["failures"]),
        },
    )

    return results


def poll_github_copilot_agents(
    autofix_state: AutofixState | None = None,
    user_id: int = 0,
    coding_agents: dict[str, Any] | None = None,
) -> None:
    agents = coding_agents or (autofix_state.coding_agents if autofix_state else None)
    if not agents:
        return

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

            # Find PR in artifacts - look for artifact with data.type == 'pull'
            pr_artifact = next(
                (a for a in (task_status.artifacts or []) if a.data and a.data.type == "pull"),
                None,
            )

            if pr_artifact and pr_artifact.data and pr_artifact.data.global_id:
                # Get PR info from GraphQL using the global_id
                pr_info = client.get_pr_from_graphql(pr_artifact.data.global_id)
                if pr_info:
                    pr_url = pr_info.url
                    description = pr_info.title

                    result = CodingAgentResult(
                        description=description,
                        repo_provider="github",
                        repo_full_name=f"{owner}/{repo}",
                        pr_url=pr_url,
                    )

                    # Status: queued, in_progress, completed, failed, timed_out
                    is_task_done = task_status.status == "completed"
                    new_status = (
                        CodingAgentStatus.COMPLETED if is_task_done else CodingAgentStatus.RUNNING
                    )

                    update_coding_agent_state(
                        agent_id=agent_id,
                        status=new_status,
                        result=result,
                    )

                    logger.info(
                        "coding_agent.github_copilot.pr_update",
                        extra={
                            "agent_id": agent_id,
                            "pr_url": pr_url,
                            "task_status": task_status.status,
                            "is_task_done": is_task_done,
                        },
                    )

            elif task_status.status in ("failed", "timed_out"):
                update_coding_agent_state(
                    agent_id=agent_id,
                    status=CodingAgentStatus.FAILED,
                )
                logger.info(
                    "coding_agent.github_copilot.task_failed",
                    extra={"agent_id": agent_id, "task_status": task_status.status},
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

    for agent_id, agent_state in agents.items():
        if agent_state.provider != CodingAgentProviderType.CLAUDE_CODE_AGENT:
            continue

        if agent_state.status not in (CodingAgentStatus.RUNNING, CodingAgentStatus.PENDING):
            continue

        if not django_settings.CLAUDE_CODE_CLIENT_CLASS:
            logger.warning("coding_agent.claude_code.no_client_class_configured")
            return

        # Get or create client for this agent's integration
        integration_id = agent_state.integration_id
        if integration_id is None:
            logger.warning(
                "coding_agent.claude_code.missing_integration_id",
                extra={"agent_id": agent_id},
            )
            continue
        if integration_id in clients:
            client = clients[integration_id]
        else:
            org_integration = integration_service.get_organization_integration(
                organization_id=org_id,
                integration_id=integration_id,
            )
            if not org_integration:
                logger.warning(
                    "coding_agent.claude_code.integration_not_found",
                    extra={"organization_id": org_id, "integration_id": integration_id},
                )
                continue
            integration = integration_service.get_integration(
                organization_integration_id=org_integration.id,
            )
            if not integration:
                logger.warning(
                    "coding_agent.claude_code.integration_not_found",
                    extra={"organization_id": org_id, "integration_id": integration_id},
                )
                continue
            metadata = ClaudeCodeIntegrationMetadata.parse_obj(integration.metadata or {})
            client_class = import_string(django_settings.CLAUDE_CODE_CLIENT_CLASS)
            client = client_class(
                api_key=metadata.api_key,
                environment_id=metadata.environment_id,
                workspace_name=metadata.workspace_name,
            )
            clients[integration_id] = client

        try:
            session_status = client.get_session_status(agent_id)
        except Exception:
            logger.exception(
                "coding_agent.claude_code.poll_error",
                extra={"agent_id": agent_id},
            )
            continue

        claude_status = session_status.status
        new_status = CodingAgentStatus.from_claude_code_status(claude_status)

        logger.info(
            "coding_agent.claude_code.session_status_details",
            extra={
                "agent_id": agent_id,
                "claude_status": claude_status,
                "session_result": session_status.result,
                "raw_status_response": str(session_status),
            },
        )

        # If session went idle, check if the last tool call received a result.
        # A missing tool result means the agent stalled (e.g., permission blocked).
        if new_status == CodingAgentStatus.COMPLETED:
            try:
                events = client.list_session_events(agent_id)
                last_tool_use = None
                has_tool_result = False
                for event in events:
                    event_type = event.get("type")
                    if event_type == "agent":
                        for block in event.get("content", []):
                            if isinstance(block, dict) and block.get("type") == "tool_use":
                                last_tool_use = block.get("id")
                                has_tool_result = False
                    elif event_type == "tool_result":
                        if event.get("tool_use_id") == last_tool_use:
                            has_tool_result = True

                if last_tool_use and not has_tool_result:
                    logger.warning(
                        "coding_agent.claude_code.idle_missing_tool_result",
                        extra={
                            "agent_id": agent_id,
                            "last_tool_use_id": last_tool_use,
                        },
                    )
                    new_status = CodingAgentStatus.FAILED
            except Exception:
                logger.exception(
                    "coding_agent.claude_code.event_list_check_error",
                    extra={"agent_id": agent_id},
                )

        result = None
        if new_status in (CodingAgentStatus.COMPLETED, CodingAgentStatus.FAILED):
            pr_url = None
            if new_status == CodingAgentStatus.COMPLETED:
                try:
                    pr_url = client.extract_result_url_from_events(agent_id)
                except Exception:
                    logger.exception(
                        "coding_agent.claude_code.extract_result_url_error",
                        extra={"agent_id": agent_id},
                    )
                if not pr_url:
                    logger.warning(
                        "coding_agent.claude_code.no_result_url_in_response",
                        extra={"agent_id": agent_id},
                    )
                    new_status = CodingAgentStatus.FAILED

            try:
                result = client.build_result_from_session(
                    agent_name=agent_state.name,
                    pr_url=pr_url,
                )
            except Exception:
                logger.exception(
                    "coding_agent.claude_code.build_result_error",
                    extra={"agent_id": agent_id},
                )
                new_status = CodingAgentStatus.FAILED

        if new_status != agent_state.status:
            update_coding_agent_state(
                agent_id=agent_id,
                status=new_status,
                result=result,
            )

        logger.info(
            "coding_agent.claude_code.poll_update",
            extra={
                "agent_id": agent_id,
                "claude_status": claude_status,
                "new_status": new_status.value,
                "pr_url": result.pr_url if result else None,
            },
        )
