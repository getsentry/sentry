from copy import deepcopy

from jsonschema import validate
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.prevent.models import PreventAIConfiguration
from sentry.prevent.types.config import ORG_CONFIG_SCHEMA, PREVENT_AI_CONFIG_GITHUB_DEFAULT


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

    def get(self, request: Request, organization: Organization, git_organization: str) -> Response:
        """
        Get the Prevent AI GitHub configuration for a specific git organization.
        """
        response_data = deepcopy(PREVENT_AI_CONFIG_GITHUB_DEFAULT)

        config = PreventAIConfiguration.objects.filter(
            organization_id=organization.id, provider="github", git_organization=git_organization
        ).first()

        if config:
            response_data["github_organization"][git_organization] = config.data

        return Response(response_data, status=200)

    def put(self, request: Request, organization: Organization, git_organization: str) -> Response:
        """
        Update the Prevent AI GitHub configuration for an organization.
        """
        try:
            validate(request.data, ORG_CONFIG_SCHEMA)
        except Exception:
            return Response({"detail": "Invalid config"}, status=400)

        PreventAIConfiguration.objects.update_or_create(
            organization_id=organization.id,
            provider="github",
            git_organization=git_organization,
            defaults={"data": request.data},
        )

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=organization.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            data={"preventAiConfigGithub": "updated"},
        )

        response_data = deepcopy(PREVENT_AI_CONFIG_GITHUB_DEFAULT)
        response_data["github_organization"][git_organization] = request.data

        return Response(response_data, status=200)
