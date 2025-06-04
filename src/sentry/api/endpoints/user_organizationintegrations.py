from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.organizations.services.organization import organization_service
from sentry.users.api.bases.user import UserEndpoint
from sentry.users.services.user.service import user_service


@control_silo_endpoint
class UserOrganizationIntegrationsEndpoint(UserEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, user) -> Response:
        """
        Retrieve all of a users' organization integrations
        --------------------------------------------------

        :pparam string user ID: user ID, or 'me'
        :qparam string provider: optional provider to filter by
        :auth: required
        """
        organizations = (
            user_service.get_organizations(user_id=request.user.id, only_visible=True)
            if request.user.id is not None
            else ()
        )
        organization_ids = []
        for o in organizations:
            org_context = organization_service.get_organization_by_id(
                id=o.id, user_id=request.user.id
            )
            if org_context and org_context.member and "org:read" in org_context.member.scopes:
                organization_ids.append(o.id)
        queryset = OrganizationIntegration.objects.filter(
            organization_id__in=organization_ids,
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
