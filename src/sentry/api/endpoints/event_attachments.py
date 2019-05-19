from __future__ import absolute_import

import six

from sentry import features, options
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Event, SnubaEvent, EventAttachment, File


class EventAttachmentsEndpoint(ProjectEndpoint):

    def get_user_cls(self):
        use_snuba = options.get('snuba.events-queries.enabled')
        return SnubaEvent if use_snuba else Event

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
        if not features.has('organizations:event-attachments',
                            project.organization, actor=request.user):
            return self.respond(status=404)

        event_cls = self.get_user_cls()

        event = event_cls.objects.from_event_id(event_id, project.id)
        if event is None:
            return self.respond({'detail': 'Event not found'}, status=404)

        queryset = EventAttachment.objects.filter(
            project_id=project.id,
            event_id=event.event_id,
        ).select_related('file')

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='name',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request, project, event_id):
        """
        Event attachment
        ````````````````````

        Upload a file to be attached to event.

        Note: File upload must be submitted with DSN authentication (see auth documentation).

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :param string event_id: the event ID
        :auth: required
        """
        if hasattr(request.auth, 'project_id') and project.id != request.auth.project_id:
            return self.respond(status=400)

        if not features.has('organizations:event-attachments',
                            project.organization, actor=request.user):
            return self.respond(status=404)

        event_cls = self.get_user_cls()
        event = event_cls.objects.from_event_id(event_id, project.id)

        if event is None:
            return self.respond({'detail': 'Event not found'}, status=404)

        for name, file in six.iteritems(request.FILES):
            data = file.read(),
            EventAttachment.objects.create(
                project_id=project.id,
                group_id=event.group_id,
                event_id=event.event_id,
                name=file.name,
                file=File.objects.get_or_create(
                    name=file.name,
                    type=file.content_type,
                    # checksum='abcde' * 8,
                    size=len(data),
                )[0],
            )

        return self.respond(status=201)
