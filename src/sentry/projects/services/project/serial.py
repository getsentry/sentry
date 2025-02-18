from __future__ import annotations

from sentry.models.project import Project
from sentry.projects.services.project import RpcProject


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
