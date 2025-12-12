from __future__ import annotations

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationDetectorPermission, OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, VisibilityParams
from sentry.exceptions import InvalidParams
from sentry.models.group import Group
from sentry.models.groupopenperiod import get_open_periods_for_group
from sentry.models.organization import Organization
from sentry.workflow_engine.endpoints.serializers.group_open_period_serializer import (
    GroupOpenPeriodSerializer,
)
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.detector_group import DetectorGroup


@region_silo_endpoint
@extend_schema(tags=["Workflows"])
class OrganizationOpenPeriodsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES

    permission_classes = (OrganizationDetectorPermission,)

    def get_group_from_detector_id(
        self, detector_id: str, organization: Organization
    ) -> Group | None:
        try:
            detector = (
                Detector.objects.with_type_filters().select_related("project").get(id=detector_id)
            )
        except (Detector.DoesNotExist, ValueError):
            raise ValidationError({"detectorId": "Detector not found"})

        if detector.project.organization_id != organization.id:
            raise ValidationError({"detectorId": "Detector not found"})

        detector_group = (
            DetectorGroup.objects.filter(detector=detector).order_by("-date_added").first()
        )

        return detector_group.group if detector_group else None

    def get_group_from_group_id(self, group_id: str, organization: Organization) -> Group | None:
        try:
            group = Group.objects.select_related("project").get(id=group_id)
        except (Group.DoesNotExist, ValueError):
            raise ValidationError({"groupId": "Group not found"})

        if group.project.organization_id != organization.id:
            raise ValidationError({"groupId": "Group not found"})

        return group

    @extend_schema(
        operation_id="Fetch Group Open Periods",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.START,
            GlobalParams.END,
            GlobalParams.STATS_PERIOD,
            VisibilityParams.PER_PAGE,
            CursorQueryParam,
            OpenApiParameter(
                name="detectorId",
                location="query",
                required=False,
                type=str,
                description="ID of the detector which is associated with the issue group.",
            ),
            OpenApiParameter(
                name="groupId",
                location="query",
                required=False,
                type=str,
                description="ID of the issue group.",
            ),
        ],
        responses={
            200: GroupOpenPeriodSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Return a list of open periods for a group, identified by either detector_id or group_id.
        """
        try:
            start, end = get_date_range_from_params(request.GET, optional=True)
        except InvalidParams:
            raise ParseError(detail="Invalid date range")

        detector_id_param = request.GET.get("detectorId")
        group_id_param = request.GET.get("groupId")
        # determines the time we need to subtract off of each timestamp before returning the data
        bucket_size_param = request.GET.get("bucketSize", 0)

        if not detector_id_param and not group_id_param:
            raise ValidationError({"detail": "Must provide either detectorId or groupId"})
        if detector_id_param and group_id_param:
            raise ValidationError({"detail": "Must provide only one of detectorId or groupId"})

        target_group: Group | None = (
            self.get_group_from_detector_id(detector_id_param, organization)
            if detector_id_param
            else (
                self.get_group_from_group_id(group_id_param, organization)
                if group_id_param
                else None
            )
        )
        if not target_group:
            return self.paginate(request=request, queryset=[])

        limit = None
        per_page = request.GET.get("per_page")
        if per_page:
            limit = int(per_page)
            assert limit > 0

        open_periods = get_open_periods_for_group(
            group=target_group,
            query_start=start,
            query_end=end,
            limit=limit,
        )
        # need to pass start, end to serializer
        return self.paginate(
            request=request,
            queryset=open_periods,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x,
                request.user,
                time_window=int(bucket_size_param),
                query_start=start,
                query_end=end,
            ),
            count_hits=True,
        )
