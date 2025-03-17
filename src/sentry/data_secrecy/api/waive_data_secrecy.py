import logging
from collections.abc import Mapping
from typing import Any

from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.data_secrecy.models import DataSecrecyWaiver
from sentry.models.organization import Organization

logger = logging.getLogger("sentry.data_secrecy")


class WaiveDataSecrecyPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write"],
        "PUT": ["org:write"],
        "DELETE": ["org:write"],
    }


class DataSecrecyWaiverSerializer(CamelSnakeSerializer, serializers.Serializer, Serializer):
    access_start = serializers.DateTimeField()
    access_end = serializers.DateTimeField()

    def validate(self, data):
        access_start = data.get("access_start")
        access_end = data.get("access_end")

        if access_start >= access_end:
            raise serializers.ValidationError(
                "Invalid timestamp (access_start must be before access_end)."
            )
        if access_end <= timezone.now():
            raise serializers.ValidationError(
                "Invalid timestamp (access_end must be in the future)."
            )

        return data

    def serialize(
        self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> Mapping[str, Any]:
        return {
            "accessStart": obj.access_start.isoformat(),
            "accessEnd": obj.access_end.isoformat(),
            "zendeskTickets": list(obj.zendesk_tickets),
        }


@region_silo_endpoint
class WaiveDataSecrecyEndpoint(OrganizationEndpoint):
    permission_classes: tuple[type[BasePermission], ...] = (WaiveDataSecrecyPermission,)
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Returns the data secrecy waiver for an organization if it exists.
        """
        try:
            ds = get_object_or_404(DataSecrecyWaiver, organization=organization)
            return Response(
                serialize(ds, request.user, DataSecrecyWaiverSerializer()),
                status=status.HTTP_200_OK,
            )
        except Http404:
            return Response(
                {"detail": "No data secrecy waiver in place."}, status=status.HTTP_404_NOT_FOUND
            )

    def put(self, request: Request, organization: Organization):
        """
        Update or create an entry for an organization with data secrecy waived until a specified timestamp

        :param access_start: The timestamp at which data secrecy is waived
        :param access_end: The timestamp at which data secrecy is reinstated
        """
        serializer = DataSecrecyWaiverSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        access_start = serializer.validated_data["access_start"]
        access_end = serializer.validated_data["access_end"]

        ds, _ = DataSecrecyWaiver.objects.update_or_create(
            organization=organization,
            defaults={
                "access_start": access_start,
                "access_end": access_end,
            },
        )

        self.create_audit_entry(
            request=request,
            organization=organization,
            event=audit_log.get_event_id("DATA_SECRECY_WAIVED"),
            data={
                "access_start": ds.access_start.isoformat(),
                "access_end": ds.access_end.isoformat(),
            },
        )

        return Response(
            serialize(ds, request.user, DataSecrecyWaiverSerializer()), status=status.HTTP_200_OK
        )

    def delete(self, request: Request, organization: Organization):
        """
        Reinstates data secrecy for an organization.
        """
        try:
            logger.info("Reinstating data secrecy for organization %s", organization.id)
            ds = DataSecrecyWaiver.objects.get(organization=organization)
            logger.info(
                "Data secrecy waiver found for organization %s",
                organization.id,
                extra={"ds": ds.id},
            )
        except DataSecrecyWaiver.DoesNotExist:
            logger.info("No data secrecy waiver found for organization %s", organization.id)
            return Response(
                {"detail": "No data secrecy waiver found for this organization."},
                status=status.HTTP_404_NOT_FOUND,
            )

        ds.delete()
        logger.info("Data secrecy waiver deleted for organization %s", organization.id)

        self.create_audit_entry(
            request=request,
            organization=organization,
            event=audit_log.get_event_id("DATA_SECRECY_REINSTATED"),
        )
        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )
