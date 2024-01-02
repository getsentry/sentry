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
from sentry.api.serializers.models.metric_spans import MetricSpansSerializer
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidParams
from sentry.sentry_metrics.querying.metadata.code_locations import get_code_locations
from sentry.sentry_metrics.querying.metadata.metric_spans import get_spans_of_metric


class MetaType(Enum):
    CODE_LOCATIONS = "codeLocations"
    METRIC_SPANS = "metricSpans"


META_TYPE_SERIALIZER = {
    MetaType.CODE_LOCATIONS.value: CodeLocationsSerializer(),
    MetaType.METRIC_SPANS.value: MetricSpansSerializer(),
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

    def get(self, request: Request, organization) -> Response:
        start, end = get_date_range_from_params(request.GET)

        response = {}

        metric_mris = request.GET.getlist("metric", [])
        projects = self.get_projects(request, organization)

        if len(metric_mris) != 1:
            raise InvalidParams("You can only pass a single metric.")

        for meta_type in self._extract_meta_types(request):
            data: Any = {}

            if meta_type == MetaType.CODE_LOCATIONS:
                # TODO: refactor code locations to support only a single mri.
                data = get_code_locations(
                    metric_mris=metric_mris[:1],
                    start=start,
                    end=end,
                    organization=organization,
                    projects=projects,
                )
            elif meta_type == MetaType.METRIC_SPANS:
                min_value = float(request.GET["min"]) if request.GET.get("min") else None
                max_value = float(request.GET["max"]) if request.GET.get("max") else None

                if min_value and max_value and min_value > max_value:
                    raise InvalidParams("The bounds are invalid, min can't be bigger than max")

                query = request.GET.get("query")

                data = get_spans_of_metric(
                    metric_mri=metric_mris[0],
                    query=query,
                    start=start,
                    end=end,
                    min_value=min_value,
                    max_value=max_value,
                    organization=organization,
                    projects=projects,
                )

            response[meta_type.value] = serialize(
                data, request.user, META_TYPE_SERIALIZER[meta_type.value]
            )

        return Response(response, status=200)
