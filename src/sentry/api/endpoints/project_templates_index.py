from functools import wraps

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project_template import (
    ProjectTemplateSerializer,
    ProjectTemplateWriteSerializer,
)
from sentry.models.organization import Organization
from sentry.models.projecttemplate import ProjectTemplate

PROJECT_TEMPLATE_FEATURE_FLAG = "organizations:project-templates"
AUDIT_LOG_EVENT_ID = "PROJECT_TEMPLATE_CREATED"


def ensure_rollout_enabled(flag):
    def decoartor(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            request = args[1]
            organization = kwargs["organization"]
            user = request.user

            if not features.has(flag, organization, actor=user):
                return Response(status=404)

            return func(*args, **kwargs)

        return wrapper

    return decoartor


@region_silo_endpoint
class OrganizationProjectTemplatesIndexEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ALERTS_NOTIFICATIONS

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    permission_classes = (OrganizationPermission,)

    @ensure_rollout_enabled(PROJECT_TEMPLATE_FEATURE_FLAG)
    def get(self, request: Request, organization: Organization) -> Response:
        """
        List of Project Templates, does not include the options for the project template.

        Return a list of project templates available to the authenticated user.
        """
        queryset = ProjectTemplate.objects.filter(organization=organization)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="date_added",
            on_results=lambda x: serialize(x, request.user, ProjectTemplateSerializer()),
            paginator_cls=OffsetPaginator,
        )

    @ensure_rollout_enabled(PROJECT_TEMPLATE_FEATURE_FLAG)
    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a new Project Template for the organization.

        The Request body should be a JSON object with the following keys:
        - name: string
        - options: {key: 'value'} - optional - creates a ProjectTemplateOption for each key-value pair
        """
        serializer = ProjectTemplateWriteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(status=400, data=serializer.errors)

        data = serializer.validated_data

        project_template = ProjectTemplate.objects.create(
            name=data.get("name"),
            organization=organization,
        )

        options = data.get("options", {})
        for key, value in options.items():
            project_template.options.create(key=key, value=value)

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=project_template.id,
            event=audit_log.get_event_id(AUDIT_LOG_EVENT_ID),
            data=project_template.get_audit_log_data(),
        )

        return Response(serialize(project_template, request.user), status=201)
