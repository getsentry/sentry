from collections.abc import Sequence
from datetime import datetime
from enum import Enum
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.metrics_code_locations import MetricCodeLocationsSerializer
from sentry.api.serializers.models.metrics_correlations import MetricCorrelationsSerializer
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidParams
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.errors import LatestReleaseNotFoundError
from sentry.sentry_metrics.querying.metadata import (
    MetricCodeLocations,
    MetricCorrelations,
    get_metric_code_locations,
    get_metric_correlations,
)


class MetricMetaType(Enum):
    CODE_LOCATIONS = "codeLocations"
    CORRELATIONS = "metricSpans"


METRIC_META_TYPE_SERIALIZER = {
    MetricMetaType.CODE_LOCATIONS.value: MetricCodeLocationsSerializer(),
    MetricMetaType.CORRELATIONS.value: MetricCorrelationsSerializer(),
}


@region_silo_endpoint
class OrganizationDDMMetaEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    """
    Get metadata of a metric for a given set of projects in a time interval.
    The current metadata supported for metrics is:
    - Code locations -> these are the code location in which the metric was emitted.
    - Correlations -> these are the correlations that we found for this metric.
    For now segments with spans are supported.
    """

    def _extract_metric_meta_types(self, request: Request) -> Sequence[MetricMetaType]:
        meta_types = []

        for meta_type in MetricMetaType:
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
        )[1]

    def _get_metric_correlations(
        self,
        request: Request,
        organization: Organization,
        projects: Sequence[Project],
        start: datetime,
        end: datetime,
    ) -> MetricCorrelations:
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

        for meta_type in self._extract_metric_meta_types(request):
            data: Any = {}

            try:
                if meta_type == MetricMetaType.CODE_LOCATIONS:
                    data = self._get_metric_code_locations(
                        request, organization, projects, start, end
                    )
                elif meta_type == MetricMetaType.CORRELATIONS:
                    data = self._get_metric_correlations(
                        request, organization, projects, start, end
                    )
            except LatestReleaseNotFoundError as e:
                return Response(status=404, data={"detail": str(e)})

            response[meta_type.value] = serialize(
                data, request.user, METRIC_META_TYPE_SERIALIZER[meta_type.value]
            )

        return Response(response, status=200)
