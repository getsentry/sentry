from __future__ import annotations

import logging
import secrets
import string

import orjson
from django.conf import settings
from requests import HTTPError
from rest_framework import serializers, status
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationEventPermission
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
)
from sentry.seer.models import SeerApiError
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


class OrganizationCodingAgentLaunchSerializer(serializers.Serializer[dict[str, object]]):
    integration_id = serializers.IntegerField(required=True)
    run_id = serializers.IntegerField(required=True, min_value=1)
    trigger_source = serializers.ChoiceField(
        choices=[AutofixTriggerSource.ROOT_CAUSE, AutofixTriggerSource.SOLUTION],
        default=AutofixTriggerSource.SOLUTION,
        required=False,
    )


@region_silo_endpoint
class OrganizationCodingAgentsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationEventPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
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

    def post(self, request: Request, organization: Organization) -> Response:
        """Launch a coding agent."""
        if not features.has("organizations:seer-coding-agent-integrations", organization):
            return self.respond(
                {"detail": "Feature not available"}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = OrganizationCodingAgentLaunchSerializer(data=request.data)
        if not serializer.is_valid():
            raise ValidationError(serializer.errors)

        validated = serializer.validated_data

        run_id = validated["run_id"]
        integration_id = validated["integration_id"]
        trigger_source = validated["trigger_source"]

        integration, installation = self._validate_and_get_integration(
            request, organization, integration_id
        )

        autofix_state = self._get_autofix_state(run_id, organization)
        if autofix_state is None:
            return self.respond(
                {"detail": "Autofix state not found"}, status=status.HTTP_400_BAD_REQUEST
            )

        logger.info(
            "coding_agent.launch_request",
            extra={
                "organization_id": organization.id,
                "integration_id": integration.id,
                "run_id": run_id,
            },
        )

        results = self._launch_agents_for_repos(
            installation, autofix_state, run_id, organization, trigger_source
        )

        if not results:
            return self.respond(
                {"detail": "No agents were launched"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

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

        return self.respond(
            {
                "success": True,
            }
        )

    def _validate_and_get_integration(self, request: Request, organization, integration_id: int):
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

    def _get_autofix_state(self, run_id: int, organization: Organization) -> AutofixState | None:
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

    def _extract_repos_from_root_cause(self, autofix_state: AutofixState) -> list[str]:
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

    def _extract_repos_from_solution(self, autofix_state: AutofixState) -> list[str]:
        """Extract repository names from autofix state solution."""
        repos = set()
        solution_step = next(
            (step for step in autofix_state.steps if step["key"] == "solution"), None
        )

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
        self,
        installation: CodingAgentIntegration,
        autofix_state: AutofixState,
        run_id: int,
        organization,
        trigger_source: AutofixTriggerSource,
    ) -> list[dict]:
        """Launch coding agents for all repositories in the solution."""

        repos = set(
            self._extract_repos_from_root_cause(autofix_state)
            if trigger_source == AutofixTriggerSource.ROOT_CAUSE
            else self._extract_repos_from_solution(autofix_state)
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
            raise NotFound("No repos to run agents")

        prompt = get_coding_agent_prompt(run_id, trigger_source)

        if not prompt:
            raise APIException("No prompt to send to agents.")

        results = []
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
                # Continue with other repos instead of failing entirely
                continue

            launch_request = CodingAgentLaunchRequest(
                prompt=prompt,
                repository=repo,
                branch_name=sanitize_branch_name(autofix_state.request.issue["title"]),
            )

            try:
                coding_agent_state = installation.launch(launch_request)
            except (HTTPError, ApiError):
                logger.exception(
                    "coding_agent.repo_launch_error",
                    extra={
                        "organization_id": organization.id,
                        "run_id": run_id,
                        "repo_name": repo_name,
                    },
                )
                continue

            states_to_store.append(coding_agent_state)

            results.append(
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

        return results
