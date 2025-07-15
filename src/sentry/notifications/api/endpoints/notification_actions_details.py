import logging

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_NO_CONTENT
from sentry.apidocs.examples.notification_examples import NotificationActionExamples
from sentry.apidocs.parameters import GlobalParams, NotificationParams
from sentry.models.organization import Organization
from sentry.notifications.api.endpoints.notification_actions_index import (
    NotificationActionsPermission,
)
from sentry.notifications.api.serializers.notification_action_request import (
    NotificationActionSerializer,
)
from sentry.notifications.api.serializers.notification_action_response import (
    OutgoingNotificationActionSerializer,
)
from sentry.notifications.models.notificationaction import NotificationAction

logger = logging.getLogger(__name__)


@region_silo_endpoint
@extend_schema(tags=["Alerts"])
class NotificationActionsDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

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

        # Get the relevant action associated with the organization and request
        try:
            action = NotificationAction.objects.get(id=action_id, organization_id=organization.id)
        except NotificationAction.DoesNotExist:
            raise ResourceDoesNotExist

        parsed_kwargs["action"] = action

        # If the action has no projects, skip the project access check
        if not action.projects.exists():
            return (parsed_args, parsed_kwargs)

        if request.method == "GET":
            # If we're reading the action, the user must have access to one of the associated projects
            if not any(
                request.access.has_project_scope(project, "project:read")
                for project in action.projects.all()
            ):
                raise PermissionDenied
        else:
            # If we're modifying the action, the user must have access to all associated projects
            if not all(
                request.access.has_project_scope(project, "project:write")
                for project in action.projects.all()
            ):
                raise PermissionDenied(
                    detail="You don't have sufficient permissions to all the projects associated with this action."
                )

        return (parsed_args, parsed_kwargs)

    @extend_schema(
        operation_id="Retrieve a Spike Protection Notification Action",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            NotificationParams.ACTION_ID,
        ],
        responses={200: OutgoingNotificationActionSerializer},
        examples=NotificationActionExamples.GET_NOTIFICATION_ACTION,
    )
    def get(
        self, request: Request, organization: Organization, action: NotificationAction
    ) -> Response:
        """
        Returns a serialized Spike Protection Notification Action object.

        Notification Actions notify a set of members when an action has been triggered through a notification service such as Slack or Sentry.
        For example, organization owners and managers can receive an email when a spike occurs.
        """
        logger.info(
            "notification_action.get_one",
            extra={"organization_id": organization.id, "action_id": action.id},
        )
        return Response(serialize(action, request.user))

    @extend_schema(
        operation_id="Update a Spike Protection Notification Action",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            NotificationParams.ACTION_ID,
        ],
        request=NotificationActionSerializer,
        responses={
            202: OutgoingNotificationActionSerializer,
            400: RESPONSE_BAD_REQUEST,
        },
        examples=NotificationActionExamples.UPDATE_NOTIFICATION_ACTION,
    )
    def put(
        self, request: Request, organization: Organization, action: NotificationAction
    ) -> Response:
        """
        Updates a Spike Protection Notification Action.

        Notification Actions notify a set of members when an action has been triggered through a notification service such as Slack or Sentry.
        For example, organization owners and managers can receive an email when a spike occurs.
        """
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

    @extend_schema(
        operation_id="Delete a Spike Protection Notification Action",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            NotificationParams.ACTION_ID,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
        },
    )
    def delete(
        self, request: Request, organization: Organization, action: NotificationAction
    ) -> Response:
        """
        Deletes a Spike Protection Notification Action.

        Notification Actions notify a set of members when an action has been triggered through a notification service such as Slack or Sentry.
        For example, organization owners and managers can receive an email when a spike occurs.
        """
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
