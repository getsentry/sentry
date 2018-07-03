from __future__ import absolute_import

import six

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.models import Event, EventAttachment


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
        if not features.has('organizations:event-attachments', project.organization, actor=request.user):
            return self.respond(status=404)

        try:
            event = Event.objects.get(
                id=event_id,
                project_id=project.id,
            )
        except Event.DoesNotExist:
            return self.respond({'detail': 'Event not found'}, status=404)

        queryset = EventAttachment.objects.filter(
            project_id=project.id,
            event_id=event.event_id,
        ).select_related('file')

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='name',
            paginator_cls=OffsetPaginator,
            on_results=lambda attachments: [{
                'id': six.text_type(a.id),
                'name': a.name,
                'headers': a.file.headers,
                'size': a.file.size,
                'sha1': a.file.checksum,
                'dateCreated': a.file.timestamp,
            } for a in attachments],
        )
