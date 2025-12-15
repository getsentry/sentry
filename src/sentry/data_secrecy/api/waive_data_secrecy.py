import logging
from datetime import datetime
from typing import Any

from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint, OrganizationPermission
from sentry.data_secrecy.cache import effective_grant_status_cache
from sentry.data_secrecy.logic import data_access_grant_exists
from sentry.data_secrecy.models.data_access_grant import (
    DataAccessGrant,
    create_or_update_data_access_grant,
    revoke_active_data_access_grants,
)
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)

logger = logging.getLogger("sentry.data_secrecy")


class WaiveDataSecrecyPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write"],
        "PUT": ["org:write"],
        "DELETE": ["org:write"],
    }


class DataSecrecyWaiverValidator(serializers.Serializer[dict[str, Any]]):
    access_end = serializers.DateTimeField(required=True)

    def validate_access_end(self, access_end: datetime) -> datetime:
        if access_end <= timezone.now():
            raise serializers.ValidationError(
                "Invalid timestamp (access_end must be in the future)."
            )
        return access_end


def get_active_tickets_for_organization(organization_id: int) -> list[str]:
    """
    Separate function to get ticket info for UI display.
    Called only when needed (not on every access check).
    Fast query since we can filter by time.
    """
    now = timezone.now()
    active_zendesk_tickets = DataAccessGrant.objects.filter(
        organization_id=organization_id,
        grant_type=DataAccessGrant.GrantType.ZENDESK,
        grant_start__lte=now,
        grant_end__gt=now,
        revocation_date__isnull=True,
        ticket_id__isnull=False,
    ).values_list("ticket_id", flat=True)
    return [ticket_id for ticket_id in active_zendesk_tickets if ticket_id is not None]


@control_silo_endpoint
class WaiveDataSecrecyEndpoint(ControlSiloOrganizationEndpoint):
    permission_classes: tuple[type[BasePermission], ...] = (WaiveDataSecrecyPermission,)
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE

    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        """
        Return current waiver status and a list of all active tickets for an organization.
        """
        if not data_access_grant_exists(organization_id=organization.id):
            return Response(
                {"detail": "No data secrecy waiver in place."}, status=status.HTTP_404_NOT_FOUND
            )

        # calling data_access_grant_exists sets the grant status in the cache
        grant_status = effective_grant_status_cache.get(organization_id=organization.id)
        if not grant_status.access_start or not grant_status.access_end:
            logger.error(
                "EffectiveGrantStatus with valid window missing start or end date",
                extra={"organization_id": organization.id},
            )
            return Response("Effective grant status is malformed", status=status.HTTP_404_NOT_FOUND)

        serialized_grant_status = {
            "accessStart": grant_status.access_start.isoformat(),
            "accessEnd": grant_status.access_end.isoformat(),
            "zendeskTickets": get_active_tickets_for_organization(organization_id=organization.id),
        }
        return Response(serialized_grant_status, status=status.HTTP_200_OK)

    def put(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        """
        Manually update or create a data secrecy waiver.

        :param access_end: the timestamp at which data secrecy is reinstated.
        """
        validator = DataSecrecyWaiverValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        result = validator.validated_data

        create_or_update_data_access_grant(
            organization.id, request.user.id, DataAccessGrant.GrantType.MANUAL, result["access_end"]
        )

        return Response(status=status.HTTP_201_CREATED)

    def delete(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        """
        Revoke all active manual data secrecy waivers for an organization.
        """
        revoke_active_data_access_grants(
            organization.id, request.user.id, DataAccessGrant.RevocationReason.MANUAL_REVOCATION
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
