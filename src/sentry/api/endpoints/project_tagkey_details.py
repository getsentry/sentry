from __future__ import absolute_import

from rest_framework.response import Response

from sentry import tagstore
from sentry.api.base import EnvironmentMixin
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import AuditLogEntryEvent, Environment


class ProjectTagKeyDetailsEndpoint(ProjectEndpoint, EnvironmentMixin):
    def get(self, request, project, key):
        lookup_key = tagstore.prefix_reserved_key(key)

        try:
            environment_id = self._get_environment_id_from_request(request, project.organization_id)
        except Environment.DoesNotExist:
            # if the environment doesn't exist then the tag can't possibly exist
            raise ResourceDoesNotExist

        try:
            tagkey = tagstore.get_tag_key(project.id, environment_id, lookup_key)
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
            deleted = tagstore.delete_tag_key(project.id, lookup_key)
        except tagstore.TagKeyNotFound:
            raise ResourceDoesNotExist

        for tagkey in deleted:
            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=tagkey.id,
                event=AuditLogEntryEvent.TAGKEY_REMOVE,
                data=tagkey.get_audit_log_data(),
            )

        return Response(status=204)
