from __future__ import absolute_import

from functools import partial

from sentry import eventstore
from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import EventSerializer, serialize, SimpleEventSerializer
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario("ListProjectAvailableSamples")
def list_project_available_samples_scenario(runner):
    runner.request(
        method="GET",
        path="/projects/%s/%s/events/" % (runner.org.slug, runner.default_project.slug),
    )


class ProjectEventsEndpoint(ProjectEndpoint):
    doc_section = DocSection.EVENTS

    @attach_scenarios([list_project_available_samples_scenario])
    def get(self, request, project):
        """
        List a Project's Events
        ```````````````````````

        Return a list of events bound to a project.

        Note: This endpoint is experimental and may be removed without notice.

        :qparam bool full: if this is set to true then the event payload will
                           include the full event body, including the stacktrace.
                           Set to 1 to enable.

        :pparam string organization_slug: the slug of the organization the
                                          groups belong to.
        :pparam string project_slug: the slug of the project the groups
                                     belong to.
        """
        from sentry.api.paginator import GenericOffsetPaginator

        query = request.GET.get("query")
        conditions = []
        if query:
            conditions.append(
                [["positionCaseInsensitive", ["message", "'%s'" % (query,)]], "!=", 0]
            )

        full = request.GET.get("full", False)

        data_fn = partial(
            eventstore.get_events,
            filter=eventstore.Filter(conditions=conditions, project_ids=[project.id]),
            referrer="api.project-events",
        )

        serializer = EventSerializer() if full else SimpleEventSerializer()
        return self.paginate(
            request=request,
            on_results=lambda results: serialize(results, request.user, serializer),
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )
