from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.models import AuditLogEntryEvent, Project, ProjectStatus
from sentry.tasks.deletion import delete_project


def clean_newline_inputs(value):
    result = []
    for v in value.split('\n'):
        v = v.lower().strip()
        if v:
            result.append(v)
    return result


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ('name', 'slug')


class ProjectDetailsEndpoint(ProjectEndpoint):
    doc_section = DocSection.PROJECTS

    def get(self, request, project):
        """
        Retrieve a project

        Return details on an individual project.

            {method} {path}

        """
        data = serialize(project, request.user)
        data['options'] = {
            'sentry:origins': '\n'.join(project.get_option('sentry:origins', '*') or []),
            'sentry:resolve_age': int(project.get_option('sentry:resolve_age', 0)),
            'sentry:scrub_data': bool(project.get_option('sentry:scrub_data', True)),
            'sentry:sensitive_fields': project.get_option('sentry:sensitive_fields', []),
        }
        data['team'] = serialize(project.team, request.user)
        data['organization'] = serialize(project.organization, request.user)

        return Response(data)

    @sudo_required
    def put(self, request, project):
        """
        Update a project

        Update various attributes and configurable settings for the given project.

            {method} {path}
            {{
              "name": "My Project Name",
              "options": {{
                "sentry:origins": "*"
              }}
            }}

        """
        serializer = ProjectSerializer(project, data=request.DATA, partial=True)

        if serializer.is_valid():
            project = serializer.save()

            options = request.DATA.get('options', {})
            if 'sentry:origins' in options:
                project.update_option(
                    'sentry:origins',
                    clean_newline_inputs(options['sentry:origins'])
                )
            if 'sentry:resolve_age' in options:
                project.update_option('sentry:resolve_age', int(options['sentry:resolve_age']))
            if 'sentry:scrub_data' in options:
                project.update_option('sentry:scrub_data', bool(options['sentry:scrub_data']))
            if 'sentry:sensitive_fields' in options:
                project.update_option(
                    'sentry:sensitive_fields',
                    [s.strip().lower() for s in options['sentry:sensitive_fields']]
                )

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=project.id,
                event=AuditLogEntryEvent.PROJECT_EDIT,
                data=project.get_audit_log_data(),
            )

            data = serialize(project, request.user)
            data['options'] = {
                'sentry:origins': '\n'.join(project.get_option('sentry:origins', '*') or []),
                'sentry:resolve_age': int(project.get_option('sentry:resolve_age', 0)),
            }
            return Response(data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @sudo_required
    def delete(self, request, project):
        """
        Delete a project

        Schedules a project for deletion.

            {method} {path}

        **Note:** Deletion happens asynchronously and therefor is not immediate.
        However once deletion has begun the state of a project changes and will
        be hidden from most public views.
        """
        if project.is_internal_project():
            return Response('{"error": "Cannot remove projects internally used by Sentry."}',
                            status=status.HTTP_403_FORBIDDEN)

        updated = Project.objects.filter(
            id=project.id,
            status=ProjectStatus.VISIBLE,
        ).update(status=ProjectStatus.PENDING_DELETION)
        if updated:
            delete_project.delay(object_id=project.id)

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=project.id,
                event=AuditLogEntryEvent.PROJECT_REMOVE,
                data=project.get_audit_log_data(),
            )

        return Response(status=204)
