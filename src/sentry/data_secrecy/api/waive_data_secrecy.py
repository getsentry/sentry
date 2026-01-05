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
from sentry.data_secrecy.logic import cache_effective_grant_status, data_access_grant_exists
from sentry.data_secrecy.models.data_access_grant import (
    DataAccessGrant,
    get_active_tickets_for_organization,
)
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)

logger = logging.getLogger("sentry.data_secrecy")


class WaiveDataSecrecyPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write"],
        "POST": ["org:write"],
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


@control_silo_endpoint
class WaiveDataSecrecyEndpoint(ControlSiloOrganizationEndpoint):
    permission_classes: tuple[type[BasePermission], ...] = (WaiveDataSecrecyPermission,)
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
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
        assert grant_status.access_start and grant_status.access_end

        serialized_grant_status = {
            "accessStart": grant_status.access_start.isoformat(),
            "accessEnd": grant_status.access_end.isoformat(),
            "zendeskTickets": get_active_tickets_for_organization(organization_id=organization.id),
        }
        return Response(serialized_grant_status, status=status.HTTP_200_OK)

    def post(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        """
        Manually create a data secrecy waiver. Caches and returns the new effective grant status.

        :param access_end: the timestamp at which data secrecy is reinstated.
        """
        validator = DataSecrecyWaiverValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        result = validator.validated_data

        DataAccessGrant.create_data_access_grant(
            organization.id, request.user.id, DataAccessGrant.GrantType.MANUAL, result["access_end"]
        )

        cache_effective_grant_status(organization_id=organization.id)
        grant_status = effective_grant_status_cache.get(organization_id=organization.id)
        assert grant_status.access_start and grant_status.access_end

        serialized_grant_status = {
            "accessStart": grant_status.access_start.isoformat(),
            "accessEnd": grant_status.access_end.isoformat(),
            "zendeskTickets": get_active_tickets_for_organization(organization_id=organization.id),
        }

        return Response(serialized_grant_status, status=status.HTTP_201_CREATED)

    def delete(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        """
        Revoke all active data secrecy waivers for an organization.
        """
        DataAccessGrant.revoke_active_data_access_grants(
            organization.id, request.user.id, DataAccessGrant.RevocationReason.MANUAL_REVOCATION
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
