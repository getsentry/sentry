from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.constants import ObjectStatus
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.project import Project


@cell_silo_endpoint
class OrganizationLegacyWebhooksEndpoint(OrganizationEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        project_options = ProjectOption.objects.filter(
            key="webhooks:enabled",
            project__organization=organization,
            project__status=ObjectStatus.ACTIVE,
        ).select_related("project")

        enabled_projects: dict[int, Project] = {}
        for option in project_options:
            if option.value:
                enabled_projects[option.project_id] = option.project

        if not enabled_projects:
            return Response({"projects": []})

        accessible_project_ids = {
            p.id
            for p in self.get_projects(
                request=request,
                organization=organization,
                include_all_accessible=True,
            )
            if p.id in enabled_projects
        }

        result = []
        for project_id, project in enabled_projects.items():
            if project_id not in accessible_project_ids:
                continue
            result.append(
                {
                    "projectId": project.id,
                    "projectSlug": project.slug,
                    "projectName": project.name,
                    "projectPlatform": project.platform,
                    "enabled": True,
                }
            )

        result.sort(key=lambda x: x["projectSlug"])
        return Response({"projects": result})
