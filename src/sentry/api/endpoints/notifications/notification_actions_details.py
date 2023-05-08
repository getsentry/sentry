import logging

from django.db.models import Q
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.endpoints.notifications.notification_actions_index import (
    NotificationActionsPermission,
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.notification_action import NotificationActionSerializer
from sentry.models.notificationaction import NotificationAction
from sentry.models.organization import Organization

logger = logging.getLogger(__name__)


@region_silo_endpoint
class NotificationActionsDetailsEndpoint(OrganizationEndpoint):
    """
    Manages a single NotificationAction via the action_id passed in the path.
    GET: Returns the serialized NotificationAction
    PUT: Update the entire NotificationAction, overwriting previous values
    DELETE: Delete the NotificationAction
    """

    permission_classes = (NotificationActionsPermission,)

    def convert_args(self, request: Request, action_id: int, *args, **kwargs):
        parsed_args, parsed_kwargs = super().convert_args(request, *args, **kwargs)
        organization = parsed_kwargs["organization"]
        accessible_projects = self.get_projects(request, organization, project_ids={-1})
        try:
            # It must either have no project affiliation, or be accessible to the user...
            action = (
                NotificationAction.objects.filter(
                    Q(projects=None) | Q(projects__in=accessible_projects),
                ).distinct()
                # and must belong to the organization
                .get(
                    id=action_id,
                    organization_id=organization.id,
                )
            )
        except NotificationAction.DoesNotExist:
            raise ResourceDoesNotExist

        parsed_kwargs["action"] = action

        return (parsed_args, parsed_kwargs)

    def get(
        self, request: Request, organization: Organization, action: NotificationAction
    ) -> Response:
        logger.info(
            "notification_action.get_one",
            extra={"organization_id": organization.id, "action_id": action.id},
        )
        return Response(serialize(action, request.user))

    def put(
        self, request: Request, organization: Organization, action: NotificationAction
    ) -> Response:
        serializer = NotificationActionSerializer(
            instance=action,
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
        logger.info(
            "notification_action.update",
            extra={"organization_id": organization.id, "action_id": action.id},
        )
        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=action.id,
            event=audit_log.get_event_id("NOTIFICATION_ACTION_EDIT"),
            data=action.get_audit_log_data(),
        )
        return Response(serialize(action, user=request.user), status=status.HTTP_202_ACCEPTED)

    def delete(
        self, request: Request, organization: Organization, action: NotificationAction
    ) -> Response:
        logger.info(
            "notification_action.delete",
            extra={"organization_id": organization.id, "action_data": serialize(action)},
        )
        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=action.id,
            event=audit_log.get_event_id("NOTIFICATION_ACTION_REMOVE"),
            data=action.get_audit_log_data(),
        )
        action.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
