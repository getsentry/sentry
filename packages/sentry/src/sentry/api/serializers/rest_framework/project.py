from rest_framework import serializers

from sentry.models import Project

ValidationError = serializers.ValidationError


class ProjectField(serializers.Field):
    def __init__(self, scope="project:write"):
        self.scope = scope
        super().__init__()

    def to_representation(self, value):
        return value

    def to_internal_value(self, data):
        try:
            project = Project.objects.get(organization=self.context["organization"], slug=data)
        except Project.DoesNotExist:
            raise ValidationError("Invalid project")
        if not self.context["access"].has_project_scope(project, self.scope):
            raise ValidationError("Insufficient access to project")
        return project
