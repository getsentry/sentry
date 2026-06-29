from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.models.weeklyreportprojectexclusion import WeeklyReportProjectExclusion


@cell_silo_endpoint
class OrganizationWeeklyReportProjectExclusionsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUE_DETECTION_BACKEND

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:weekly-report-project-exclusions", organization, actor=request.user
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)

        queryset = WeeklyReportProjectExclusion.objects.filter(
            user_id=request.user.id,
            project__organization_id=organization.id,
        ).select_related("project")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    def put(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:weekly-report-project-exclusions", organization, actor=request.user
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)

        project_ids = request.data.get("projectIds", [])
        if not isinstance(project_ids, list):
            return Response(
                {"detail": "projectIds must be a list"}, status=status.HTTP_400_BAD_REQUEST
            )

        if project_ids:
            projects = self.get_projects(
                request=request,
                organization=organization,
                project_ids=set(project_ids),
            )
            validated_project_ids = {p.id for p in projects}
        else:
            validated_project_ids = set()

        WeeklyReportProjectExclusion.objects.filter(
            user_id=request.user.id,
            project__organization_id=organization.id,
        ).delete()

        if validated_project_ids:
            WeeklyReportProjectExclusion.objects.bulk_create(
                [
                    WeeklyReportProjectExclusion(
                        project_id=pid,
                        user_id=request.user.id,
                    )
                    for pid in validated_project_ids
                ]
            )

        return Response(status=status.HTTP_204_NO_CONTENT)
