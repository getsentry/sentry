from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidParams
from sentry.sentry_metrics.querying.api import (
    InvalidMetricsQueryError,
    MetricsQueryExecutionError,
    run_metrics_query,
)
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
from sentry.snuba.metrics.utils import DerivedMetricException, DerivedMetricParseException
from sentry.snuba.sessions_v2 import InvalidField
from sentry.utils.cursors import Cursor, CursorResult
from sentry.utils.dates import parse_stats_period


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


@region_silo_endpoint
class OrganizationMetricsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    """Get the metadata of all the stored metrics including metric name, available operations and metric unit"""

    def get(self, request: Request, organization) -> Response:
        projects = self.get_projects(request, organization)

        metrics = get_metrics_meta(projects, use_case_id=get_use_case_id(request))

        return Response(metrics, status=200)


@region_silo_endpoint
class OrganizationMetricDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    """Get metric name, available operations, metric unit and available tags"""

    def get(self, request: Request, organization, metric_name) -> Response:
        projects = self.get_projects(request, organization)
        try:
            metric = get_single_metric_info(
                projects,
                metric_name,
                use_case_id=get_use_case_id(request),
            )
        except InvalidParams as e:
            raise ResourceDoesNotExist(e)
        except (InvalidField, DerivedMetricParseException) as exc:
            raise ParseError(detail=str(exc))

        return Response(metric, status=200)


@region_silo_endpoint
class OrganizationMetricsTagsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    """Get list of tag names for this project

    If the ``metric`` query param is provided, only tags for a certain metric
    are provided.

    If the ``metric`` query param is provided more than once, the *intersection*
    of available tags is used.
    """

    def get(self, request: Request, organization) -> Response:
        metric_names = request.GET.getlist("metric") or []
        projects = self.get_projects(request, organization)

        try:
            tags = get_all_tags(
                projects,
                metric_names,
                use_case_id=get_use_case_id(request),
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
        metric_names = request.GET.getlist("metric") or None
        projects = self.get_projects(request, organization)

        try:
            tag_values = get_tag_values(
                projects,
                tag_name,
                metric_names,
                use_case_id=get_use_case_id(request),
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

    """Get the time series data for one or more metrics.

    The data can be filtered and grouped by tags.
    Based on `OrganizationSessionsEndpoint`.
    """

    default_per_page = 50

    def _new_get(self, request: Request, organization) -> Response:
        # We first parse the interval and date, since this is dependent on the query params.
        interval = parse_stats_period(request.GET.get("interval", "1h"))
        interval = int(3600 if interval is None else interval.total_seconds())
        start, end = get_date_range_from_params(request.GET)

        try:
            # We then run the query and inject directly the field, query and groupBy, since they will be parsed
            # internally.
            results = run_metrics_query(
                fields=request.GET.getlist("field", []),
                query=request.GET.get("query"),
                group_bys=request.GET.getlist("groupBy"),
                interval=interval,
                start=start,
                end=end,
                organization=organization,
                projects=self.get_projects(request, organization),
                environments=self.get_environments(request, organization),
                # TODO: move referrers into a centralized place.
                referrer="metrics.data.api",
            )
        except InvalidMetricsQueryError as e:
            return Response(status=400, data={"detail": str(e)})
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
