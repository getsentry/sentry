"""
API endpoint for manually triggering GitHub team synchronization.
"""
import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.permissions import OrganizationPermission
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.types import ExternalProviders
from sentry.tasks.github_team_sync import sync_github_teams_for_organization

logger = logging.getLogger(__name__)


class OrganizationGitHubTeamSyncPermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:integrations"],
    }


@region_silo_endpoint
class OrganizationGitHubTeamSyncEndpoint(OrganizationEndpoint):
    """
    API endpoint to manually trigger GitHub team synchronization for an organization.

    This endpoint allows administrators to manually sync GitHub team names with
    stored ExternalActor mappings, which is useful for immediate updates or
    troubleshooting synchronization issues.
    """

    owner = ApiOwner.ENTERPRISE
    permission_classes = (OrganizationGitHubTeamSyncPermission,)
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, organization) -> Response:
        """
        Manually trigger GitHub team synchronization for the organization.

        This will queue a background task to sync all GitHub team mappings
        for the organization.
        """
        # Check if the organization has any GitHub team mappings
        github_providers = [
            ExternalProviders.GITHUB.value,
            ExternalProviders.GITHUB_ENTERPRISE.value,
        ]

        has_github_teams = ExternalActor.objects.filter(
            organization=organization,
            provider__in=github_providers,
            team__isnull=False,
        ).exists()

        if not has_github_teams:
            return Response(
                {
                    "detail": "No GitHub team mappings found for this organization.",
                    "organization_id": organization.id,
                },
                status=404,
            )

        # Queue the sync task
        sync_github_teams_for_organization.delay(organization.id)

        logger.info(
            "github_team_sync.manual_trigger",
            extra={
                "organization_id": organization.id,
                "organization_slug": organization.slug,
                "triggered_by": request.user.id if request.user.is_authenticated else None,
            }
        )

        return Response(
            {
                "detail": "GitHub team synchronization has been queued.",
                "organization_id": organization.id,
                "organization_slug": organization.slug,
            },
            status=202,
        )
