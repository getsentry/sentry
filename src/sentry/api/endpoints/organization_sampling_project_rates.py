from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint, OrganizationPermission
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project

OPTION_KEY = "sentry:target_sample_rate"


@region_silo_endpoint
class OrganizationSamplingProjectRatesEndpoint(OrganizationEndpoint):
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }

    permission_classes = (OrganizationPermission,)

    def get(self, request: Request, organization) -> Response:
        # TODO: Implement pagination
        projects = organization.projects
        options = ProjectOption.objects.get_value_bulk(projects, OPTION_KEY)
        result = {str(project.id): value for project, value in options.items()}
        return Response({"projects": result})

    def put(self, request: Request, organization) -> Response:
        options = request.data.get("projects")

        # TODO: Validate payload against schema
        if not isinstance(options, dict):
            raise ValueError("projects must be a dictionary")
        for sample_rate in options.values():
            if not isinstance(sample_rate, (int, float)) or sample_rate < 0 or sample_rate > 1:
                raise ValueError("all sample_rates must be a number between 0 and 1")

        projects = Project.objects.get_many_from_cache(list(options.keys()))

        for project in projects:
            project.set_option(OPTION_KEY, options[str(project.id)])

        return Response(status=204)
