from collections.abc import Collection

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.api.helpers.projects import ProjectIdOrSlugField
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

        If id_allowed is true, the field accepts a project ID or slug. Otherwise, it accepts slugs only.
        """
        self.scope = scope
        self.id_allowed = id_allowed
        super().__init__(**kwags)

    def to_representation(self, value):
        return value

    def to_internal_value(self, data: object) -> Project:
        try:
            if self.id_allowed:
                project_id_or_slug = ProjectIdOrSlugField().to_internal_value(data)
                project = Project.objects.get(
                    organization=self.context["organization"], slug__id_or_slug=project_id_or_slug
                )
            else:
                project_slug = self._validate_slug(data)
                project = Project.objects.get(
                    organization=self.context["organization"], slug=project_slug
                )
        except Project.DoesNotExist:
            raise ValidationError("Invalid project")

        scopes = (self.scope,) if isinstance(self.scope, str) else self.scope
        if not self.context["access"].has_any_project_scope(project, scopes):
            raise ValidationError("Insufficient access to project")
        return project

    def _validate_slug(self, data: object) -> str:
        if not isinstance(data, str):
            raise ValidationError("Invalid project")
        project_id_or_slug = ProjectIdOrSlugField().to_internal_value(data)
        if not isinstance(project_id_or_slug, str):
            raise ValidationError("Invalid project")
        return project_id_or_slug
