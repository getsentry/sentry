from rest_framework.request import Request

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.projectcodeowners import ProjectCodeOwnersSerializer
from sentry.models import Organization, ProjectCodeOwners


class OrganizationCodeOwnersEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsPermission,)

    def get(self, request: Request, organization: Organization):
        return self.paginate(
            request=request,
            queryset=ProjectCodeOwners.objects.filter_by_organization(
                user=request.user, organization=organization
            ),
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x,
                request.user,
                serializer=ProjectCodeOwnersSerializer(expand=["errors"]),
            ),
        )
