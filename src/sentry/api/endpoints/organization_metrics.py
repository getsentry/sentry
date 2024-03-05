from collections.abc import Sequence
from datetime import datetime
from enum import Enum
from typing import Any

from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEventsV2EndpointBase
from sentry.api.bases.organization import (
    NoProjects,
    OrganizationAndStaffPermission,
    OrganizationEndpoint,
    OrganizationMetricsPermission,
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.metrics_code_locations import MetricCodeLocationsSerializer
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidParams, InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.data import run_metrics_query
from sentry.sentry_metrics.querying.data_v2 import run_metrics_queries_plan
from sentry.sentry_metrics.querying.data_v2.plan import MetricsQueriesPlan
from sentry.sentry_metrics.querying.data_v2.transformation import MetricsAPIQueryTransformer
from sentry.sentry_metrics.querying.errors import (
    InvalidMetricsQueryError,
    LatestReleaseNotFoundError,
    MetricsQueryExecutionError,
)
from sentry.sentry_metrics.querying.metadata import MetricCodeLocations, get_metric_code_locations
from sentry.sentry_metrics.querying.samples_list import get_sample_list_executor_cls
from sentry.sentry_metrics.querying.types import QueryOrder
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
from sentry.utils.cursors import Cursor, CursorResult
from sentry.utils.dates import get_rollup_from_request, parse_stats_period


class MetricMetaType(Enum):
    CODE_LOCATIONS = "codeLocations"


METRIC_META_TYPE_SERIALIZER = {
    MetricMetaType.CODE_LOCATIONS.value: MetricCodeLocationsSerializer(),
}

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
    # Number of groups returned (applies to new endpoint).
    default_limit = 20

    def _new_get(self, request: Request, organization) -> Response:
        # We first parse the interval and date, since this is dependent on the query params.
        interval = parse_stats_period(request.GET.get("interval", "1h"))
        interval = int(3600 if interval is None else interval.total_seconds())
        start, end = get_date_range_from_params(request.GET)

        limit = request.GET.get("limit")
        if not limit:
            limit = self.default_limit
        else:
            try:
                limit = int(limit)
            except ValueError:
                return Response(
                    status=400,
                    data={"detail": "The provided `limit` is invalid, an integer is required"},
                )

        try:
            results = run_metrics_query(
                fields=request.GET.getlist("field", []),
                interval=interval,
                start=start,
                end=end,
                organization=organization,
                projects=self.get_projects(request, organization),
                environments=self.get_environments(request, organization),
                referrer=Referrer.API_ORGANIZATION_METRICS_DATA.value,
                # Optional parameters.
                query=request.GET.get("query"),
                group_bys=request.GET.getlist("groupBy"),
                order_by=request.GET.get("orderBy"),
                limit=limit,
            )
        except InvalidMetricsQueryError as e:
            return Response(status=400, data={"detail": str(e)})
        except LatestReleaseNotFoundError as e:
            return Response(status=404, data={"detail": str(e)})
        except MetricsQueryExecutionError as e:
            return Response(status=500, data={"detail": str(e)})

        return Response(status=200, data=results)

    def _old_get(self, request: Request, organization) -> Response:
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

    def get(self, request: Request, organization) -> Response:
        use_new_metrics_layer = request.GET.get("useNewMetricsLayer", "false") == "true"
        if use_new_metrics_layer:
            return self._new_get(request, organization)
        else:
            return self._old_get(request, organization)


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

    def post(self, request: Request, organization) -> Response:
        try:
            start, end = get_date_range_from_params(request.GET)
            interval = self._interval_from_request(request)
            metrics_queries_plan = self._metrics_queries_plan_from_request(request)

            results = run_metrics_queries_plan(
                metrics_queries_plan=metrics_queries_plan,
                start=start,
                end=end,
                interval=interval,
                organization=organization,
                projects=self.get_projects(request, organization),
                environments=self.get_environments(request, organization),
                referrer=Referrer.API_ORGANIZATION_METRICS_QUERY.value,
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
            serialized.get("query", ""),
            serialized.get("min"),
            serialized.get("max"),
            serialized.get("sort"),
            rollup,
            Referrer.API_ORGANIZATION_METRICS_SAMPLES,
        )

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
class OrganizationMetricsMetadataEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    """
    Get metadata of a metric for a given set of projects in a time interval.
    The current metadata supported for metrics is:
    - Code locations -> these are the code location in which the metric was emitted.
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
            except LatestReleaseNotFoundError as e:
                return Response(status=404, data={"detail": str(e)})

            response[meta_type.value] = serialize(
                data, request.user, METRIC_META_TYPE_SERIALIZER[meta_type.value]
            )

        return Response(response, status=200)
