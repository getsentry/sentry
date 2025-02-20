from __future__ import annotations

from rest_framework import serializers

from sentry.api.fields.sentry_slug import SentrySerializerSlugField
from sentry.models.project import PROJECT_SLUG_MAX_LENGTH, Project
from sentry.projects.services.project import RpcProject


class ProjectUpdateArgsSerializer(serializers.Serializer):
    name = serializers.CharField(
        help_text="The name for the project",
        max_length=200,
        required=False,
    )
    slug = SentrySerializerSlugField(
        help_text="Uniquely identifies a project and is used for the interface.",
        max_length=PROJECT_SLUG_MAX_LENGTH,
        required=False,
    )
    platform = serializers.CharField(
        help_text="The platform for the project",
        required=False,
        allow_null=True,
        allow_blank=True,
    )
    external_id = serializers.CharField(
        help_text="The external ID for the project",
        required=False,
        allow_null=True,
        allow_blank=True,
    )


def serialize_project(project: Project) -> RpcProject:
    return RpcProject(
        id=project.id,
        slug=project.slug or "",
        name=project.name,
        organization_id=project.organization_id,
        status=project.status,
        platform=project.platform,
        external_id=project.external_id,
    )
