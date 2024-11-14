from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.utils import get_date_range_from_params
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.data import (
    MetricsAPIQueryResultsTransformer,
    MQLQuery,
    run_queries,
)
from sentry.sentry_metrics.querying.types import QueryOrder, QueryType
from sentry.snuba.metrics import SpanMRI
from sentry.snuba.referrer import Referrer
from sentry.utils.dates import parse_stats_period


@region_silo_endpoint
class OrganizationSamplingProjectSpanCountsEndpoint(OrganizationEndpoint):
    """Endpoint for retrieving project span counts in all orgs."""

    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (OrganizationPermission,)
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        self._check_feature(request, organization)

        start, end = get_date_range_from_params(request.GET)
        # We are purposely not filtering on team membership, as all users should be able to see the span counts
        # in order to show the dynamic sampling settings page with all valid data. Please do not remove this
        # without consulting the owner of the endpoint
        projects = list(
            Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE)
        )
        mql = f"sum({SpanMRI.COUNT_PER_ROOT_PROJECT.value}) by (project,target_project_id)"
        query = MQLQuery(mql=mql, order=QueryOrder.DESC)
        results = run_queries(
            mql_queries=[query],
            start=start,
            end=end,
            interval=self._interval_from_request(request),
            organization=organization,
            projects=projects,
            environments=self.get_environments(request, organization),
            referrer=Referrer.DYNAMIC_SAMPLING_SETTINGS_GET_SPAN_COUNTS.value,
            query_type=QueryType.TOTALS,
        ).apply_transformer(MetricsAPIQueryResultsTransformer())

        return Response(status=200, data=results)

    def _check_feature(self, request: Request, organization: Organization) -> None:
        if not features.has(
            "organizations:dynamic-sampling-custom", organization, actor=request.user
        ):
            raise ResourceDoesNotExist

    def _interval_from_request(self, request: Request) -> int:
        """
        Extracts the interval of the query from the request payload.
        """
        interval = parse_stats_period(request.GET.get("interval", "1h"))
        return int(3600 if interval is None else interval.total_seconds())
