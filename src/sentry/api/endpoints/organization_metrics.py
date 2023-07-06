from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import InvalidParams
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import string_to_use_case_id
from sentry.snuba.metrics import (
    QueryDefinition,
    get_metrics,
    get_series,
    get_single_metric_info,
    get_tag_values,
    get_tags,
)
from sentry.snuba.metrics.utils import DerivedMetricException, DerivedMetricParseException
from sentry.snuba.sessions_v2 import InvalidField
from sentry.utils.cursors import Cursor, CursorResult


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
    """Get metric name, available operations and the metric unit"""

    def get(self, request: Request, organization) -> Response:
        projects = self.get_projects(request, organization)

        metrics = get_metrics(projects, use_case_id=get_use_case_id(request))

        return Response(metrics, status=200)


@region_silo_endpoint
class OrganizationMetricDetailsEndpoint(OrganizationEndpoint):
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
    """Get list of tag names for this project

    If the ``metric`` query param is provided, only tags for a certain metric
    are provided.

    If the ``metric`` query param is provided more than once, the *intersection*
    of available tags is used.

    """

    def get(self, request: Request, organization) -> Response:

        metrics = request.GET.getlist("metric") or []
        projects = self.get_projects(request, organization)
        try:
            tags = get_tags(
                projects,
                metrics,
                use_case_id=get_use_case_id(request),
            )
        except (InvalidParams, DerivedMetricParseException) as exc:
            raise (ParseError(detail=str(exc)))

        return Response(tags, status=200)


@region_silo_endpoint
class OrganizationMetricsTagDetailsEndpoint(OrganizationEndpoint):
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
            msg = str(exc)
            # TODO: Use separate error type once we have real data
            if "Unknown tag" in msg:
                raise ResourceDoesNotExist(f"tag '{tag_name}'")
            else:
                raise ParseError(msg)

        return Response(tag_values, status=200)


@region_silo_endpoint
class OrganizationMetricsDataEndpoint(OrganizationEndpoint):
    """Get the time series data for one or more metrics.

    The data can be filtered and grouped by tags.
    Based on `OrganizationSessionsEndpoint`.
    """

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
