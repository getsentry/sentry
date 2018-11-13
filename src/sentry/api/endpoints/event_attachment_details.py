from __future__ import absolute_import

import posixpath
import six

try:
    from django.http import (CompatibleStreamingHttpResponse as StreamingHttpResponse)
except ImportError:
    from django.http import StreamingHttpResponse

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.models import Event, EventAttachment


class EventAttachmentDetailsEndpoint(ProjectEndpoint):
    def download(self, attachment):
        file = attachment.file
        fp = file.getfile()
        response = StreamingHttpResponse(
            iter(lambda: fp.read(4096), b''),
            content_type=file.headers.get('content-type', 'application/octet-stream'),
        )
        response['Content-Length'] = file.size
        response['Content-Disposition'] = 'attachment; filename="%s"' % posixpath.basename(
            " ".join(attachment.name.split())
        )
        return response

    def get(self, request, project, event_id, attachment_id):
        """
        Retrieve an Attachment
        ``````````````````````

        :pparam string organization_slug: the slug of the organization the
                                          issues belong to.
        :pparam string project_slug: the slug of the project the event
                                     belongs to.
        :pparam string event_id: the id of the event.
        :pparam string attachment_id: the id of the attachment.
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

        try:
            attachment = EventAttachment.objects.filter(
                project_id=project.id,
                event_id=event.event_id,
                id=attachment_id,
            ).select_related('file').get()
        except EventAttachment.DoesNotExist:
            return self.respond({'detail': 'Attachment not found'}, status=404)

        if request.GET.get('download') is not None:
            return self.download(attachment)

        return self.respond({
            'id': six.text_type(attachment.id),
            'name': attachment.name,
            'headers': attachment.file.headers,
            'size': attachment.file.size,
            'sha1': attachment.file.checksum,
            'dateCreated': attachment.file.timestamp,
        })
