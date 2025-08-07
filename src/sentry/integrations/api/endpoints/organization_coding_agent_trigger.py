from __future__ import annotations

import logging
import secrets
import string

import orjson
import requests
from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.constants import ObjectStatus
from sentry.integrations.coding_agent.integration import CodingAgentIntegration
from sentry.integrations.coding_agent.models import (
    CodingAgentLaunchRequest,
    CodingAgentLaunchResponse,
)
from sentry.integrations.coding_agent.utils import get_coding_agent_providers
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.seer.autofix.utils import (
    AutofixState,
    CodingAgentState,
    CodingAgentStatus,
    get_autofix_state,
)
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils import metrics

logger = logging.getLogger(__name__)


VALID_BRANCH_NAME_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-/"


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

    kebab_case = truncated_name.replace(" ", "-").replace("_", "-").lower()
    sanitized = "".join(c for c in kebab_case if c in VALID_BRANCH_NAME_CHARS)
    sanitized = sanitized.rstrip("/")

    # Generate 6 unique random characters (alphanumeric)
    random_suffix = "".join(
        secrets.choice(string.ascii_lowercase + string.digits) for _ in range(6)
    )

    # Combine sanitized name with random suffix
    return f"{sanitized}-{random_suffix}" if sanitized else f"branch-{random_suffix}"


def store_coding_agent_state_to_seer(
    run_id: int, repo_external_id: str, coding_agent_state: CodingAgentState
) -> bool:
    """Store coding agent state via Seer API."""
    try:
        path = "/v1/automation/autofix/coding-agent/state"
        body = orjson.dumps(
            {
                "run_id": run_id,
                "repo_external_id": repo_external_id,
                "coding_agent_state": coding_agent_state.dict(),
            }
        )

        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}{path}",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(body),
            },
            timeout=30,
        )

        response.raise_for_status()
        logger.info(
            "coding_agent.state_stored_to_seer",
            extra={
                "run_id": run_id,
                "repo_external_id": repo_external_id,
                "status_code": response.status_code,
            },
        )
        return True

    except Exception as e:
        logger.warning(
            "coding_agent.seer_store_error",
            extra={
                "run_id": run_id,
                "repo_external_id": repo_external_id,
                "error": str(e),
            },
        )
        return False


def make_coding_agent_prompt(
    autofix_state: AutofixState, repos_in_solution: set[str], current_repo_name: str
) -> str:
    """Create a markdown prompt from autofix state similar to frontend formatting."""
    if not autofix_state:
        return ""

    # Check if autofix_state has the expected structure
    if not hasattr(autofix_state, "steps"):
        return ""

    steps = autofix_state.steps
    if not steps:
        return ""

    parts = []

    # Find root cause analysis step
    root_cause_step = None
    for step in steps:
        if step.get("type") == "root_cause_analysis":
            root_cause_step = step
            break

    if root_cause_step and root_cause_step.get("causes"):
        cause = root_cause_step["causes"][0]  # Take first cause

        parts.append("# Root Cause of the Issue")

        if cause.get("description"):
            parts.append(cause["description"])

        if cause.get("root_cause_reproduction"):
            reproduction_parts = []
            for event in cause["root_cause_reproduction"]:
                event_parts = [f"### {event.get('title', 'Event')}"]

                if event.get("code_snippet_and_analysis"):
                    event_parts.append(event["code_snippet_and_analysis"])

                if event.get("relevant_code_file"):
                    file_path = event["relevant_code_file"].get("file_path")
                    if file_path:
                        event_parts.append(f"(See {file_path})")

                reproduction_parts.append("\n".join(event_parts))

            if reproduction_parts:
                parts.append("\n\n".join(reproduction_parts))

    # Find solution step
    solution_step = None
    for step in steps:
        if step.get("type") == "solution":
            solution_step = step
            break

    if solution_step:
        parts.append("# Proposed Solution")

        if solution_step.get("description"):
            parts.append(solution_step["description"])

        if solution_step.get("solution"):
            solution_parts = []
            for solution_event in solution_step["solution"]:
                solution_event_parts = [f"### {solution_event.get('title', 'Solution Step')}"]

                if solution_event.get("description"):
                    solution_event_parts.append(solution_event["description"])

                solution_parts.append("\n".join(solution_event_parts))

            if solution_parts:
                parts.append("\n\n".join(solution_parts))

    state_md_dump = "\n\n".join(parts) if parts else ""

    multi_repo_prompt = ""
    if len(repos_in_solution) > 1:
        multi_repo_prompt = f"NOTE: There are multiple repos included in the proposed solution, you're working in repo {current_repo_name}. Consider only the fix needed for this repo.\n\n"

    return f"Fix the below issue:\n\n{multi_repo_prompt}{state_md_dump}"


