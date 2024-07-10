from functools import wraps

from django.shortcuts import get_object_or_404
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project_template import (
    ProjectTemplateAttributes,
    ProjectTemplateSerializer,
)
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.projecttemplate import ProjectTemplate


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


def authenticated_endpoint(func):
    @ensure_rollout_enabled("organizations:project-templates")
    def wrapper(*args, **kwargs):
        request = args[1]
        request_organization_id = kwargs["organization"].id
        user = request.user

        if not user.is_authenticated:
            return Response({"detail": "This endpoint requires user info"}, status=401)

        if request.auth is not None and request.auth.organization_id:
            authorized_organizations = [request.auth.organization_id]
        else:
            authorized_organizations = OrganizationMember.objects.filter(
                user_id=user.id
            ).values_list("organization_id", flat=True)

        if request_organization_id not in authorized_organizations:
            return Response(
                {"detail": "This endpoint requires user to be authenticated to the organization"},
                status=401,
            )

        return func(*args, **kwargs)

    return wrapper


def authenticated_organization_admin(func):
    @authenticated_endpoint
    def wrapper(*args, **kwargs):
        request = args[1]
        user = request.user

        if features.has("organization:create", actor=user):
            return Response(
                {"detail": "Project Templates are not allowed to be created by this user."},
                status=401,
            )

        return func(*args, **kwargs)

    return wrapper


@region_silo_endpoint
class OrganizationProjectTemplatesIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationPermission,)

    @authenticated_endpoint
    def get(self, request: Request, organization: Organization) -> Response:
        """
        List of Project Templates, does not include the options for the project template.

        Return a list of project templates available to the authenticated user.
        """
        queryset = ProjectTemplate.objects.filter(organization=organization)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="name",
            on_results=lambda x: serialize(x, request.user, ProjectTemplateSerializer()),
            paginator_cls=OffsetPaginator,
        )


@region_silo_endpoint
class OrganizationProjectTemplateDetailEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationPermission,)

    @authenticated_endpoint
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
