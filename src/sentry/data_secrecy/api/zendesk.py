from rest_framework import status
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint, OrganizationPermission
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)

TICKET_CREATED_EVENT = "zen:event-type:ticket.created"
TICKET_RESOLVED_EVENT = "zen:event-type:ticket.status_changed"


class ZendeskWebhookPermission(OrganizationPermission):
    scope_map = {"POST": ["org:write"]}


@control_silo_endpoint
class DataSecrecyZendeskWebhookHandler(ControlSiloOrganizationEndpoint):
    # TODO: what to do about auth?
    permission_classes: tuple[type[BasePermission], ...] = (ZendeskWebhookPermission,)
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE

    def _handle_ticket_created(self, request: Request, organization: RpcOrganization):
        pass

    def _handle_ticket_resolved(self, request: Request, organization: RpcOrganization):
        pass

    def post(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        event_type = request.data.get("detail", {}).get("id")

        if event_type == TICKET_CREATED_EVENT:
            return self._handle_ticket_created(request, organization)
        elif event_type == TICKET_RESOLVED_EVENT:
            return self._handle_ticket_resolved(request, organization)
        else:
            response_str = f"Unsupported Zendesk event type: {event_type}"
            return Response({response_str}, status=status.HTTP_400_BAD_REQUEST)
