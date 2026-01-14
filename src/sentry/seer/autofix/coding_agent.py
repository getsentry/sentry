from __future__ import annotations

import logging
import secrets
import string

import orjson
from django.conf import settings
from requests import HTTPError
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError

from sentry import features
from sentry.constants import ObjectStatus
from sentry.integrations.coding_agent.integration import CodingAgentIntegration
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.coding_agent.utils import get_coding_agent_providers
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.net.http import connection_from_url
from sentry.seer.autofix.utils import (
    AutofixState,
    AutofixTriggerSource,
    CodingAgentState,
    get_autofix_state,
    get_coding_agent_prompt,
    get_project_seer_preferences,
)
from sentry.seer.models import SeerApiError, SeerApiResponseValidationError
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.shared_integrations.exceptions import ApiError

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
    path = "/v1/automation/autofix/coding-agent/state/set"
    body = orjson.dumps(
        {
            "run_id": run_id,
            "coding_agent_states": [state.dict() for state in coding_agent_states],
        }
    )

    connection_pool = connection_from_url(settings.SEER_AUTOFIX_URL)
    response = make_signed_seer_api_request(
        connection_pool,
        path,
        body=body,
        timeout=30,
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
    installation: CodingAgentIntegration,
    autofix_state: AutofixState,
    run_id: int,
    organization,
    trigger_source: AutofixTriggerSource,
    instruction: str | None = None,
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

    prompt = get_coding_agent_prompt(run_id, trigger_source, instruction)

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
            coding_agent_state = installation.launch(launch_request)
        except (HTTPError, ApiError) as e:
            logger.exception(
                "coding_agent.repo_launch_error",
                extra={
                    "organization_id": organization.id,
                    "run_id": run_id,
                    "repo_name": repo_name,
                },
            )
            error_message = str(e)
            if isinstance(e, ApiError):
                url_part = f" ({e.url})" if e.url else ""
                if e.code == 401:
                    error_message = f"Failed to make request to coding agent{url_part}. Please check that your API credentials are correct: {e.code} Error: {e.text}"
                else:
                    error_message = f"Failed to make request to coding agent{url_part}. {e.code} Error: {e.text}"

            failures.append(
                {
                    "repo_name": repo_name,
                    "error_message": error_message,
                }
            )
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
    integration_id: int,
    run_id: int,
    trigger_source: AutofixTriggerSource = AutofixTriggerSource.SOLUTION,
    instruction: str | None = None,
) -> dict[str, list]:
    """
    Launch coding agents for an autofix run.

    Args:
        organization_id: The organization ID
        integration_id: The coding agent integration ID
        run_id: The autofix run ID
        trigger_source: The trigger source (ROOT_CAUSE or SOLUTION)
        instruction: Optional custom instruction to append to the prompt

    Returns:
        Dictionary with 'successes' and 'failures' lists

    Raises:
        NotFound: If organization, integration, autofix state, or repos are not found
        PermissionDenied: If feature is not enabled for the organization
        ValidationError: If integration is invalid
        APIException: If there's an error launching agents
    """
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        raise NotFound("Organization not found")

    if not features.has("organizations:seer-coding-agent-integrations", organization):
        raise PermissionDenied("Feature not available")

    integration, installation = _validate_and_get_integration(organization, integration_id)

    autofix_state = _get_autofix_state(run_id, organization)
    if autofix_state is None:
        raise NotFound("Autofix state not found")

    logger.info(
        "coding_agent.launch_request",
        extra={
            "organization_id": organization.id,
            "integration_id": integration.id,
            "run_id": run_id,
        },
    )

    results = _launch_agents_for_repos(
        installation, autofix_state, run_id, organization, trigger_source, instruction
    )

    if not results["successes"] and not results["failures"]:
        raise APIException("No agents were launched")

    logger.info(
        "coding_agent.launch_result",
        extra={
            "organization_id": organization.id,
            "integration_id": integration.id,
            "provider": integration.provider,
            "run_id": run_id,
            "repos_succeeded": len(results["successes"]),
            "repos_failed": len(results["failures"]),
        },
    )

    return results
