from typing import Dict

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_flag import FlaggedOrganizationEndpoint
from sentry.api.serializers.base import serialize
from sentry.api.serializers.rest_framework.notification_action import NotificationActionSerializer
from sentry.models.notificationaction import NotificationAction
from sentry.models.organization import Organization


@region_silo_endpoint
class NotificationActionsIndexEndpoint(FlaggedOrganizationEndpoint):
    feature_flags = ["organizations:notification-actions"]

    def get(self, request: Request, organization: Organization) -> Response:
        queryset = NotificationAction.objects.filter(organization_id=organization.id)

        project_id_query = request.GET.getlist("projectId")
        if project_id_query:
            queryset = queryset.filter(projects__in=project_id_query)

        trigger_type_query = request.GET.getlist("triggerType")
        if trigger_type_query:
            triggers: Dict[str, int] = {v: k for k, v in NotificationAction.get_trigger_types()}
            trigger_types = map(lambda t: triggers.get(t), trigger_type_query)
            queryset = queryset.filter(trigger_type__in=trigger_types)

        return Response(serialize(list(queryset), request.user))

    def post(self, request: Request, organization: Organization) -> Response:
        serializer = NotificationActionSerializer(
            context={
                "access": request.access,
                "organization": organization,
                "user": request.user,
            },
            data=request.data,
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        action = serializer.save()
        return Response(serialize(action, request.user), status=status.HTTP_201_CREATED)
