from rest_framework import status
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers.rest_framework.notification_action import NotificationActionSerializer
from sentry.models.organization import Organization


@region_silo_endpoint
class NotificationActionsIndexEndpoint(OrganizationEndpoint):
    def get(self, request, organization: Organization):
        return Response(status=200)

    def post(self, request, organization: Organization):
        serializer = NotificationActionSerializer(
            context={
                "access": request.access,
                "organization": organization,
                "user": request.user,
            },
            data=request.data,
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serializer.save()
        return Response(status=status.HTTP_201_CREATED)
