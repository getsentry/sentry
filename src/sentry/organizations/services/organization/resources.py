from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.models.team import Team, TeamStatus
from sentry.organizations.services.organization.model import RpcOrganizationResourceIds


def get_active_resource_ids(*, organization_id: int) -> RpcOrganizationResourceIds:
    """Load active resource IDs from the local cell database without hydrating models."""
    return RpcOrganizationResourceIds(
        project_ids=list(
            Project.objects.filter(
                organization_id=organization_id, status=ObjectStatus.ACTIVE
            ).values_list("id", flat=True)
        ),
        team_ids=list(
            Team.objects.filter(
                organization_id=organization_id, status=TeamStatus.ACTIVE
            ).values_list("id", flat=True)
        ),
    )
