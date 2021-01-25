from rest_framework.response import Response

from sentry import tagstore
from sentry.api.base import EnvironmentMixin
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.constants import PROTECTED_TAG_KEYS
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
        if key in PROTECTED_TAG_KEYS:
            return Response(status=403)

        lookup_key = tagstore.prefix_reserved_key(key)

        try:
            from sentry import eventstream

            eventstream_state = eventstream.start_delete_tag(project.id, key)

            deleted = self.get_tag_keys_for_deletion(project.id, lookup_key)

            # NOTE: By sending the `end_delete_tag` message here we are making
            # the assumption that the `delete_tag_key` does its work
            # synchronously. As of this writing the Snuba `delete_tag_key` method
            # is a no-op and this message itself is what causes the deletion to
            # be done downstream.
            eventstream.end_delete_tag(eventstream_state)
        except tagstore.TagKeyNotFound:
            raise ResourceDoesNotExist

        for tagkey in deleted:
            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=getattr(tagkey, "id", None),
                event=AuditLogEntryEvent.TAGKEY_REMOVE,
                data=tagkey.get_audit_log_data(),
            )

        return Response(status=204)

    def get_tag_keys_for_deletion(self, project_id, key):
        try:
            return [tagstore.get_tag_key(project_id=project_id, key=key, environment_id=None)]
        except tagstore.TagKeyNotFound:
            return []
