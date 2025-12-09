from copy import deepcopy
from typing import Any

from jsonschema import validate
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.prevent.models import PreventAIConfiguration
from sentry.prevent.types.config import (
    ORG_CONFIG_SCHEMA,
    PREVENT_AI_CONFIG_DEFAULT,
    PREVENT_AI_CONFIG_DEFAULT_V1,
)


class PreventAIConfigPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        # allow any organization member to update the PR review config
        "PUT": ["org:read", "org:write", "org:admin"],
    }


@region_silo_endpoint
class OrganizationPreventGitHubConfigEndpoint(OrganizationEndpoint):
    """
    Get and set the GitHub PR review config for a Sentry organization
    """

    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (PreventAIConfigPermission,)

    def get(
        self, request: Request, organization: Organization, git_organization_name: str
    ) -> Response:
        """
        Get the Prevent AI GitHub configuration for a specific git organization.
        """
        github_org_integrations = integration_service.get_organization_integrations(
            organization_id=organization.id,
            providers=[IntegrationProviderSlug.GITHUB.value],
            status=ObjectStatus.ACTIVE,
            name=git_organization_name,
        )
        if not github_org_integrations:
            return Response({"detail": "GitHub integration not found"}, status=404)

        config = PreventAIConfiguration.objects.filter(
            organization_id=organization.id,
            integration_id=github_org_integrations[0].integration_id,
        ).first()

        default_config = PREVENT_AI_CONFIG_DEFAULT
        if features.has("organizations:code-review-run-per-commit", organization):
            default_config = PREVENT_AI_CONFIG_DEFAULT_V1

        response_data: dict[str, Any] = deepcopy(default_config)
        if config:
            response_data["organization"] = config.data

        return Response(response_data, status=200)

    def put(
        self, request: Request, organization: Organization, git_organization_name: str
    ) -> Response:
        """
        Update the Prevent AI GitHub configuration for an organization.
        """
        try:
            validate(request.data, ORG_CONFIG_SCHEMA)
        except Exception:
            return Response({"detail": "Invalid config"}, status=400)

        github_org_integrations = integration_service.get_organization_integrations(
            organization_id=organization.id,
            providers=[IntegrationProviderSlug.GITHUB.value],
            status=ObjectStatus.ACTIVE,
            name=git_organization_name,
        )
        if not github_org_integrations:
            return Response({"detail": "GitHub integration not found"}, status=404)

        PreventAIConfiguration.objects.update_or_create(
            organization_id=organization.id,
            integration_id=github_org_integrations[0].integration_id,
            defaults={"data": request.data},
        )

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=organization.id,
            event=audit_log.get_event_id("PREVENT_CONFIG_EDIT"),
            data={
                "git_organization": git_organization_name,
                "provider": "github",
            },
        )

        response_data: dict[str, Any] = deepcopy(PREVENT_AI_CONFIG_DEFAULT)
        response_data["organization"] = request.data

        return Response(response_data, status=200)
