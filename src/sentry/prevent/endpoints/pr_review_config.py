from jsonschema import validate
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.types.prevent_config import PREVENT_AI_CONFIG_GITHUB_DEFAULT, PREVENT_AI_CONFIG_SCHEMA

PREVENT_AI_CONFIG_GITHUB_OPTION = "sentry:prevent_ai_config_github"


class PreventAIConfigPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        # allow any organization member to update the PR review config
        "PUT": ["org:read", "org:write", "org:admin"],
    }


@region_silo_endpoint
class OrganizationPreventGitHubConfigEndpoint(OrganizationEndpoint):
    """
    Update the PR review config for a Sentry organization

    PUT /organizations/{organization_id_or_slug}/prevent/github/config/
    """

    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (PreventAIConfigPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get the Prevent AI GitHub configuration for an organization.
        If not explicitly set, return the default.
        """
        config = organization.get_option(PREVENT_AI_CONFIG_GITHUB_OPTION)
        if config is None:
            config = PREVENT_AI_CONFIG_GITHUB_DEFAULT
        return Response({"preventAiConfigGithub": config}, status=200)

    def put(self, request: Request, organization: Organization) -> Response:
        """
        Update the Prevent AI GitHub configuration for an organization.
        """
        config = request.data.get("config")
        if config is None:
            return Response({"detail": "Missing 'config' parameter"}, status=400)

        try:
            validate(config, PREVENT_AI_CONFIG_SCHEMA)
        except Exception:
            return Response({"detail": "Invalid config"}, status=400)

        organization.update_option(PREVENT_AI_CONFIG_GITHUB_OPTION, config)

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=organization.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            data={"preventAiConfigGithub": "updated"},
        )

        return Response({"preventAiConfigGithub": config}, status=200)
