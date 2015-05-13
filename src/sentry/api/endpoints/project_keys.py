from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import AuditLogEntryEvent, ProjectKey, ProjectKeyStatus


class KeySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False)


class ProjectKeysEndpoint(ProjectEndpoint):
    doc_section = DocSection.PROJECTS

    def get(self, request, project):
        """
        List a project's client keys

        Return a list of client keys bound to a project.

            {method} {path}

        """
        keys = list(ProjectKey.objects.filter(
            project=project,
            status=ProjectKeyStatus.ACTIVE,
            roles=ProjectKey.roles.store,
        ))
        return Response(serialize(keys, request.user))

    def post(self, request, project):
        """
        Create a new client key

        Create a new client key bound to a project.

            {method} {path}
            {{
                "name": "My key label"
            }}

        """
        serializer = KeySerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            key = ProjectKey.objects.create(
                project=project,
                label=result.get('name'),
            )

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=key.id,
                event=AuditLogEntryEvent.PROJECTKEY_ADD,
                data=key.get_audit_log_data(),
            )

            return Response(serialize(key, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
