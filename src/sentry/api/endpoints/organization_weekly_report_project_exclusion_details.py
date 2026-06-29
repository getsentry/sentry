from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.weeklyreportprojectexclusion import WeeklyReportProjectExclusion


@cell_silo_endpoint
class OrganizationWeeklyReportProjectExclusionDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUE_DETECTION_BACKEND

    def delete(
        self, request: Request, organization: Organization, project_id_or_slug: str
    ) -> Response:
        if not features.has(
            "organizations:weekly-report-project-exclusions", organization, actor=request.user
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)

        try:
            project_id = int(project_id_or_slug)
            project = Project.objects.get(
                organization_id=organization.id,
                id=project_id,
            )
        except (ValueError, Project.DoesNotExist):
            try:
                project = Project.objects.get(
                    organization_id=organization.id,
                    slug=project_id_or_slug,
                )
            except Project.DoesNotExist:
                return Response(status=status.HTTP_404_NOT_FOUND)

        deleted, _ = WeeklyReportProjectExclusion.objects.filter(
            user_id=request.user.id,  # type: ignore[misc]
            project=project,
        ).delete()

        if not deleted:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(status=status.HTTP_204_NO_CONTENT)
