from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import ObjectStatus, OrganizationIntegration
from sentry.services.hybrid_cloud.organization import organization_service


@control_silo_endpoint
class UserOrganizationIntegrationsEndpoint(UserEndpoint):
    def get(self, request: Request, user) -> Response:
        """
        Retrieve all of a users' organization integrations
        --------------------------------------------------

        :pparam string user ID: user ID, or 'me'
        :qparam string provider: optional provider to filter by
        :auth: required
        """
        org_ids = [
            o.id
            for o in organization_service.get_organizations(
                user_id=request.user.id, only_visible=True, scope=None
            )
        ]
        queryset = OrganizationIntegration.objects.filter(
            organization_id__in=org_ids,
            status=ObjectStatus.ACTIVE,
            integration__status=ObjectStatus.ACTIVE,
        )
        provider = request.GET.get("provider")
        if provider:
            queryset = queryset.filter(integration__provider=provider.lower())

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
