from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import pending_silo_endpoint
from sentry.api.bases.organization import Organization, OrganizationEndpoint
from sentry.api.bases.project import Project
from sentry.api.serializers import serialize
from sentry.api.serializers.models import ProjectOptionsSerializer


@pending_silo_endpoint
class OrganizationProjectOptionsEndpoint(OrganizationEndpoint):
    private = True

    def get(self, request: Request, organization: Organization) -> Response:
        """
        For each Project in an Organization, list its project options and values,
        or a singular project option and value if specified.

        :pparam string organization_slug: the slug of the organization.
        :qparam string option: an optional project option name

        """
        projects = Project.objects.filter(organization=organization)
        option = request.GET.get("option")

        serializer = ProjectOptionsSerializer(option=option)

        return Response(serialize(list(projects), serializer=serializer))
