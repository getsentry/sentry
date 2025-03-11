from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.models.project import Project

ValidationError = serializers.ValidationError


@extend_schema_field(field=OpenApiTypes.STR)
class ProjectField(serializers.Field):
    def __init__(self, scope="project:write", id_allowed=False, **kwags):
        self.scope = scope
        self.id_allowed = id_allowed
        super().__init__(**kwags)

    def to_representation(self, value):
        return value

    def to_internal_value(self, data):
        try:
            if self.id_allowed:
                project = Project.objects.get(
                    organization=self.context["organization"], slug__id_or_slug=data
                )
            else:
                project = Project.objects.get(organization=self.context["organization"], slug=data)
        except Project.DoesNotExist:
            raise ValidationError("Invalid project")
        if not self.context["access"].has_project_scope(project, self.scope):
            raise ValidationError("Insufficient access to project")
        return project
