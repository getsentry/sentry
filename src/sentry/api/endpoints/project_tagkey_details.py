from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import AuditLogEntryEvent, TagKey, TagKeyStatus
from sentry.tasks.deletion import delete_tag_key


class ProjectTagKeyDetailsEndpoint(ProjectEndpoint):
    def get(self, request, project, key):
        if TagKey.is_reserved_key(key):
            lookup_key = 'sentry:{0}'.format(key)
        else:
            lookup_key = key

        try:
            tagkey = TagKey.objects.get(
                project=project,
                key=lookup_key,
                status=TagKeyStatus.VISIBLE,
            )
        except TagKey.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(tagkey, request.user))

    def delete(self, request, project, key):
        """
        Remove all occurrences of the given tag key.

            {method} {path}

        """
        if TagKey.is_reserved_key(key):
            lookup_key = 'sentry:{0}'.format(key)
        else:
            lookup_key = key

        try:
            tagkey = TagKey.objects.get(
                project=project,
                key=lookup_key,
            )
        except TagKey.DoesNotExist:
            raise ResourceDoesNotExist

        updated = TagKey.objects.filter(
            id=tagkey.id,
            status=TagKeyStatus.VISIBLE,
        ).update(status=TagKeyStatus.PENDING_DELETION)
        if updated:
            delete_tag_key.delay(object_id=tagkey.id)

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=tagkey.id,
                event=AuditLogEntryEvent.TAGKEY_REMOVE,
                data=tagkey.get_audit_log_data(),
            )

        return Response(status=204)
