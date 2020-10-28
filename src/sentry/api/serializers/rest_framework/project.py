from __future__ import absolute_import

from rest_framework import serializers

from sentry.models import Project

ValidationError = serializers.ValidationError


class ProjectField(serializers.Field):
    def to_representation(self, value):
        return value

    def to_internal_value(self, data):
        try:
            project = Project.objects.get(organization=self.context["organization"], slug=data)
        except Project.DoesNotExist:
            raise ValidationError("Invalid project")
        if not self.context["access"].has_project_scope(project, "project:write"):
            raise ValidationError("Insufficient access to project")
        return project
