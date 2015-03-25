from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, TagKey, TagKeyStatus
)
from sentry.tasks.deletion import delete_tag_key


class ProjectTagKeyDetailsEndpoint(ProjectEndpoint):
    def delete(self, request, project, key):
        """
        Remove all occurances of the given tag key.

            {method} {path}

        """
        try:
            tagkey = TagKey.objects.get(
                project=project,
                key=key,
            )
        except TagKey.DoesNotExist:
            raise ResourceDoesNotExist

        updated = TagKey.objects.filter(
            id=tagkey.id,
            status=TagKeyStatus.VISIBLE,
        ).update(status=TagKeyStatus.PENDING_DELETION)
        if updated:
            delete_tag_key.delay(object_id=tagkey.id)

            AuditLogEntry.objects.create(
                organization=project.organization,
                actor=request.user,
                ip_address=request.META['REMOTE_ADDR'],
                target_object=tagkey.id,
                event=AuditLogEntryEvent.TAGKEY_REMOVE,
                data=tagkey.get_audit_log_data(),
            )

        return Response(status=204)
