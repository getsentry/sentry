from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, Project, TagKey, TagKeyStatus
)
from sentry.tasks.deletion import delete_tag_key


class ProjectTagKeyDetailsEndpoint(Endpoint):
    def delete(self, request, project_id, key):
        """
        Remove all occurances of the given tag key.

            {method} {path}

        """
        project = Project.objects.get(
            id=project_id,
        )

        tagkey = TagKey.objects.get(
            project=project,
            key=key,
        )

        assert_perm(tagkey, request.user, request.auth)

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
