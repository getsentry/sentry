import logging
from typing import Any, TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST, HTTP_401_UNAUTHORIZED

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.apidocs.constants import RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.notifications.notification_action.grouptype import get_test_notification_event_data
from sentry.notifications.types import TEST_NOTIFICATION_ID
from sentry.workflow_engine.endpoints.organization_workflow_index import (
    OrganizationWorkflowPermission,
)
from sentry.workflow_engine.endpoints.utils.test_fire_action import test_fire_action
from sentry.workflow_engine.endpoints.validators.base.action import BaseActionValidator
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import WorkflowEventData

logger = logging.getLogger(__name__)


class TestActionsValidator(CamelSnakeSerializer):
    actions = serializers.ListField(required=True)

    def validate_actions(self, value):
        validated_actions = []
        for action in value:
            action_validator = BaseActionValidator(data=action, context=self.context)
            action_validator.is_valid(raise_exception=True)

            action.update(action_validator.validated_data)
            validated_actions.append(action)

        return validated_actions


class TestFireActionErrorsResponse(TypedDict):
    actions: list[str]


@region_silo_endpoint
class OrganizationTestFireActionsEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ECOSYSTEM
    permission_classes = (OrganizationWorkflowPermission,)

    @extend_schema(
        operation_id="Test Fire Actions",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            200: None,
            400: TestFireActionErrorsResponse,
            401: RESPONSE_UNAUTHORIZED,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, organization) -> Response:
        """
        Test fires a list of actions without saving them to the database.

        The actions will be fired against a sample event in the first project of the organization.
        """
        serializer = TestActionsValidator(data=request.data, context={"organization": organization})

        if not serializer.is_valid():
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        if not request.user.is_authenticated:
            return Response(status=HTTP_401_UNAUTHORIZED)

        # Get the alphabetically first project associated with the organization
        # This is because we don't have a project when test firing actions
        project = (
            Project.objects.filter(
                organization=organization,
                teams__organizationmember__user_id=request.user.id,
                status=ObjectStatus.ACTIVE,
            )
            .order_by("name")
            .first()
        )

        if not project:
            return Response(
                {"detail": "No projects found for this organization that the user has access to"},
                status=HTTP_400_BAD_REQUEST,
            )

        status, response_data = test_fire_actions(data.get("actions", []), project)

        return Response(status=status, data=response_data)


def test_fire_actions(actions: list[dict[str, Any]], project: Project):
    action_exceptions = []

    test_event = get_test_notification_event_data(project)
    if test_event is None:
        # This can happen if the user is rate limited
        return HTTP_400_BAD_REQUEST, {"detail": "No test event was generated"}

    workflow_id = TEST_NOTIFICATION_ID
    workflow_event_data = WorkflowEventData(
        event=test_event,
        group=test_event.group,
    )

    for action_data in actions:
        # Create a temporary Action object (not saved to database)
        action = Action(
            id=TEST_NOTIFICATION_ID,
            type=action_data["type"],
            integration_id=action_data.get("integration_id"),
            data=action_data.get("data", {}),
            config=action_data.get("config", {}),
        )

        # Annotate the action with the workflow id
        setattr(action, "workflow_id", workflow_id)

        # Test fire the action and collect any exceptions
        exceptions = test_fire_action(action, workflow_event_data)
        if exceptions:
            action_exceptions.extend(exceptions)

    # Return any exceptions that occurred
    status = None
    response_data = None
    if len(action_exceptions) > 0:
        status = HTTP_400_BAD_REQUEST
        response_data = {"actions": action_exceptions}

    return status, response_data
