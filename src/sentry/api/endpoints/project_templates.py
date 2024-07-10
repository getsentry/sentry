from django.contrib.auth.models import AnonymousUser
from django.shortcuts import get_object_or_404
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project_template import (
    ProjectOptionsAttributes,
    ProjectTemplateSerializer,
)
from sentry.models.organization import Organization
from sentry.models.projecttemplate import ProjectTemplate
from sentry.models.user import User


def is_org_in_rollout(organization: Organization, user: AnonymousUser | User) -> bool:
    return features.has("organizations:project-templates", organization, actor=user)


@region_silo_endpoint
class OrganizationProjectTemplatesIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List of Project Templates, does not include the options for the project template.

        Return a list of project templates available to the authenticated user.
        """
        if not is_org_in_rollout(organization, request.user):
            return Response(status=404)

        # TODO verify that this will autenticate the user to the organization,
        # otherwise, add a filter to ensure the user is in the organization or is a superuser.
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

    def get(self, request: Request, organization: Organization, template_id: str) -> Response:
        """
        Retrieve a project template by its ID.

        Return details on an individual project template.
        """
        if not is_org_in_rollout(organization, request.user):
            return Response(status=404)

        # TODO verify that this will autenticate the user to the organization, (need to run as getsentry)
        # otherwise, add a filter to ensure the user is in the organization or is a superuser.
        project_template = get_object_or_404(
            ProjectTemplate, id=template_id, organization=organization
        )

        return Response(
            serialize(
                project_template,
                request.user,
                ProjectTemplateSerializer(expand=[ProjectOptionsAttributes.OPTIONS]),
            )
        )
