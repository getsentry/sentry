from django.shortcuts import get_object_or_404
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.endpoints.project_templates_index import (
    PROJECT_TEMPLATE_FEATURE_FLAG,
    ensure_rollout_enabled,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project_template import (
    ProjectTemplateAttributes,
    ProjectTemplateSerializer,
)
from sentry.models.organization import Organization
from sentry.models.projecttemplate import ProjectTemplate


@region_silo_endpoint
class OrganizationProjectTemplateDetailEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ALERTS_NOTIFICATIONS

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationPermission,)

    @ensure_rollout_enabled(PROJECT_TEMPLATE_FEATURE_FLAG)
    def get(self, request: Request, organization: Organization, template_id: str) -> Response:
        """
        Retrieve a project template by its ID.

        Return details on an individual project template.
        """
        project_template = get_object_or_404(
            ProjectTemplate, id=template_id, organization=organization
        )

        return Response(
            serialize(
                project_template,
                request.user,
                ProjectTemplateSerializer(expand=[ProjectTemplateAttributes.OPTIONS]),
            )
        )

    @ensure_rollout_enabled(PROJECT_TEMPLATE_FEATURE_FLAG)
    def delete(self, request: Request, organization: Organization, template_id: str) -> Response:
        """
        Delete a project template by its ID.
        """
        project_template = get_object_or_404(
            ProjectTemplate, id=template_id, organization=organization
        )

        project_template.delete()

        # think about how to handle there being no remaining templates for an org?
        return Response(status=204)
