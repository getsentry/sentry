from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.helpers.projects import parse_id_or_slug_params
from sentry.models.organization import Organization
from sentry.models.weeklyreportprojectexclusion import WeeklyReportProjectExclusion


class OrganizationWeeklyReportProjectExclusionDetailsPermission(OrganizationPermission):
    scope_map = {
        "DELETE": ["org:read", "org:write", "org:admin"],
    }


@cell_silo_endpoint
class OrganizationWeeklyReportProjectExclusionDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationWeeklyReportProjectExclusionDetailsPermission,)
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUE_DETECTION_BACKEND

    def delete(
        self, request: Request, organization: Organization, project_id_or_slug: str
    ) -> Response:
        assert request.user and request.user.id

        parsed = parse_id_or_slug_params([project_id_or_slug])
        if any(pid <= 0 for pid in parsed.ids):
            return Response(status=status.HTTP_404_NOT_FOUND)
        projects = self.get_projects(
            request=request,
            organization=organization,
            project_ids=parsed.ids or None,
            project_slugs=parsed.slugs or None,
        )
        if not projects:
            return Response(status=status.HTTP_404_NOT_FOUND)

        deleted, _ = WeeklyReportProjectExclusion.objects.filter(
            user_id=request.user.id,
            project=projects[0],
        ).delete()

        if not deleted:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(status=status.HTTP_204_NO_CONTENT)
