from collections.abc import Sequence
from datetime import datetime, timedelta, timezone

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint, OrganizationMetricsPermission
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidParams
from sentry.models.organization import Organization
from sentry.sentry_metrics.querying.data import (
    MetricsAPIQueryResultsTransformer,
    MQLQuery,
    run_queries,
)
from sentry.sentry_metrics.querying.eap import mql_eap_bridge
from sentry.sentry_metrics.querying.errors import (
    InvalidMetricsQueryError,
    LatestReleaseNotFoundError,
    MetricsQueryExecutionError,
)
from sentry.sentry_metrics.querying.types import QueryOrder, QueryType
from sentry.snuba.referrer import Referrer
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import metrics
from sentry.utils.dates import parse_stats_period


@region_silo_endpoint
class OrganizationMetricsQueryEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (OrganizationMetricsPermission,)

    """
    Queries one or more metrics over a time range.
    """

    # still 40 req/s but allows for bursts of 200 up to req/s for dashboard loading
    default_rate_limit = RateLimit(limit=200, window=5)

    rate_limits = {
        "POST": {
            RateLimitCategory.IP: default_rate_limit,
            RateLimitCategory.USER: default_rate_limit,
            RateLimitCategory.ORGANIZATION: default_rate_limit,
        },
    }

    def _time_equal_within_bound(
        self, time_1: datetime, time_2: datetime, bound: timedelta
    ) -> bool:
        return time_2 - bound <= time_1 <= time_2 + bound

    def _within_last_7_days(self, start: datetime, end: datetime) -> bool:
        # Get current datetime in UTC
        current_datetime_utc = datetime.now(timezone.utc)

        # Calculate datetime 7 days ago in UTC
        seven_days_ago_utc = current_datetime_utc - timedelta(days=7)

        # Normalize start and end datetimes to UTC
        start_utc = start.astimezone(timezone.utc)
        end_utc = end.astimezone(timezone.utc)

        return (
            self._time_equal_within_bound(start_utc, seven_days_ago_utc, timedelta(minutes=5))
            and self._time_equal_within_bound(end_utc, current_datetime_utc, timedelta(minutes=5))
        ) or (
            self._time_equal_within_bound(end_utc, current_datetime_utc, timedelta(minutes=5))
            and (end - start).days <= 7
        )

    def _get_projects_queried(self, request: Request) -> str:
        project_ids = self.get_requested_project_ids_unchecked(request)
        if not project_ids:
            return "none"

        if len(project_ids) == 1:
            return "all" if project_ids.pop() == -1 else "single"

        return "multiple"

    def _validate_order(self, order: str | None) -> QueryOrder | None:
        if order is None:
            # By default, we want to show highest valued metrics.
            return QueryOrder.DESC

        formula_order = QueryOrder.from_string(order)
        if formula_order is None:
            order_choices = [v.value for v in QueryOrder]
            raise InvalidMetricsQueryError(
                f"The provided `order` is not a valid, only {order_choices} are supported"
            )

        return formula_order

    def _validate_limit(self, limit: str | None) -> int | None:
        if not limit:
            return None

        try:
            return int(limit)
        except ValueError:
            raise InvalidMetricsQueryError(
                "The provided `limit` is not valid, an integer is required"
            )

    def _interval_from_request(self, request: Request) -> int:
        """
        Extracts the interval of the query from the request payload.
        """
        interval = parse_stats_period(request.GET.get("interval", "1h"))
        return int(3600 if interval is None else interval.total_seconds())

    def _mql_queries_from_request(self, request: Request) -> Sequence[MQLQuery]:
        """
        Extracts the metrics queries plan from the request payload.
        """
        mql_sub_queries = {}
        for query in request.data.get("queries") or []:
            mql_sub_queries[query["name"]] = MQLQuery(query["mql"])

        mql_queries = []
        for formula in request.data.get("formulas") or []:
            mql_queries.append(
                MQLQuery(
                    mql=formula["mql"],
                    order=self._validate_order(formula.get("order")),
                    limit=self._validate_limit(formula.get("limit")),
                    **mql_sub_queries,
                )
            )

        return mql_queries

    def _get_query_type_from_request(self, request: Request) -> QueryType:
        include_series = request.GET.get("includeSeries")
        if include_series == "false":
            return QueryType.TOTALS
        return QueryType.TOTALS_AND_SERIES

    def post(self, request: Request, organization: Organization) -> Response:
        try:

            start, end = get_date_range_from_params(request.GET)
            interval = self._interval_from_request(request)
            mql_queries = self._mql_queries_from_request(request)
            projects = self.get_projects(request, organization)

            metrics.incr(
                key="ddm.metrics_api.query",
                amount=1,
                tags={
                    "within_last_7_days": self._within_last_7_days(start, end),
                    "projects_queried": self._get_projects_queried(request),
                },
            )

            if all(
                features.has("projects:use-eap-spans-for-metrics-explorer", project)
                for project in projects
            ):
                if len(mql_queries) == 1 and len(mql_queries[0].sub_queries) == 1:
                    subquery = next(iter(mql_queries[0].sub_queries.values()))
                    if "d:eap/" in subquery.mql:
                        res_data = mql_eap_bridge.make_eap_request(
                            subquery.mql,
                            start,
                            end,
                            interval,
                            organization,
                            projects,
                            Referrer.API_ORGANIZATION_METRICS_EAP_QUERY.value,
                        )
                        return Response(status=200, data=res_data)

            results = run_queries(
                mql_queries=mql_queries,
                start=start,
                end=end,
                interval=interval,
                organization=organization,
                projects=projects,
                environments=self.get_environments(request, organization),
                referrer=Referrer.API_ORGANIZATION_METRICS_QUERY.value,
                query_type=self._get_query_type_from_request(request),
            ).apply_transformer(MetricsAPIQueryResultsTransformer())
        except InvalidMetricsQueryError as e:
            return Response(status=400, data={"detail": str(e)})
        except InvalidParams as e:
            return Response(status=400, data={"detail": str(e)})
        except AssertionError as e:
            return Response(status=400, data={"detail": str(e)})
        except LatestReleaseNotFoundError as e:
            return Response(status=404, data={"detail": str(e)})
        except MetricsQueryExecutionError as e:
            return Response(status=500, data={"detail": str(e)})

        return Response(status=200, data=results)
