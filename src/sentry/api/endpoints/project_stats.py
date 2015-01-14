from __future__ import absolute_import

from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.base import BaseStatsEndpoint, DocSection
from sentry.api.permissions import assert_perm
from sentry.models import Project


class ProjectStatsEndpoint(BaseStatsEndpoint):
    doc_section = DocSection.PROJECTS

    def get(self, request, project_id):
        """
        Retrieve event counts for a project

        **Draft:** This endpoint may change in the future without notice.

        Return a set of points representing a normalized timestamp and the
        number of events seen in the period.

            {method} {path}?since=1421092384.822244&until=1434052399.443363

        Query ranges are limited to Sentry's configured time-series resolutions.

        Parameters:

        - since: a timestamp to set the start of the query
        - until: a timestamp to set the end of the query
        - resolution: an explicit resolution to search for (i.e. 10s)

        **Note:** resolution should not be used unless you're familiar with Sentry
        internals as it's restricted to pre-defined values.
        """
        project = Project.objects.get_from_cache(
            id=project_id,
        )

        assert_perm(project, request.user, request.auth)

        data = tsdb.get_range(
            model=tsdb.models.project,
            keys=[project.id],
            **self._parse_args(request)
        )[project.id]

        return Response(data)
