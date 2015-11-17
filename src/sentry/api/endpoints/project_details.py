from __future__ import absolute_import

import logging

from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.models import (
    AuditLogEntryEvent, Group, GroupStatus, Project, ProjectStatus
)
from sentry.plugins import plugins
from sentry.tasks.deletion import delete_project
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('GetProject')
def get_project_scenario(runner):
    runner.request(
        method='GET',
        path='/projects/%s/%s/' % (
            runner.org.slug, runner.default_project.slug)
    )


@scenario('DeleteProject')
def delete_project_scenario(runner):
    with runner.isolated_project('Plain Proxy') as project:
        runner.request(
            method='DELETE',
            path='/projects/%s/%s/' % (
                runner.org.slug, project.slug)
        )


@scenario('UpdateProject')
def update_project_scenario(runner):
    with runner.isolated_project('Plain Proxy') as project:
        runner.request(
            method='PUT',
            path='/projects/%s/%s/' % (
                runner.org.slug, project.slug),
            data={
                'name': 'Plane Proxy',
                'slug': 'plane-proxy',
                'options': {
                    'sentry:origins': 'http://example.com\nhttp://example.invalid',
                }
            }
        )


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

    def _get_unresolved_count(self, project):
        queryset = Group.objects.filter(
            status=GroupStatus.UNRESOLVED,
            project=project,
        )

        resolve_age = project.get_option('sentry:resolve_age', None)
        if resolve_age:
            queryset = queryset.filter(
                last_seen__gte=timezone.now() - timedelta(hours=int(resolve_age)),
            )

        return queryset.count()

    @attach_scenarios([get_project_scenario])
    def get(self, request, project):
        """
        Retrieve a Project
        ``````````````````

        Return details on an individual project.

        :pparam string organization_slug: the slug of the organization the
                                          project belongs to.
        :pparam string project_slug: the slug of the project to delete.
        :auth: required
        """
        active_plugins = [
            {
                'name': plugin.get_title(),
                'id': plugin.slug,
            }
            for plugin in plugins.configurable_for_project(project, version=None)
            if plugin.is_enabled(project)
            and plugin.has_project_conf()
        ]

        data = serialize(project, request.user)
        data['options'] = {
            'sentry:origins': '\n'.join(project.get_option('sentry:origins', ['*']) or []),
            'sentry:resolve_age': int(project.get_option('sentry:resolve_age', 0)),
            'sentry:scrub_data': bool(project.get_option('sentry:scrub_data', True)),
            'sentry:sensitive_fields': project.get_option('sentry:sensitive_fields', []),
        }
        data['activePlugins'] = active_plugins
        data['team'] = serialize(project.team, request.user)
        data['organization'] = serialize(project.organization, request.user)

        include = set(filter(bool, request.GET.get('include', '').split(',')))
        if 'stats' in include:
            data['stats'] = {
                'unresolved': self._get_unresolved_count(project),
            }

        return Response(data)

    @attach_scenarios([update_project_scenario])
    @sudo_required
    def put(self, request, project):
        """
        Update a Project
        ````````````````

        Update various attributes and configurable settings for the given
        project.  Only supplied values are updated.

        :pparam string organization_slug: the slug of the organization the
                                          project belongs to.
        :pparam string project_slug: the slug of the project to delete.
        :param string name: the new name for the project.
        :param string slug: the new slug for the project.
        :param object options: optional options to override in the
                               project settings.
        :auth: required
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

    @attach_scenarios([delete_project_scenario])
    @sudo_required
    def delete(self, request, project):
        """
        Delete a Project
        ````````````````

        Schedules a project for deletion.

        Deletion happens asynchronously and therefor is not immediate.
        However once deletion has begun the state of a project changes and
        will be hidden from most public views.

        :pparam string organization_slug: the slug of the organization the
                                          project belongs to.
        :pparam string project_slug: the slug of the project to delete.
        :auth: required
        """
        if project.is_internal_project():
            return Response('{"error": "Cannot remove projects internally used by Sentry."}',
                            status=status.HTTP_403_FORBIDDEN)

        logging.getLogger('sentry.deletions').info(
            'Project %s/%s (id=%s) removal requested by user (id=%s)',
            project.organization.slug, project.slug, project.id, request.user.id)

        updated = Project.objects.filter(
            id=project.id,
            status=ProjectStatus.VISIBLE,
        ).update(status=ProjectStatus.PENDING_DELETION)
        if updated:
            delete_project.delay(object_id=project.id, countdown=3600)

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=project.id,
                event=AuditLogEntryEvent.PROJECT_REMOVE,
                data=project.get_audit_log_data(),
            )

        return Response(status=204)
