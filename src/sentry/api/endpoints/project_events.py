from functools import partial

from rest_framework.response import Response

from sentry import eventstore
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import EventSerializer, SimpleEventSerializer, serialize
from sentry.utils.cursors import Cursor


class ProjectEventsEndpoint(ProjectEndpoint):
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
            conditions.append([["positionCaseInsensitive", ["message", f"'{query}'"]], "!=", 0])

        full = request.GET.get("full", False)

        # XXX: Temporary hack to limit on offset
        cursor_string = request.GET.get("cursor")
        if cursor_string:
            try:
                cursor = Cursor.from_string(cursor_string)
            except ValueError:
                pass
            else:
                if cursor.offset > 10000:
                    return Response(
                        {
                            "detail": "Fetching large offsets is temporarily disabled for performance reasons"
                        },
                        status=400,
                    )

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
