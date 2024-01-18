import datetime
from enum import Enum
from typing import Any, Sequence

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.code_locations import CodeLocationsSerializer
from sentry.api.serializers.models.correlations import CorrelationsSerializer
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidParams
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.metadata.code_locations import (
    MetricCodeLocations,
    get_metric_code_locations,
)
from sentry.sentry_metrics.querying.metadata.correlations import (
    Correlations,
    get_metric_correlations,
)


class MetaType(Enum):
    CODE_LOCATIONS = "codeLocations"
    # TODO: change name when we settled on the naming.
    CORRELATIONS = "metricSpans"


META_TYPE_SERIALIZER = {
    MetaType.CODE_LOCATIONS.value: CodeLocationsSerializer(),
    MetaType.CORRELATIONS.value: CorrelationsSerializer(),
}


@region_silo_endpoint
class OrganizationDDMMetaEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    """
    Get metadata for one or more metrics for a given set of projects in a time interval.
    The current metadata supported for metrics is:
    - Code locations -> these are the code location in which the metric was emitted.
    - Spans -> these are the spans in which the metric was emitted.
    """

    def _extract_meta_types(self, request: Request) -> Sequence[MetaType]:
        meta_types = []

        for meta_type in MetaType:
            if request.GET.get(meta_type.value) == "true":
                meta_types.append(meta_type)

        return meta_types

    def _get_metric_code_locations(
        self,
        request: Request,
        organization: Organization,
        projects: Sequence[Project],
        start: datetime,
        end: datetime,
    ) -> Sequence[MetricCodeLocations]:
        return get_metric_code_locations(
            metric_mris=[request.GET["metric"]],
            start=start,
            end=end,
            organization=organization,
            projects=projects,
        )

    def _get_metric_correlations(
        self,
        request: Request,
        organization: Organization,
        projects: Sequence[Project],
        start: datetime,
        end: datetime,
    ) -> Correlations:
        min_value = float(request.GET["min"]) if request.GET.get("min") else None
        max_value = float(request.GET["max"]) if request.GET.get("max") else None

        if min_value and max_value and min_value > max_value:
            raise InvalidParams("The bounds are invalid, min can't be bigger than max")

        return get_metric_correlations(
            metric_mri=request.GET["metric"],
            query=request.GET.get("query"),
            start=start,
            end=end,
            min_value=min_value,
            max_value=max_value,
            organization=organization,
            projects=projects,
            environments=self.get_environments(request, organization),
        )

    def get(self, request: Request, organization) -> Response:
        response = {}

        start, end = get_date_range_from_params(request.GET)
        projects = self.get_projects(request, organization)

        for meta_type in self._extract_meta_types(request):
            data: Any = {}

            if meta_type == MetaType.CODE_LOCATIONS:
                data = self._get_metric_code_locations(request, organization, projects, start, end)
            elif meta_type == MetaType.CORRELATIONS:
                data = self._get_metric_correlations(request, organization, projects, start, end)

            response[meta_type.value] = serialize(
                data, request.user, META_TYPE_SERIALIZER[meta_type.value]
            )

        return Response(response, status=200)
