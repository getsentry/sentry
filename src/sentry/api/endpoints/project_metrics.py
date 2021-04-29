from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.snuba.metrics import DATA_SOURCE, InvalidField, InvalidParams, QueryDefinition


class ProjectMetricsEndpoint(ProjectEndpoint):
    """ Get metric name, available operations and the metric unit """

    def get(self, request, project):

        if not features.has("organizations:metrics", project.organization, actor=request.user):
            return Response(status=404)

        metrics = DATA_SOURCE.get_metrics(project)
        return Response(metrics, status=200)


class ProjectMetricDetailsEndpoint(ProjectEndpoint):
    """ Get metric name, available operations, metric unit and available tags """

    def get(self, request, project, metric_name):

        if not features.has("organizations:metrics", project.organization, actor=request.user):
            return Response(status=404)

        try:
            metric = DATA_SOURCE.get_single_metric(project, metric_name)
        except InvalidParams:
            raise ResourceDoesNotExist(detail=f"metric '{metric_name}'")

        return Response(metric, status=200)


class ProjectMetricsTagsEndpoint(ProjectEndpoint):
    """Get list of tag names for this project

    If the ``metric`` query param is provided, only tags for a certain metric
    are provided.

    If the ``metric`` query param is provided more than once, the *intersection*
    of available tags is used.

    """

    def get(self, request, project):

        if not features.has("organizations:metrics", project.organization, actor=request.user):
            return Response(status=404)

        metric_names = request.GET.getlist("metric") or None

        if not features.has("organizations:metrics", project.organization, actor=request.user):
            return Response(status=404)

        try:
            tag_names = DATA_SOURCE.get_tag_names(project, metric_names)
        except InvalidParams as exc:
            raise (ParseError(detail=str(exc)))

        return Response(tag_names, status=200)


class ProjectMetricsTagDetailsEndpoint(ProjectEndpoint):
    """ Get all existing tag values for a metric """

    def get(self, request, project, tag_name):

        if not features.has("organizations:metrics", project.organization, actor=request.user):
            return Response(status=404)

        metric_names = request.GET.getlist("metric") or None

        try:
            tag_values = DATA_SOURCE.get_tag_values(project, tag_name, metric_names)
        except InvalidParams as exc:
            msg = str(exc)
            # TODO: Use separate error type once we have real data
            if "Unknown tag" in msg:
                raise ResourceDoesNotExist(f"tag '{tag_name}'")
            else:
                raise ParseError(msg)

        return Response(tag_values, status=200)


class ProjectMetricsDataEndpoint(ProjectEndpoint):
    """Get the time series data for one or more metrics.

    The data can be filtered and grouped by tags.
    Based on `OrganizationSessionsEndpoint`.
    """

    def get(self, request, project):

        if not features.has("organizations:metrics", project.organization, actor=request.user):
            return Response(status=404)

        try:
            query = QueryDefinition(request.GET, allow_minute_resolution=False)
            data = DATA_SOURCE.get_series(query)
        except (InvalidField, InvalidParams) as exc:
            raise (ParseError(detail=str(exc)))

        return Response(data, status=200)
