from typing import int
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.permissions import StaffPermission
from sentry.api.utils import get_date_range_from_params
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.ratelimits.config import RateLimitConfig
from sentry.sentry_metrics.querying.data import (
    MetricsAPIQueryResultsTransformer,
    MQLQuery,
    run_queries,
)
from sentry.sentry_metrics.querying.types import QueryOrder, QueryType
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import STRING_NOT_FOUND, resolve_weak
from sentry.snuba.metrics import SpanMRI
from sentry.snuba.referrer import Referrer
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.dates import parse_stats_period


@region_silo_endpoint
class OrganizationDynamicSamplingAdminMetricsEndpoint(OrganizationEndpoint):
    """
    The purpose of this endpoint is to provide a way to query metrics for
    dynamic sampling that can be displayed in admin and used to debug
    dynamic sampling.
    """

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (StaffPermission,)

    # 60 req/s to allow for metric dashboard loading
    default_rate_limit = RateLimit(limit=60, window=1)

    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: default_rate_limit,
                RateLimitCategory.USER: default_rate_limit,
                RateLimitCategory.ORGANIZATION: default_rate_limit,
            },
        }
    )

    default_per_page = 50

    def get(self, request: Request, organization: Organization) -> Response:
        start, end = get_date_range_from_params(request.GET)
        # We are purposely not filtering on team membership, as all users should be able to see the span counts
        # in order to show the dynamic sampling settings page with all valid data. Please do not remove this
        # without consulting the owner of the endpoint
        projects = list(
            Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE)
        )

        transformer = MetricsAPIQueryResultsTransformer()

        # Try to resolve the `target_project_id` tag first, as otherwise the query will
        # fail to resolve the column and raise a validation error.
        # When the tag is not present, we can simply return with an empty result set, as this
        # means that there are no spans ingested yet.
        if resolve_weak(UseCaseID.SPANS, organization.id, "target_project_id") == STRING_NOT_FOUND:
            results = transformer.transform([])
            return Response(status=200, data=results)

        mql = f"sum({SpanMRI.COUNT_PER_ROOT_PROJECT.value}) by (project,target_project_id,transaction)"
        query = MQLQuery(mql=mql, order=QueryOrder.DESC, limit=10000)
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
        ).apply_transformer(transformer)

        return Response(status=200, data=results)

    def _interval_from_request(self, request: Request) -> int:
        """
        Extracts the interval of the query from the request payload.
        """
        interval = parse_stats_period(request.GET.get("interval", "1h"))
        return int(3600 if interval is None else interval.total_seconds())
