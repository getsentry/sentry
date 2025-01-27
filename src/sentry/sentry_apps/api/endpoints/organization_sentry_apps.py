from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.constants import SentryAppStatus
from sentry.organizations.services.organization import RpcOrganization
from sentry.organizations.services.organization.model import RpcUserOrganizationContext
from sentry.sentry_apps.api.serializers.sentry_app import (
    SentryAppSerializer as ResponseSentryAppSerializer,
)
from sentry.sentry_apps.models.sentry_app import SentryApp


@control_silo_endpoint
class OrganizationSentryAppsEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        queryset = SentryApp.objects.filter(owner_id=organization.id, application__isnull=False)

        status = request.GET.get("status")
        if status is not None:
            queryset = queryset.filter(status=SentryAppStatus.as_int(status))

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, access=request.access, serializer=ResponseSentryAppSerializer()
            ),
        )
