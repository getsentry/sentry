from __future__ import absolute_import

import six

from sentry import eventstore, features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import EventAttachment
from sentry.search.utils import tokenize_query


class EventAttachmentsEndpoint(ProjectEndpoint):
    def get(self, request, project, event_id):
        """
        Retrieve attachments for an event
        `````````````````````````````````

        :pparam string organization_slug: the slug of the organization the
                                          issues belong to.
        :pparam string project_slug: the slug of the project the event
                                     belongs to.
        :pparam string event_id: the id of the event.
        :auth: required
        """
        if not features.has(
            "organizations:event-attachments", project.organization, actor=request.user
        ):
            return self.respond(status=404)

        event = eventstore.get_event_by_id(project.id, event_id)
        if event is None:
            return self.respond({"detail": "Event not found"}, status=404)

        queryset = EventAttachment.objects.filter(project_id=project.id, event_id=event.event_id)

        query = request.GET.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in six.iteritems(tokens):
                if key == "query":
                    value = " ".join(value)
                    queryset = queryset.filter(name__icontains=value)
                else:
                    queryset = queryset.none()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="name",
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
