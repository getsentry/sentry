from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import AuditLogEntryEvent, ProjectKey, ProjectKeyStatus


class KeySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False)


class ProjectKeyDetailsEndpoint(ProjectEndpoint):
    doc_section = DocSection.PROJECTS

    def put(self, request, project, key_id):
        """
        Update a client key

        Update a client key.

            {method} {path}
            {{
                "name": "My key label"
            }}

        """
        try:
            key = ProjectKey.objects.get(
                project=project,
                public_key=key_id,
                status=ProjectKeyStatus.ACTIVE,
                roles=ProjectKey.roles.store,
            )
        except ProjectKey.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = KeySerializer(data=request.DATA, partial=True)

        if serializer.is_valid():
            result = serializer.object

            if result.get('name'):
                key.label = result['name']

            key.save()

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=key.id,
                event=AuditLogEntryEvent.PROJECTKEY_EDIT,
                data=key.get_audit_log_data(),
            )

            return Response(serialize(key, request.user), status=200)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, project, key_id):
        """
        Delete a client key

        Delete a client key.

            {method} {path}

        """
        try:
            key = ProjectKey.objects.get(
                project=project,
                public_key=key_id,
                status=ProjectKeyStatus.ACTIVE,
                roles=ProjectKey.roles.store,
            )
        except ProjectKey.DoesNotExist:
            raise ResourceDoesNotExist

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=key.id,
            event=AuditLogEntryEvent.PROJECTKEY_REMOVE,
            data=key.get_audit_log_data(),
        )

        key.delete()

        return Response(status=204)
