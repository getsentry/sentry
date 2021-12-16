from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Organization
from sentry.snuba.metrics import (
    InvalidField,
    InvalidParams,
    MockDataSource,
    QueryDefinition,
    SnubaDataSource,
)


def get_datasource(request):
    if request.GET.get("datasource") == "snuba":
        return SnubaDataSource()

    return MockDataSource()


class OrganizationMetricsEndpoint(OrganizationEndpoint):
    """Get metric name, available operations and the metric unit"""

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:metrics", organization, actor=request.user):
            return Response(status=404)

        projects = self.get_projects(request, organization)
        metrics = get_datasource(request).get_metrics(projects)
        return Response(metrics, status=200)


class OrganizationMetricDetailsEndpoint(OrganizationEndpoint):
    """Get metric name, available operations, metric unit and available tags"""

    def get(self, request: Request, organization: Organization, metric_name: str) -> Response:
        if not features.has("organizations:metrics", organization, actor=request.user):
            return Response(status=404)

        projects = self.get_projects(request, organization)
        try:
            metric = get_datasource(request).get_single_metric(projects, metric_name)
        except InvalidParams:
            raise ResourceDoesNotExist(detail=f"metric '{metric_name}'")

        return Response(metric, status=200)


class OrganizationMetricsTagsEndpoint(OrganizationEndpoint):
    """Get list of tag names for this project

    If the ``metric`` query param is provided, only tags for a certain metric
    are provided.

    If the ``metric`` query param is provided more than once, the *intersection*
    of available tags is used.

    """

    def get(self, request: Request, organization: Organization) -> Response:

        if not features.has("organizations:metrics", organization, actor=request.user):
            return Response(status=404)

        metric_names = request.GET.getlist("metric") or None

        projects = self.get_projects(request, organization)
        try:
            tags = get_datasource(request).get_tags(projects, metric_names)
        except InvalidParams as exc:
            raise (ParseError(detail=str(exc)))

        return Response(tags, status=200)


class OrganizationMetricsTagDetailsEndpoint(OrganizationEndpoint):
    """Get all existing tag values for a metric"""

    def get(self, request: Request, organization: Organization, tag_name: str) -> Response:

        if not features.has("organizations:metrics", organization, actor=request.user):
            return Response(status=404)

        metric_names = request.GET.getlist("metric") or None

        projects = self.get_projects(request, organization)
        try:
            tag_values = get_datasource(request).get_tag_values(projects, tag_name, metric_names)
        except InvalidParams as exc:
            msg = str(exc)
            # TODO: Use separate error type once we have real data
            if "Unknown tag" in msg:
                raise ResourceDoesNotExist(f"tag '{tag_name}'")
            else:
                raise ParseError(msg)

        return Response(tag_values, status=200)


class OrganizationMetricsDataEndpoint(OrganizationEndpoint):
    """Get the time series data for one or more metrics.

    The data can be filtered and grouped by tags.
    Based on `OrganizationSessionsEndpoint`.
    """

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:metrics", organization, actor=request.user):
            return Response(status=404)

        projects = self.get_projects(request, organization)
        try:
            query = QueryDefinition(request.GET)
            data = get_datasource(request).get_series(projects, query)
        except (InvalidField, InvalidParams) as exc:
            raise (ParseError(detail=str(exc)))

        return Response(data, status=200)
