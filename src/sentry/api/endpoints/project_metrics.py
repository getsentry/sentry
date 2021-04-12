from typing import Dict, List

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.models import Project


class MockDataSource:

    _tags = {
        "environment": [
            "production",
            "staging",
        ],
        "release": [  # High cardinality
            f"{major}.{minor}.{bugfix}"
            for major in range(3)
            for minor in range(13)
            for bugfix in range(4)
        ],
        "session.status": [
            "crashed",
            "errored",
            "healthy",
        ],
    }
    _tag_names = sorted(_tags.keys())

    def get_metrics(self, project: Project) -> List[dict]:

        return [
            {
                "name": "session",
                # "type": "counter",
                "operations": ["sum"],
                "tags": self._tag_names,
            },
            {
                "name": "user",
                # "type": "set",
                "operations": ["count_unique"],
                "tags": self._tag_names,
            },
            {
                "name": "session.duration",
                # "type": "distribution",
                "operations": ["avg", "p50", "p75", "p90", "p95", "p99", "max"],
                "tags": self._tag_names,
                "unit": "seconds",
            },
        ]

    def get_tag_values(self, project: Project, metric_name: str, tag_name: str) -> Dict[str, str]:
        # Return same tag names for every metric for now:
        return self._tags.get(tag_name, [])


DATA_SOURCE = MockDataSource()


class ProjectMetricsEndpoint(ProjectEndpoint):
    """ Get metric name, type, unit and tag names """

    def get(self, request, project):
        metrics = DATA_SOURCE.get_metrics(project)
        return Response(metrics, status=200)


class ProjectMetricsTagsEndpoint(ProjectEndpoint):
    """ Get all existing tag values for a metric """

    def get(self, request, project):

        try:
            metric_name = request.GET["metric"]
            tag_name = request.GET["tag"]
        except KeyError:
            return Response({"detail": "`metric` and `tag` are required parameters."}, status=400)

        tag_values = DATA_SOURCE.get_tag_values(project, metric_name, tag_name)

        return Response(tag_values, status=200)


class ProjectMetricsDataEndpoint(ProjectEndpoint):
    """Get the time series data for one or more metrics.

    The data can be filtered and grouped by tags.
    Based on `OrganizationSessionsEndpoint`.
    """

    def get(self, request, project):
        return Response("Hello world", status=200)