@region_silo_endpoint
class OrganizationCodingAgentTriggerEndpoint(OrganizationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    permission_classes = (OrganizationIntegrationsPermission,)
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization) -> Response:
        """Get all available coding agent integrations for the organization."""
        try:
            # Find all installed coding agent integrations
            org_integrations = OrganizationIntegration.objects.filter(
                organization_id=organization.id,
                integration__provider__in=get_coding_agent_providers(),
                status=ObjectStatus.ACTIVE,
            ).select_related("integration")

            # Serialize the integrations
            integrations_data = []
            for org_integration in org_integrations:
                try:
                    integration = org_integration.integration
                    installation = integration.get_installation(organization.id)

                    integrations_data.append(
                        {
                            "id": str(integration.id),
                            "name": integration.name,
                            "provider": integration.provider,
                            "status": (
                                "active"
                                if org_integration.status == ObjectStatus.ACTIVE
                                else "inactive"
                            ),
                            "metadata": {
                                "has_api_key": bool(integration.metadata.get("api_key")),
                                "domain_name": integration.metadata.get("domain_name"),
                            },
                            "webhook_url": installation.get_webhook_url(),
                        }
                    )
                except Exception as e:
                    logger.exception(
                        "coding_agent.integration_processing_error",
                        extra={
                            "organization_id": organization.id,
                            "integration_id": getattr(integration, "id", "unknown"),
                            "error": str(e),
                        },
                    )
                    # Continue processing other integrations
                    continue

            logger.info(
                "coding_agent.list_integrations",
                extra={"organization_id": organization.id, "count": len(integrations_data)},
            )

            return self.respond({"integrations": integrations_data})

        except Exception as e:
            logger.exception(
                "coding_agent.list_error",
                extra={"organization_id": organization.id, "error": str(e)},
            )
            return self.respond(
                {"error": "Failed to retrieve coding agent integrations"}, status=500
            )

    def _validate_and_get_integration(self, request: Request, organization):
        """Validate request and get the coding agent integration."""
        integration_id = request.data.get("integration_id")
        if not integration_id:
            return Response({"error": "integration_id is required"}, status=400)

        # Get the integration
        try:
            org_integration = OrganizationIntegration.objects.select_related("integration").get(
                organization_id=organization.id,
                integration_id=integration_id,
                status=ObjectStatus.ACTIVE,
            )
            integration = org_integration.integration
        except OrganizationIntegration.DoesNotExist:
            return Response({"error": "Integration not found"}, status=404)

        # Verify it's a coding agent integration
        if integration.provider not in get_coding_agent_providers():
            return Response({"error": "Not a coding agent integration"}, status=400)

        # Get the installation
        installation = integration.get_installation(organization.id)
        if not isinstance(installation, CodingAgentIntegration):
            return Response({"error": "Invalid coding agent integration"}, status=400)

        return integration, installation

    def _get_autofix_state(
        self, request: Request, organization
    ) -> tuple[int | None, AutofixState | None]:
        """Extract and validate run_id and get autofix state."""
        run_id_raw = request.data.get("run_id")

        # Convert run_id to integer for autofix state lookup
        try:
            run_id = int(run_id_raw) if run_id_raw is not None else None
        except (ValueError, TypeError):
            return None, None

        autofix_state = get_autofix_state(run_id=run_id)

        if not autofix_state:
            logger.warning(
                "coding_agent.autofix_state_not_found",
                extra={
                    "organization_id": organization.id,
                    "run_id": run_id,
                },
            )
            return run_id, None

        return run_id, autofix_state

    def _extract_repos_from_solution(self, autofix_state: AutofixState) -> set[str]:
        """Extract repository names from autofix state solution."""
        repos = set()
        solution_step = next(step for step in autofix_state.steps if step["key"] == "solution")

        for solution_item in solution_step["solution"]:
            if (
                solution_item["relevant_code_file"]
                and solution_item["relevant_code_file"]["repo_name"]
            ):
                repos.add(solution_item["relevant_code_file"]["repo_name"])

        return repos

    def _launch_agents_for_repos(
        self,
        installation: CodingAgentIntegration,
        autofix_state: AutofixState,
        run_id: int,
        organization,
    ) -> dict:
        """Launch coding agents for all repositories in the solution."""
        repos = self._extract_repos_from_solution(autofix_state)

        results = []
        store_success = True

        for repo_name in repos:
            try:
                repo = next(
                    repo
                    for repo in autofix_state.request["repos"]
                    if f"{repo['owner']}/{repo['name']}" == repo_name
                )
                prompt = make_coding_agent_prompt(autofix_state, repos, repo_name)

                launch_request = CodingAgentLaunchRequest(
                    prompt=prompt,
                    repository=repo,
                    branch_name=sanitize_branch_name(autofix_state.request["issue"]["title"]),
                )

                # Launch the agent
                result = installation.launch(launch_request)

                # Parse and validate the response using Pydantic model
                launch_response = CodingAgentLaunchResponse.validate(result)

                coding_agent_state = CodingAgentState(
                    id=launch_response.id,
                    name=launch_response.name,
                    status=CodingAgentStatus.PENDING,
                    agent_url=launch_response.target.url,
                    branch_name=launch_response.target.branchName,
                    started_at=launch_response.createdAt,
                )

                # Store the coding agent state to Seer
                repo_external_id = repo["external_id"]
                repo_store_success = store_coding_agent_state_to_seer(
                    run_id=run_id,
                    repo_external_id=repo_external_id,
                    coding_agent_state=coding_agent_state,
                )

                if not repo_store_success:
                    store_success = False
                    logger.warning(
                        "coding_agent.seer_store_failed",
                        extra={
                            "organization_id": organization.id,
                            "run_id": run_id,
                            "repo_external_id": repo_external_id,
                            "repo_name": repo_name,
                        },
                    )

                results.append(
                    {
                        "repo_name": repo_name,
                        "result": result,
                        "coding_agent_state": coding_agent_state,
                    }
                )

            except Exception as e:
                logger.exception(
                    "coding_agent.repo_launch_error",
                    extra={
                        "organization_id": organization.id,
                        "run_id": run_id,
                        "repo_name": repo_name,
                        "error": str(e),
                    },
                )
                # Continue with other repos instead of failing entirely
                continue

        return results, store_success

    def post(self, request: Request, organization) -> Response:
        """Launch a coding agent."""
        try:
            # Validate request and get integration
            validation_result = self._validate_and_get_integration(request, organization)
            if isinstance(validation_result, Response):
                return validation_result
            integration, installation = validation_result

            # Get autofix state
            run_id, autofix_state = self._get_autofix_state(request, organization)
            if run_id is None:
                return Response({"error": "Invalid run_id format"}, status=400)
            if autofix_state is None:
                return Response({"error": "Autofix state not found"}, status=400)

            logger.info(
                "coding_agent.launch_request",
                extra={
                    "organization_id": organization.id,
                    "integration_id": integration.id,
                    "run_id": run_id,
                },
            )

            # Launch agents for all repos
            results, store_success = self._launch_agents_for_repos(
                installation, autofix_state, run_id, organization
            )

            if not results:
                return Response({"error": "No agents were successfully launched"}, status=500)

            logger.info(
                "coding_agent.launch_success",
                extra={
                    "organization_id": organization.id,
                    "integration_id": integration.id,
                    "provider": integration.provider,
                    "run_id": run_id,
                    "repos_processed": len(results),
                },
            )

            metrics.incr("coding_agent.launch", tags={"provider": integration.provider})

            # Return the result from the first successful launch for backward compatibility
            first_result = results[0]
            return Response(
                {
                    "status": "launched",
                    "integration_id": str(integration.id),
                    "provider": integration.provider,
                    "webhook_url": installation.get_webhook_url(),
                    "result": first_result["result"],
                    "repos_processed": len(results),
                    "store_success": store_success,
                }
            )

        except Exception as e:
            logger.exception(
                "coding_agent.launch_error",
                extra={
                    "organization_id": organization.id,
                    "integration_id": request.data.get("integration_id"),
                    "error": str(e),
                },
            )
            metrics.incr("coding_agent.launch_error")
            return Response({"error": f"Failed to launch coding agent: {str(e)}"}, status=500)
