from typing import int
from collections.abc import Collection

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.models.project import Project

ValidationError = serializers.ValidationError


@extend_schema_field(field=OpenApiTypes.STR)
class ProjectField(serializers.Field):
    def __init__(
        self, scope: str | Collection[str] = "project:write", id_allowed: bool = False, **kwags
    ):
        """
        The scope parameter specifies which permissions are required to access the project field.
        If multiple scopes are provided, the project can be accessed when the user is authenticated with
        any of the scopes.
        """
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

        scopes = (self.scope,) if isinstance(self.scope, str) else self.scope
        if not self.context["access"].has_any_project_scope(project, scopes):
            raise ValidationError("Insufficient access to project")
        return project
