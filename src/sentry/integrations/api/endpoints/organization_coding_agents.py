from __future__ import annotations

import logging
from typing import TypedDict

from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationEventPermission
from sentry.constants import ObjectStatus
from sentry.integrations.coding_agent.utils import get_coding_agent_providers
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.seer.autofix.coding_agent import launch_coding_agents_for_run
from sentry.seer.autofix.utils import AutofixTriggerSource

logger = logging.getLogger(__name__)


class LaunchFailure(TypedDict):
    repo_name: str
    error_message: str


class LaunchResponse(TypedDict, total=False):
    success: bool
    launched_count: int
    failed_count: int
    failures: list[LaunchFailure]


class OrganizationCodingAgentLaunchSerializer(serializers.Serializer[dict[str, object]]):
    integration_id = serializers.IntegerField(required=True)
    run_id = serializers.IntegerField(required=True, min_value=1)
    trigger_source = serializers.ChoiceField(
        choices=[AutofixTriggerSource.ROOT_CAUSE, AutofixTriggerSource.SOLUTION],
        default=AutofixTriggerSource.SOLUTION,
        required=False,
    )
    instruction = serializers.CharField(required=False, allow_blank=True, max_length=4096)


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
        serializer = OrganizationCodingAgentLaunchSerializer(data=request.data)
        if not serializer.is_valid():
            raise ValidationError(serializer.errors)

        validated = serializer.validated_data

        run_id = validated["run_id"]
        integration_id = validated["integration_id"]
        trigger_source = validated["trigger_source"]
        instruction = validated.get("instruction")

        results = launch_coding_agents_for_run(
            organization_id=organization.id,
            integration_id=integration_id,
            run_id=run_id,
            trigger_source=trigger_source,
            instruction=instruction,
        )

        successes = results["successes"]
        failures = results["failures"]

        response_data: LaunchResponse = {
            "success": True,
            "launched_count": len(successes),
            "failed_count": len(failures),
        }

        if failures:
            response_data["failures"] = failures

        return self.respond(response_data)
