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
from sentry.api.utils import get_date_range_from_params
from sentry.sentry_metrics.querying.metadata.code_locations import get_code_locations
from sentry.sentry_metrics.querying.metadata.metric_spans import get_metric_spans


class MetaType(Enum):
    CODE_LOCATIONS = "codeLocations"
    METRIC_SPANS = "metricSpans"


META_TYPE_SERIALIZER = {
    MetaType.CODE_LOCATIONS.value: CodeLocationsSerializer(),
    # TODO: replace with new serializer for spans.
    MetaType.METRIC_SPANS.value: CodeLocationsSerializer(),
}


@region_silo_endpoint
class OrganizationDDMMetaEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    """Get meta data for one or more metrics for a given set of projects in a time interval"""
    # Returns only code locations for now

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

        for meta_type in self._extract_meta_types(request):
            response_data: Any = {}

            if meta_type == MetaType.CODE_LOCATIONS:
                response_data = get_code_locations(
                    metric_mris=metric_mris,
                    start=start,
                    end=end,
                    organization=organization,
                    projects=projects,
                )
            elif meta_type == MetaType.METRIC_SPANS:
                min_value = request.GET.get("min")
                max_value = request.GET.get("max")

                response_data = get_metric_spans(
                    metric_mris=metric_mris,
                    start=start,
                    end=end,
                    min_value=float(min_value) if min_value else None,
                    max_value=float(max_value) if max_value else None,
                    organization=organization,
                    projects=projects,
                )

            response[meta_type.value] = serialize(
                response_data, request.user, META_TYPE_SERIALIZER[meta_type.value]
            )

        return Response(response, status=200)
