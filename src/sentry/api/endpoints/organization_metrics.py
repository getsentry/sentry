from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import InvalidParams
from sentry.sentry_metrics.configuration import UseCaseKey
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


def get_use_case_id(use_case: str) -> UseCaseKey:
    """
    Get use_case from str and validate it against UseCaseKey enum type
    if use_case parameter has wrong value just raise an ParseError.
    """
    try:
        if use_case == "releaseHealth":
            use_case = "release-health"

        return UseCaseKey(use_case)
    except ValueError:
        raise ParseError(
            detail=f"Invalid useCase parameter. Please use one of: {', '.join(use_case.value for use_case in UseCaseKey)}"
        )


@region_silo_endpoint
class OrganizationMetricsEndpoint(OrganizationEndpoint):
    """Get metric name, available operations and the metric unit"""

    def get(self, request: Request, organization) -> Response:
        if not features.has("organizations:metrics", organization, actor=request.user):
            return Response(status=404)

        projects = self.get_projects(request, organization)
        metrics = get_metrics(
            projects, use_case_id=get_use_case_id(request.GET.get("useCase", "release-health"))
        )
        # TODO: replace this with a serializer so that if the structure of MetricMeta changes the response of this
        # endpoint does not
        for metric in metrics:
            del metric["metric_id"]
            del metric["mri_string"]
        return Response(metrics, status=200)


@region_silo_endpoint
class OrganizationMetricDetailsEndpoint(OrganizationEndpoint):
    """Get metric name, available operations, metric unit and available tags"""

    def get(self, request: Request, organization, metric_name) -> Response:
        if not features.has("organizations:metrics", organization, actor=request.user):
            return Response(status=404)

        projects = self.get_projects(request, organization)
        try:
            metric = get_single_metric_info(
                projects,
                metric_name,
                use_case_id=get_use_case_id(request.GET.get("useCase", "release-health")),
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

        if not features.has("organizations:metrics", organization, actor=request.user):
            return Response(status=404)

        metric_names = request.GET.getlist("metric") or None
        projects = self.get_projects(request, organization)
        try:
            tags = get_tags(
                projects,
                metric_names,
                use_case_id=get_use_case_id(request.GET.get("useCase", "release-health")),
            )
        except (InvalidParams, DerivedMetricParseException) as exc:
            raise (ParseError(detail=str(exc)))

        return Response(tags, status=200)


@region_silo_endpoint
class OrganizationMetricsTagDetailsEndpoint(OrganizationEndpoint):
    """Get all existing tag values for a metric"""

    def get(self, request: Request, organization, tag_name) -> Response:

        if not features.has("organizations:metrics", organization, actor=request.user):
            return Response(status=404)

        metric_names = request.GET.getlist("metric") or None

        projects = self.get_projects(request, organization)
        try:
            tag_values = get_tag_values(
                projects,
                tag_name,
                metric_names,
                use_case_id=get_use_case_id(request.GET.get("useCase", "release-health")),
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
        if not (
            features.has("organizations:metrics", organization, actor=request.user)
            or features.has("organizations:dashboards-releases", organization, actor=request.user)
        ):
            return Response(status=404)

        projects = self.get_projects(request, organization)

        def data_fn(offset: int, limit: int):
            try:
                query = QueryDefinition(
                    projects, request.GET, paginator_kwargs={"limit": limit, "offset": offset}
                )
                data = get_series(
                    projects,
                    query.to_metrics_query(),
                    use_case_id=get_use_case_id(request.GET.get("useCase", "release-health")),
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
