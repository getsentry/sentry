from __future__ import annotations

from datetime import datetime

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationDetectorPermission, OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params, to_valid_int_id
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, VisibilityParams
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.exceptions import InvalidParams
from sentry.models.group import Group
from sentry.models.groupopenperiod import (
    GroupOpenPeriod,
    get_open_periods_for_group,
    get_open_periods_for_groups,
    should_create_open_periods,
)
from sentry.models.organization import Organization
from sentry.workflow_engine.endpoints.serializers.group_open_period_serializer import (
    GroupOpenPeriodSerializer,
)
from sentry.workflow_engine.handlers.detector import StatefulDetectorHandler
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.detector_group import DetectorGroup


def detector_opens_new_issue_per_activation(detector: Detector) -> bool:
    detector_settings = detector.group_type.detector_settings

    if detector_settings is None or detector_settings.handler is None:
        return False

    return (
        issubclass(detector_settings.handler, StatefulDetectorHandler)
        and detector_settings.handler.activation_creates_new_issue
    )


@cell_silo_endpoint
@extend_schema(tags=["Workflows"])
class OrganizationOpenPeriodsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES

    permission_classes = (OrganizationDetectorPermission,)

    def get_detector_from_detector_id(
        self, detector_id: str, organization: Organization
    ) -> Detector:
        validated_detector_id = to_valid_int_id("detectorId", detector_id)
        try:
            detector = (
                Detector.objects.with_type_filters()
                .select_related("project")
                .get(id=validated_detector_id)
            )
        except Detector.DoesNotExist:
            raise ValidationError({"detectorId": "Detector not found"})

        if detector.linked_project.organization_id != organization.id:
            raise ValidationError({"detectorId": "Detector not found"})

        return detector

    def get_group_from_detector(self, detector: Detector) -> Group | None:
        detector_group = (
            DetectorGroup.objects.filter(detector=detector).order_by("-date_added").first()
        )

        return detector_group.group if detector_group else None

    def get_open_periods_for_detector(
        self,
        detector: Detector,
        query_start: datetime | None,
        query_end: datetime | None,
    ) -> BaseQuerySet[GroupOpenPeriod]:
        if not detector_opens_new_issue_per_activation(detector):
            latest_group = self.get_group_from_detector(detector)

            if latest_group is None:
                return GroupOpenPeriod.objects.none()

            return get_open_periods_for_group(
                group=latest_group,
                query_start=query_start,
                query_end=query_end,
            )

        if not should_create_open_periods(detector.group_type.type_id):
            return GroupOpenPeriod.objects.none()

        detector_group_ids = DetectorGroup.objects.filter(detector=detector).values_list(
            "group_id", flat=True
        )

        return get_open_periods_for_groups(
            group_ids=detector_group_ids,
            query_start=query_start,
            query_end=query_end,
        )

    def get_group_from_group_id(self, group_id: str, organization: Organization) -> Group:
        validated_group_id = to_valid_int_id("groupId", group_id)
        try:
            group = Group.objects.select_related("project").get(id=validated_group_id)
        except Group.DoesNotExist:
            raise ValidationError({"groupId": "Group not found"})

        if group.project.organization_id != organization.id:
            raise ValidationError({"groupId": "Group not found"})

        return group

    def _get_open_periods(
        self,
        request: Request,
        organization: Organization,
        detector_id: str | None,
        group_id: str | None,
        query_start: datetime | None,
        query_end: datetime | None,
    ) -> BaseQuerySet[GroupOpenPeriod]:
        if detector_id:
            detector = self.get_detector_from_detector_id(detector_id, organization)
            if not request.access.has_project_access(detector.linked_project):
                raise ValidationError({"detectorId": "Detector not found"})
            return self.get_open_periods_for_detector(detector, query_start, query_end)

        if group_id:
            group = self.get_group_from_group_id(group_id, organization)
            if not request.access.has_project_access(group.project):
                raise ValidationError({"groupId": "Group not found"})
            return get_open_periods_for_group(
                group=group,
                query_start=query_start,
                query_end=query_end,
            )

        return GroupOpenPeriod.objects.none()

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
                description="ID of the detector. Returns open periods from every issue the detector has opened if it opens a new issue per activation, otherwise from its most recent issue.",
            ),
            OpenApiParameter(
                name="groupId",
                location="query",
                required=False,
                type=str,
                description="ID of the issue group.",
            ),
            OpenApiParameter(
                name="eventId",
                location="query",
                required=False,
                type=str,
                description="ID of the event to filter open periods by.",
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
        Return a list of open periods, newest first, for either a detector or a group.
        """
        try:
            start, end = get_date_range_from_params(request.GET, optional=True)
        except InvalidParams:
            raise ParseError(detail="Invalid date range")

        detector_id_param = request.GET.get("detectorId")
        group_id_param = request.GET.get("groupId")
        event_id_param = request.GET.get("eventId")
        # determines the time we need to subtract off of each timestamp before returning the data
        bucket_size_param = request.GET.get("bucketSize", 0)

        if not detector_id_param and not group_id_param:
            raise ValidationError({"detail": "Must provide either detectorId or groupId"})
        if detector_id_param and group_id_param:
            raise ValidationError({"detail": "Must provide only one of detectorId or groupId"})

        open_periods = self._get_open_periods(
            request=request,
            organization=organization,
            detector_id=detector_id_param,
            group_id=group_id_param,
            query_start=start,
            query_end=end,
        )

        if event_id_param:
            open_periods = open_periods.filter(
                groupopenperiodactivity__event_id=event_id_param
            ).distinct()

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
