from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.snuba.metrics import DATA_SOURCE, InvalidField, InvalidParams, QueryDefinition


class ProjectMetricsEndpoint(ProjectEndpoint):
    """ Get metric name, type, unit and tag names """

    def get(self, request, project):

        if not features.has("organizations:metrics", project.organization, actor=request.user):
            return Response(status=404)

        metrics = DATA_SOURCE.get_metrics(project)
        return Response(metrics, status=200)


class ProjectMetricsTagsEndpoint(ProjectEndpoint):
    """ Get all existing tag values for a metric """

    def get(self, request, project, metric_name, tag_name):

        if not features.has("organizations:metrics", project.organization, actor=request.user):
            return Response(status=404)

        try:
            tag_values = DATA_SOURCE.get_tag_values(project, metric_name, tag_name)
        except InvalidParams as exc:
            raise (ParseError(detail=str(exc)))

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
