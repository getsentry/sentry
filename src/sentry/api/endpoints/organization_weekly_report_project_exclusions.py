from django.db import router, transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.models.weeklyreportprojectexclusion import WeeklyReportProjectExclusion


class OrganizationWeeklyReportProjectExclusionsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
    }


@cell_silo_endpoint
class OrganizationWeeklyReportProjectExclusionsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationWeeklyReportProjectExclusionsPermission,)
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUE_DETECTION_BACKEND

    def get(self, request: Request, organization: Organization) -> Response:
        assert request.user and request.user.id

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
        assert request.user and request.user.id

        project_ids = request.data.get("projectIds", [])
        if not isinstance(project_ids, list) or not all(
            isinstance(pid, int) for pid in project_ids
        ):
            return Response(
                {"detail": "projectIds must be a list of integers"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        requested_project_ids = set(project_ids)

        if requested_project_ids:
            projects = self.get_projects(
                request=request,
                organization=organization,
                project_ids=requested_project_ids,
            )
            validated_project_ids = {p.id for p in projects}
        else:
            validated_project_ids = set()

        with transaction.atomic(using=router.db_for_write(WeeklyReportProjectExclusion)):
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
                    ],
                    ignore_conflicts=True,
                )

        return Response(status=status.HTTP_204_NO_CONTENT)
