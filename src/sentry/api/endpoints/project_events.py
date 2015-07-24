from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.paginator import DateTimePaginator
from sentry.models import Event


class ProjectEventsEndpoint(ProjectEndpoint):
    doc_section = DocSection.EVENTS

    def get(self, request, project):
        """
        List a project's available samples

        Return a list of sampled events bound to a project.

            {method} {path}

        """

        events = Event.objects.filter(
            project=project,
        )

        return self.paginate(
            request=request,
            queryset=events,
            order_by='-datetime',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=DateTimePaginator,
        )
