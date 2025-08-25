from __future__ import annotations

from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationDetectorPermission, OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidParams
from sentry.models.groupopenperiod import OpenPeriod, get_open_periods_for_group
from sentry.models.organization import Organization
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.detector_group import DetectorGroup


@region_silo_endpoint
class OrganizationDetectorOpenPeriodsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES

    permission_classes = (OrganizationDetectorPermission,)

    def convert_args(self, request: Request, detector_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        try:
            detector = Detector.objects.select_related("project").get(id=detector_id)
            if detector.project.organization_id != kwargs["organization"].id:
                raise ResourceDoesNotExist
            kwargs["detector"] = detector
        except Detector.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs

    def get(self, request: Request, organization: Organization, detector: Detector) -> Response:
        """
        Return a list of open periods for the latest group linked to a detector
        """
        try:
            start, end = get_date_range_from_params(request.GET, optional=True)
        except InvalidParams:
            raise ParseError(detail="Invalid date range")

        # This endpoint will only be useful for detectors that are linked to a single group,
        # but we'll query for the latest one just in case
        detector_group = (
            DetectorGroup.objects.filter(detector=detector).order_by("-date_added").first()
        )

        def data_fn(offset: int, limit: int) -> list[OpenPeriod]:
            if detector_group is None:
                return []

            return get_open_periods_for_group(
                group=detector_group.group,
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
