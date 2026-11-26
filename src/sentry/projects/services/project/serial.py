from __future__ import annotations

from django.db.models import QuerySet
from rest_framework import serializers

from sentry.api.fields.sentry_slug import SentrySerializerSlugField
from sentry.constants import PROJECT_SLUG_MAX_LENGTH
from sentry.models.project import Project
from sentry.projects.services.project import RpcProject
from sentry.projects.services.project.model import ProjectUpdateArgs


class ProjectUpdateArgsSerializer(serializers.Serializer[ProjectUpdateArgs]):
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


def _normalize_project_slug(slug: str | None) -> str:
    return slug or ""


def serialize_project(project: Project) -> RpcProject:
    return RpcProject(
        id=project.id,
        slug=_normalize_project_slug(project.slug),
        name=project.name,
        organization_id=project.organization_id,
        status=project.status,
        first_event=project.first_event,
        platform=project.platform,
        external_id=project.external_id,
    )


def serialize_projects(projects: QuerySet[Project]) -> list[RpcProject]:
    rpc_projects = []
    for project in projects.values(*RpcProject.get_field_names()):
        project["slug"] = _normalize_project_slug(project["slug"])
        rpc_projects.append(RpcProject(**project))
    return rpc_projects
