from __future__ import absolute_import

from rest_framework import serializers

from sentry.models import Project

ValidationError = serializers.ValidationError


class ProjectField(serializers.WritableField):
    def to_native(self, obj):
        return obj

    def from_native(self, data):
        try:
            project = Project.objects.get(
                organization=self.context['organization'],
                slug=data,
            )
        except Project.DoesNotExist:
            raise ValidationError(
                'Invalid project'
            )
        if not self.context['access'].has_project_scope(project, 'project:write'):
            raise ValidationError(
                'Insufficient access to project'
            )
        return project
