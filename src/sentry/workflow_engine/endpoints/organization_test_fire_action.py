import logging
from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST, HTTP_404_NOT_FOUND

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.apidocs.constants import RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.models.project import Project
from sentry.utils.samples import create_sample_event
from sentry.workflow_engine.endpoints.utils.test_fire_action import test_fire_action
from sentry.workflow_engine.endpoints.validators.base.action import BaseActionValidator
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.types import WorkflowEventData

logger = logging.getLogger(__name__)


class TestActionValidator(BaseActionValidator[Action]):
    class Meta:
        model = Action
        fields = ["data", "config", "type", "integration_id"]


class TestActionsValidator(CamelSnakeSerializer):
    actions = serializers.ListField(required=True)

    def validate_actions(self, value):
        for action in value:
            TestActionValidator(data=action).is_valid(raise_exception=True)
        return value


class TestFireActionErrorsResponse(TypedDict):
    actions: list[str]


@region_silo_endpoint
class OrganizationTestFireActionsEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ECOSYSTEM

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
        serializer = TestActionsValidator(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # Get the first project associated with the organization
        # This is because we don't have a project when test firing actions
        project = Project.objects.filter(organization=organization).first()
        if not project:
            return Response(
                {"detail": "No projects found for this organization"},
                status=HTTP_404_NOT_FOUND,
            )

        action_exceptions = []

        # Create a test event for the project
        test_event = create_sample_event(
            project, platform=project.platform, default="javascript", tagged=True
        )

        # Create a dummy workflow and detector for testing
        workflow_id = -1

        workflow_event_data = WorkflowEventData(
            event=test_event,
            workflow_id=workflow_id,
        )

        detector = Detector(
            id=-1,
            project=project,
            name="Test Detector",
            enabled=True,
            type="error",
        )

        # Process each action
        for action_data in data.get("actions", []):
            # Create a temporary Action object (not saved to database)
            action = Action(
                id=-1,
                type=action_data["type"],
                integration_id=action_data.get("integration_id"),
                data=action_data.get("data", {}),
                config=action_data.get("config", {}),
            )

            # Test fire the action and collect any exceptions
            exceptions = test_fire_action(action, workflow_event_data, detector)
            if exceptions:
                action_exceptions.extend(exceptions)

        # Return any exceptions that occurred
        status = None
        response_data = None
        if len(action_exceptions) > 0:
            status = HTTP_400_BAD_REQUEST
            response_data = {"actions": action_exceptions}

        return Response(status=status, data=response_data)
