from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.models.projecttemplate import ProjectTemplate


@region_silo_endpoint
class OrganizationProjectTemplatesIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List your Project Templates
        ``````````````````
        Return a list of project templates available to the authenticated
        session in a region.

        :auth: required
        """
        queryset = ProjectTemplate.objects.filter(organization=organization)

        # TODO - Use self.paginate() to handle pagination
        # TODO - Create a serializer for the ProjectTemplate model
        # TODO - Create a serializer for the ProjectTemplateOption model

        return Response(
            {
                "id": project_template.id,
                "name": project_template.name,
                "organization": project_template.organization.slug,
            }
            for project_template in queryset
        )

        # return self.paginate(
        #     request=request,
        #     queryset=queryset,
        #     order_by="name",
        #     on_results=lambda x: serialize(x, request.user),
        # )
