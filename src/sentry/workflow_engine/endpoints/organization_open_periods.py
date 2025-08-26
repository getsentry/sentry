from __future__ import annotations

from typing import Any

from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationDetectorPermission, OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidParams
from sentry.models.group import Group
from sentry.models.groupopenperiod import OpenPeriod, get_open_periods_for_group
from sentry.models.organization import Organization
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.detector_group import DetectorGroup


@region_silo_endpoint
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
            detector = Detector.objects.select_related("project").get(id=detector_id)
        except (Detector.DoesNotExist, ValueError):
            raise ValidationError({"detector_id": "Detector not found"})

        if detector.project.organization_id != organization.id:
            raise ValidationError({"detector_id": "Detector not found"})

        detector_group = (
            DetectorGroup.objects.filter(detector=detector).order_by("-date_added").first()
        )

        return detector_group.group if detector_group else None

    def get_group_from_group_id(self, group_id: str, organization: Organization) -> Group | None:
        try:
            group = Group.objects.select_related("project").get(id=group_id)
        except (Group.DoesNotExist, ValueError):
            raise ValidationError({"group_id": "Group not found"})

        if group.project.organization_id != organization.id:
            raise ValidationError({"group_id": "Group not found"})

        return group

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Return a list of open periods for a group, identified by either detector_id or group_id.
        """
        try:
            start, end = get_date_range_from_params(request.GET, optional=True)
        except InvalidParams:
            raise ParseError(detail="Invalid date range")

        detector_id_param = request.GET.get("detector_id")
        group_id_param = request.GET.get("group_id")

        if not detector_id_param and not group_id_param:
            raise ValidationError({"detail": "Must provide either detector_id or group_id"})
        if detector_id_param and group_id_param:
            raise ValidationError({"detail": "Must provide only one of detector_id or group_id"})

        target_group: Group | None = (
            self.get_group_from_detector_id(detector_id_param, organization)
            if detector_id_param
            else (
                self.get_group_from_group_id(group_id_param, organization)
                if group_id_param
                else None
            )
        )

        def data_fn(offset: int, limit: int) -> list[OpenPeriod] | list[Any]:
            if target_group is None:
                return []
            return get_open_periods_for_group(
                group=target_group,
                query_start=start,
                query_end=end,
                offset=offset,
                limit=limit,
            )

        return self.paginate(
            request=request,
            on_results=lambda results: [result.to_dict() for result in results],
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )
