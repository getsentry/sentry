from collections.abc import Sequence
from datetime import datetime, timedelta, timezone

from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEventsV2EndpointBase
from sentry.api.bases.organization import (
    NoProjects,
    OrganizationAndStaffPermission,
    OrganizationEndpoint,
    OrganizationMetricsPermission,
    OrganizationPermission,
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.metrics_code_locations import MetricCodeLocationsSerializer
from sentry.api.utils import get_date_range_from_params, handle_query_errors
from sentry.exceptions import InvalidParams, InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.sentry_metrics.querying.data_v2 import (
    MetricsAPIQueryTransformer,
    MetricsQueriesPlan,
    run_metrics_queries_plan,
)
from sentry.sentry_metrics.querying.errors import (
    InvalidMetricsQueryError,
    LatestReleaseNotFoundError,
    MetricsQueryExecutionError,
)
from sentry.sentry_metrics.querying.metadata import MetricCodeLocations, get_metric_code_locations
from sentry.sentry_metrics.querying.samples_list import get_sample_list_executor_cls
from sentry.sentry_metrics.querying.types import QueryOrder, QueryType
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import string_to_use_case_id
from sentry.snuba.metrics import (
    QueryDefinition,
    get_all_tags,
    get_metrics_meta,
    get_series,
    get_single_metric_info,
    get_tag_values,
)
from sentry.snuba.metrics.naming_layer.mri import is_mri
from sentry.snuba.metrics.utils import DerivedMetricException, DerivedMetricParseException
from sentry.snuba.referrer import Referrer
from sentry.snuba.sessions_v2 import InvalidField
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import metrics
from sentry.utils.cursors import Cursor, CursorResult
from sentry.utils.dates import get_rollup_from_request, parse_stats_period

DEFAULT_USE_CASE_IDS = [
    UseCaseID.TRANSACTIONS,
    UseCaseID.SESSIONS,
    UseCaseID.SPANS,
    UseCaseID.CUSTOM,
]


def get_use_case_id(request: Request) -> UseCaseID:
    """
    Get useCase from query params and validate it against UseCaseID enum type
    Raise a ParseError if the use_case parameter is invalid.
    """

    try:
        use_case_param = request.GET.get("useCase", "sessions")
        return string_to_use_case_id(use_case_param)
    except ValueError:
        raise ParseError(
            detail=f"Invalid useCase parameter. Please use one of: {[uc.value for uc in UseCaseID]}"
        )


def get_use_case_ids(request: Request) -> Sequence[UseCaseID]:
    """
    Gets use case ids from the query params and validates them again the `UseCaseID` enum type.

    If an empty list is supplied, the use case ids in `DEFAULT_USE_CASE_IDS` will be used.
    """

    try:
        use_case_params = request.GET.getlist("useCase", DEFAULT_USE_CASE_IDS)
        return [string_to_use_case_id(use_case_param) for use_case_param in use_case_params]
    except ValueError:
        raise ParseError(
            detail=f"Invalid useCase parameter. Please use one of: {[uc.value for uc in UseCaseID]}"
        )


class OrganizationMetricsEnrollPermission(OrganizationPermission):
    scope_map = {"PUT": ["org:read", "org:write", "org:admin"]}


@region_silo_endpoint
class OrganizationMetricsEnrollEndpoint(OrganizationEndpoint):
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (OrganizationMetricsEnrollPermission,)

    """Enroll an organization in the custom metrics beta."""

    def put(self, request: Request, organization) -> Response:
        enroll = (request.GET.get("enroll") or "true") == "true"
        organization.update_option("sentry:custom_metrics_access", enroll)
        return Response(status=200)


@region_silo_endpoint
class OrganizationMetricsDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (OrganizationAndStaffPermission,)

    """Get the metadata of all the stored metrics including metric name, available operations and metric unit"""

    def get(self, request: Request, organization) -> Response:
        projects = self.get_projects(request, organization)
        if not projects:
            raise InvalidParams("You must supply at least one project to see its metrics")

        start, end = get_date_range_from_params(request.GET)

        metrics = get_metrics_meta(
            projects=projects, use_case_ids=get_use_case_ids(request), start=start, end=end
        )

        return Response(metrics, status=200)


@region_silo_endpoint
class OrganizationMetricDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    """Get metric name, available operations, metric unit and available tags"""

    def get(self, request: Request, organization, metric_name) -> Response:
        # Right now this endpoint is not used, however we are planning an entire refactor of
        # the metrics endpoints.
        projects = self.get_projects(request, organization)
        if not projects:
            raise InvalidParams(
                "You must supply at least one project to see the details of a metric"
            )

        try:
            metric = get_single_metric_info(
                projects=projects,
                metric_name=metric_name,
                use_case_id=get_use_case_id(request),
            )
        except InvalidParams as exc:
            raise ResourceDoesNotExist(detail=str(exc))
        except (InvalidField, DerivedMetricParseException) as exc:
            raise ParseError(detail=str(exc))

        return Response(metric, status=200)


@region_silo_endpoint
class OrganizationMetricsTagsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (OrganizationAndStaffPermission,)

    """Get list of tag names for this project

    If the ``metric`` query param is provided, only tags for a certain metric
    are provided.

    If the ``metric`` query param is provided more than once, the *intersection*
    of available tags is used.
    """

    def get(self, request: Request, organization) -> Response:
        metric_names = request.GET.getlist("metric") or []
        projects = self.get_projects(request, organization)
        if not projects:
            raise InvalidParams("You must supply at least one project to see the tag names")

        start, end = get_date_range_from_params(request.GET)

        try:
            tags = get_all_tags(
                projects=projects,
                metric_names=metric_names,
                use_case_id=get_use_case_id(request),
                start=start,
                end=end,
            )
        except (InvalidParams, DerivedMetricParseException) as exc:
            raise (ParseError(detail=str(exc)))

        return Response(tags, status=200)


@region_silo_endpoint
class OrganizationMetricsTagDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    """Get all existing tag values for a metric"""

    def get(self, request: Request, organization, tag_name) -> Response:
        metric_names = request.GET.getlist("metric") or []
        projects = self.get_projects(request, organization)
        if not projects:
            raise InvalidParams("You must supply at least one project to see the tag values")

        start, end = get_date_range_from_params(request.GET)

        try:
            tag_values = get_tag_values(
                projects=projects,
                tag_name=tag_name,
                metric_names=metric_names,
                use_case_id=get_use_case_id(request),
                start=start,
                end=end,
            )
        except (InvalidParams, DerivedMetricParseException) as exc:
            raise ParseError(str(exc))

        return Response(tag_values, status=200)


@region_silo_endpoint
class OrganizationMetricsDataEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (OrganizationAndStaffPermission,)

    """Get the time series data for one or more metrics.

    The data can be filtered and grouped by tags.
    Based on `OrganizationSessionsEndpoint`.
    """

    # still 40 req/s but allows for bursts of 200 up to req/s for dashboard loading
    default_rate_limit = RateLimit(200, 5)

    rate_limits = {
        "GET": {
            RateLimitCategory.IP: default_rate_limit,
            RateLimitCategory.USER: default_rate_limit,
            RateLimitCategory.ORGANIZATION: default_rate_limit,
        },
    }

    # Number of groups returned for each page (applies to old endpoint).
    default_per_page = 50

    def get(self, request: Request, organization) -> Response:
        projects = self.get_projects(request, organization)

        def data_fn(offset: int, limit: int):
            try:
                query = QueryDefinition(
                    projects,
                    request.GET,
                    allow_mri=True,
                    paginator_kwargs={"limit": limit, "offset": offset},
                )
                data = get_series(
                    projects,
                    metrics_query=query.to_metrics_query(),
                    use_case_id=get_use_case_id(request),
                    tenant_ids={"organization_id": organization.id},
                )
                data["query"] = query.query
            except (
                InvalidParams,
                DerivedMetricException,
            ) as exc:
                raise (ParseError(detail=str(exc)))
            return data

        return self.paginate(
            request,
            paginator=MetricsDataSeriesPaginator(data_fn=data_fn),
            default_per_page=self.default_per_page,
            max_per_page=100,
        )


class MetricsDataSeriesPaginator(GenericOffsetPaginator):
    def get_result(self, limit, cursor=None):
        assert limit > 0
        offset = cursor.offset if cursor is not None else 0
        data = self.data_fn(offset=offset, limit=limit + 1)

        if isinstance(data.get("groups"), list):
            has_more = len(data["groups"]) == limit + 1
            if has_more:
                data["groups"].pop()
        else:
            raise NotImplementedError

        return CursorResult(
            data,
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, has_more),
        )


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
    default_rate_limit = RateLimit(200, 5)

    rate_limits = {
        "POST": {
            RateLimitCategory.IP: default_rate_limit,
            RateLimitCategory.USER: default_rate_limit,
            RateLimitCategory.ORGANIZATION: default_rate_limit,
        },
    }

    # Number of groups returned by default for each query.
    default_limit = 20

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
            return None

        formula_order = QueryOrder.from_string(order)
        if formula_order is None:
            order_choices = [v.value for v in QueryOrder]
            raise InvalidMetricsQueryError(
                f"The provided `order` is not a valid, only {order_choices} are supported"
            )

        return formula_order

    def _validate_limit(self, limit: str | None) -> int:
        if not limit:
            return self.default_limit

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

    def _metrics_queries_plan_from_request(self, request: Request) -> MetricsQueriesPlan:
        """
        Extracts the metrics queries plan from the request payload.
        """
        # TODO: maybe we could use a serializer to read the body of the request.
        metrics_queries_plan = MetricsQueriesPlan()

        queries = request.data.get("queries") or []
        for query in queries:
            metrics_queries_plan.declare_query(name=query["name"], mql=query["mql"])

        formulas = request.data.get("formulas") or []
        for formula in formulas:
            metrics_queries_plan.apply_formula(
                mql=formula["mql"],
                order=self._validate_order(formula.get("order")),
                limit=self._validate_limit(formula.get("limit")),
            )

        return metrics_queries_plan

    def _get_query_type_from_request(self, request: Request) -> QueryType:
        include_series = (request.GET.get("includeSeries") or "true") == "true"
        if include_series:
            return QueryType.TOTALS_AND_SERIES

        return QueryType.TOTALS

    def post(self, request: Request, organization) -> Response:
        try:
            if organization.id in (options.get("custom-metrics-querying-killswitched-orgs") or ()):
                return Response(
                    status=401, data={"detail": "The organization is not allowed to query metrics"}
                )

            start, end = get_date_range_from_params(request.GET)
            interval = self._interval_from_request(request)
            metrics_queries_plan = self._metrics_queries_plan_from_request(request)

            metrics.incr(
                key="ddm.metrics_api.query",
                amount=1,
                tags={
                    "within_last_7_days": self._within_last_7_days(start, end),
                    "projects_queried": self._get_projects_queried(request),
                },
            )

            results = run_metrics_queries_plan(
                metrics_queries_plan=metrics_queries_plan,
                start=start,
                end=end,
                interval=interval,
                organization=organization,
                projects=self.get_projects(request, organization),
                environments=self.get_environments(request, organization),
                referrer=Referrer.API_ORGANIZATION_METRICS_QUERY.value,
                query_type=self._get_query_type_from_request(request),
            ).apply_transformer(MetricsAPIQueryTransformer())
        except InvalidMetricsQueryError as e:
            return Response(status=400, data={"detail": str(e)})
        except LatestReleaseNotFoundError as e:
            return Response(status=404, data={"detail": str(e)})
        except MetricsQueryExecutionError as e:
            return Response(status=500, data={"detail": str(e)})

        return Response(status=200, data=results)


class MetricsSamplesSerializer(serializers.Serializer):
    mri = serializers.CharField(required=True)
    field = serializers.ListField(required=True, allow_empty=False, child=serializers.CharField())
    max = serializers.FloatField(required=False)
    min = serializers.FloatField(required=False)
    operation = serializers.CharField(required=False)
    query = serializers.CharField(required=False)
    referrer = serializers.CharField(required=False)
    sort = serializers.CharField(required=False)

    def validate_mri(self, mri: str) -> str:
        if not is_mri(mri):
            raise serializers.ValidationError(f"Invalid MRI: {mri}")

        return mri


@region_silo_endpoint
class OrganizationMetricsSamplesEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:metrics-samples-list", organization, actor=request.user):
            return Response(status=404)

        try:
            snuba_params, params = self.get_snuba_dataclass(request, organization)
        except NoProjects:
            return Response(status=404)

        try:
            rollup = get_rollup_from_request(
                request,
                params,
                default_interval=None,
                error=InvalidSearchQuery(),
            )
        except InvalidSearchQuery:
            rollup = 3600  # use a default of 1 hour

        serializer = MetricsSamplesSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        serialized = serializer.validated_data

        executor_cls = get_sample_list_executor_cls(serialized["mri"])
        if not executor_cls:
            raise ParseError(f"Unsupported MRI: {serialized['mri']}")

        sort = serialized.get("sort")
        if sort is not None:
            column = sort[1:] if sort.startswith("-") else sort
            if not executor_cls.supports_sort(column):
                raise ParseError(f"Unsupported sort: {sort} for MRI")

        executor = executor_cls(
            serialized["mri"],
            params,
            snuba_params,
            serialized["field"],
            serialized.get("operation"),
            serialized.get("query", ""),
            serialized.get("min"),
            serialized.get("max"),
            serialized.get("sort"),
            rollup,
            Referrer.API_ORGANIZATION_METRICS_SAMPLES,
        )

        with handle_query_errors():
            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=executor.execute),
                on_results=lambda results: self.handle_results_with_meta(
                    request,
                    organization,
                    params["project_id"],
                    results,
                    standard_meta=True,
                ),
            )


@region_silo_endpoint
class OrganizationMetricsCodeLocationsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    """
    Gets the code locations of a metric.
    """

    def get(self, request: Request, organization) -> Response:
        start, end = get_date_range_from_params(request.GET)
        projects = self.get_projects(request, organization)

        def data_fn(offset: int, limit: int):
            return get_metric_code_locations(
                metric_mris=[request.GET["metric"]],
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
    def get_result(self, limit, cursor=None):
        assert limit > 0
        offset = cursor.offset if cursor is not None else 0
        has_more, data = self.data_fn(offset=offset, limit=limit)

        return CursorResult(
            data,
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, has_more),
        )
