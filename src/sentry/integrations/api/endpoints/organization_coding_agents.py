from __future__ import annotations

import logging
import secrets
import string

import orjson
import requests
from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.constants import ObjectStatus
from sentry.integrations.coding_agent.integration import CodingAgentIntegration
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.coding_agent.utils import get_coding_agent_providers
from sentry.integrations.services.integration import integration_service
from sentry.seer.autofix.utils import (
    AutofixState,
    CodingAgentState,
    get_autofix_state,
    get_coding_agent_prompt,
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


def store_coding_agent_state_to_seer(run_id: int, coding_agent_state: CodingAgentState) -> bool:
    """Store coding agent state via Seer API."""
    try:
        path = "/v1/automation/autofix/coding-agent/state"
        body = orjson.dumps(
            {
                "run_id": run_id,
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
                "status_code": response.status_code,
            },
        )
        return True

    except Exception as e:
        logger.warning(
            "coding_agent.seer_store_error",
            extra={
                "run_id": run_id,
                "error": str(e),
            },
        )
        return False


@region_silo_endpoint
class OrganizationCodingAgentsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization) -> Response:
        """Get all available coding agent integrations for the organization."""
        if not features.has("organizations:seer-coding-agent-integrations", organization):
            return Response({"detail": "Feature not available"}, status=404)

        integrations = integration_service.get_integrations(
            organization_id=organization.id,
            providers=get_coding_agent_providers(),
            status=ObjectStatus.ACTIVE,
        )

        integrations_data = [
            {
                "id": str(integration.id),
                "name": integration.name,
                "provider": integration.provider,
            }
            for integration in integrations
        ]

        logger.info(
            "coding_agent.list_integrations",
            extra={"organization_id": organization.id, "count": len(integrations_data)},
        )

        return self.respond({"integrations": integrations_data})

    def _validate_and_get_integration(self, request: Request, organization):
        """Validate request and get the coding agent integration."""
        integration_id = request.data.get("integration_id")
        if not integration_id:
            return Response({"error": "integration_id is required"}, status=400)

        # Get the integration using hybrid cloud service
        try:
            integration_id_int = int(integration_id)
        except (ValueError, TypeError):
            return Response({"error": "Invalid integration_id"}, status=400)

        org_integration = integration_service.get_organization_integration(
            organization_id=organization.id,
            integration_id=integration_id_int,
        )

        if not org_integration or org_integration.status != ObjectStatus.ACTIVE:
            return Response({"error": "Integration not found"}, status=404)

        integration = integration_service.get_integration(
            organization_integration_id=org_integration.id,
            status=ObjectStatus.ACTIVE,
        )

        if not integration:
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
        trigger_source: str,
    ) -> list[dict]:
        """Launch coding agents for all repositories in the solution."""
        repos = self._extract_repos_from_solution(autofix_state)

        results = []

        for repo_name in repos:
            try:
                repo = next(
                    (
                        repo
                        for repo in autofix_state.request["repos"]
                        if f"{repo['owner']}/{repo['name']}" == repo_name
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
                    # Continue with other repos instead of failing entirely
                    continue
                prompt = get_coding_agent_prompt(run_id, trigger_source)

                if not prompt:
                    logger.warning(
                        "coding_agent.prompt_not_available",
                        extra={
                            "organization_id": organization.id,
                            "run_id": run_id,
                            "repo_name": repo_name,
                            "trigger_source": trigger_source,
                        },
                    )
                    continue

                launch_request = CodingAgentLaunchRequest(
                    prompt=prompt,
                    repository=repo,
                    branch_name=sanitize_branch_name(autofix_state.request["issue"]["title"]),
                )

                # Launch the agent
                coding_agent_state = installation.launch(launch_request)

                # Store the coding agent state to Seer
                repo_store_success = store_coding_agent_state_to_seer(
                    run_id=run_id,
                    coding_agent_state=coding_agent_state,
                )

                if not repo_store_success:
                    logger.warning(
                        "coding_agent.seer_store_failed",
                        extra={
                            "organization_id": organization.id,
                            "run_id": run_id,
                            "repo_name": repo_name,
                        },
                    )

                results.append(
                    {
                        "repo_name": repo_name,
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

        return results

    def post(self, request: Request, organization) -> Response:
        """Launch a coding agent."""
        if not features.has("organizations:seer-coding-agent-integrations", organization):
            return Response({"detail": "Feature not available"}, status=404)

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

            # Get and validate trigger_source
            trigger_source = request.data.get("trigger_source", "solution")
            if trigger_source not in ["root_cause", "solution"]:
                return Response(
                    {"error": "Invalid trigger_source. Must be 'root_cause' or 'solution'"},
                    status=400,
                )

            logger.info(
                "coding_agent.launch_request",
                extra={
                    "organization_id": organization.id,
                    "integration_id": integration.id,
                    "run_id": run_id,
                },
            )

            # Launch agents for all repos
            results = self._launch_agents_for_repos(
                installation, autofix_state, run_id, organization, trigger_source
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

            return Response(
                {
                    "success": True,
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
            return Response(
                {"error": "Failed to launch coding agent due to an internal error."}, status=500
            )
