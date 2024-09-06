from collections.abc import Sequence

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.metrics_code_locations import MetricCodeLocationsSerializer
from sentry.api.utils import get_date_range_from_params
from sentry.models.organization import Organization
from sentry.sentry_metrics.querying.metadata import MetricCodeLocations, get_metric_code_locations
from sentry.utils.cursors import Cursor, CursorResult


@region_silo_endpoint
class OrganizationMetricsCodeLocationsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    """
    Gets the code locations of a metric.
    """

    def get(self, request: Request, organization: Organization) -> Response:
        start, end = get_date_range_from_params(request.GET)
        projects = self.get_projects(request, organization)

        def data_fn(offset: int, limit: int) -> tuple[bool, Sequence[MetricCodeLocations]]:
            return get_metric_code_locations(
                mris=[request.GET["metric"]],
                start=start,
                end=end,
                organization=organization,
                projects=projects,
                offset=offset,
                limit=limit,
            )

        def on_results(data: tuple[bool, Sequence[MetricCodeLocations]]):
            return serialize(data, request.user, MetricCodeLocationsSerializer())

        return self.paginate(
            request=request,
            paginator=MetricsCodeLocationsPaginator(data_fn=data_fn),
            on_results=on_results,
        )


class MetricsCodeLocationsPaginator(GenericOffsetPaginator):
    def get_result(
        self, limit: int, cursor: Cursor | None = None
    ) -> CursorResult[Sequence[MetricCodeLocations]]:
        assert limit > 0

        offset = cursor.offset if isinstance(cursor, Cursor) else 0

        has_more, data = self.data_fn(offset=offset, limit=limit)

        return CursorResult(
            data,
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, has_more),
        )
