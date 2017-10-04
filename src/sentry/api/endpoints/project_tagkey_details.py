from __future__ import absolute_import

from rest_framework.response import Response

from sentry import tagstore
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import AuditLogEntryEvent


class ProjectTagKeyDetailsEndpoint(ProjectEndpoint):
    def get(self, request, project, key):
        lookup_key = tagstore.prefix_reserved_key(key)

        try:
            tagkey = tagstore.get_tag_key(project.id, lookup_key)
        except tagstore.TagKeyNotFound:
            raise ResourceDoesNotExist

        return Response(serialize(tagkey, request.user))

    def delete(self, request, project, key):
        """
        Remove all occurrences of the given tag key.

            {method} {path}

        """
        lookup_key = tagstore.prefix_reserved_key(key)

        try:
            updated, tagkey = tagstore.delete_tag_key(project.id, lookup_key)
        except tagstore.TagKeyNotFound:
            raise ResourceDoesNotExist

        if updated:
            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=tagkey.id,
                event=AuditLogEntryEvent.TAGKEY_REMOVE,
                data=tagkey.get_audit_log_data(),
            )

        return Response(status=204)
