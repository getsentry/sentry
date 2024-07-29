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
    ProjectTemplateWriteSerializer,
)
from sentry.models.organization import Organization
from sentry.models.projecttemplate import ProjectTemplate


@region_silo_endpoint
class OrganizationProjectTemplateDetailEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ALERTS_NOTIFICATIONS

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
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

    @ensure_rollout_enabled(PROJECT_TEMPLATE_FEATURE_FLAG)
    def put(self, request: Request, organization: Organization, template_id: str) -> Response:
        """
        Update the project template name or options.

        Return the updated project template.
        """
        serializer = ProjectTemplateWriteSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(status=400, data=serializer.errors)

        data = serializer.validated_data

        project_template = get_object_or_404(
            ProjectTemplate, id=template_id, organization=organization
        )

        name = data.get("name")
        if name is not None:
            project_template.name = name
            project_template.save()

        options = data.get("options", {})
        for key, value in options.items():
            project_template.options.create_or_update(
                project_template=project_template, key=key, value=value
            )

        return Response(
            serialize(
                project_template,
                request.user,
                ProjectTemplateSerializer(expand=[ProjectTemplateAttributes.OPTIONS]),
            )
        )
