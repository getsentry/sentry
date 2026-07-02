import uuid
from unittest import mock

import pytest

from sentry.models.activity import Activity
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.notification_action.types import (
    ActivityHandler,
    ActivityHandlerValidationError,
)
from sentry.notifications.notification_action.utils import (
    execute_via_activity_type_registry,
    execute_via_group_type_registry,
)
from sentry.services.eventstore.models import GroupEvent
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class ActivityHandlerTest(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.group, self.event, self.group_event = self.create_group_event()
        self.detector = self.create_detector(project=self.project)
        self.workflow = self.create_workflow()
        self.action = Action(type=Action.Type.SLACK)

    def _make_invocation(self, event: GroupEvent | Activity) -> ActionInvocation:
        return ActionInvocation(
            event_data=WorkflowEventData(event=event, group=self.group),
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id,
        )

    def _make_activity(
        self, activity_type: ActivityType = ActivityType.SEER_RCA_STARTED
    ) -> Activity:
        return self.create_group_activity(group=self.group, type=activity_type.value)


class TestActivityHandlerValidation(ActivityHandlerTest):
    def setUp(self) -> None:
        super().setUp()

        class MockHandler(ActivityHandler):
            compatible_activity_types = [ActivityType.SEER_RCA_STARTED]

            @classmethod
            def invoke_action(cls, invocation: ActionInvocation, activity: Activity) -> None:
                pass

        self.mock_handler = MockHandler

    def test_success(self) -> None:
        activity = self._make_activity()
        result = self.mock_handler.validate_activity(self._make_invocation(activity))
        assert result == activity

    def test_not_an_activity(self) -> None:
        with pytest.raises(ActivityHandlerValidationError, match="not an Activity"):
            self.mock_handler.validate_activity(self._make_invocation(self.group_event))

    def test_incompatible_type(self) -> None:
        with pytest.raises(ActivityHandlerValidationError, match="not compatible"):
            self.mock_handler.validate_activity(
                self._make_invocation(self._make_activity(ActivityType.NOTE))
            )

    def test_unknown_type(self) -> None:
        activity = Activity(project=self.project, group=self.group, type=99999)
        with pytest.raises(ActivityHandlerValidationError, match="Unknown activity type"):
            self.mock_handler.validate_activity(self._make_invocation(activity))


class TestExecuteViaActivityTypeRegistry(ActivityHandlerTest):
    def setUp(self) -> None:
        super().setUp()
        self.mock_handler = mock.MagicMock()
        self.activity = self._make_activity()
        self.invocation = self._make_invocation(self.activity)
        self.mock_handler.validate_activity.return_value = self.activity

    def test_happy_path(self) -> None:
        with mock.patch.object(
            activity_handler_registry, "get", return_value=self.mock_handler
        ) as mock_get:
            execute_via_activity_type_registry(self.invocation)
            mock_get.assert_called_once_with(self.action.type)

        self.mock_handler.validate_activity.assert_called_once_with(invocation=self.invocation)
        self.mock_handler.invoke_action.assert_called_once_with(
            invocation=self.invocation, activity=self.activity
        )

    def test_validation_error_skips_invoke(self) -> None:
        self.mock_handler.validate_activity.side_effect = ValueError("bad")

        with (
            pytest.raises(ValueError, match="bad"),
            mock.patch.object(activity_handler_registry, "get", return_value=self.mock_handler),
        ):
            execute_via_activity_type_registry(self._make_invocation(self._make_activity()))
        self.mock_handler.invoke_action.assert_not_called()


class TestExecuteViaGroupTypeRegistryActivityPath(ActivityHandlerTest):
    @mock.patch("sentry.notifications.notification_action.utils.execute_via_activity_type_registry")
    def test_option_enabled_uses_registry(self, mock_execute: mock.MagicMock) -> None:
        invocation = self._make_invocation(self._make_activity())
        with self.feature({"organizations:workflow-engine-evaluate-seer-activities": True}):
            execute_via_group_type_registry(invocation)
        mock_execute.assert_called_once_with(invocation=invocation)

    def test_option_disabled_falls_through_to_send_notification(self) -> None:
        activity = self._make_activity()
        invocation = self._make_invocation(activity)
        with (
            self.feature({"organizations:workflow-engine-evaluate-seer-activities": False}),
            mock.patch.object(activity, "send_notification") as mock_send,
        ):
            execute_via_group_type_registry(invocation)
            mock_send.assert_called_once_with()

    @mock.patch("sentry.notifications.notification_action.utils.execute_via_activity_type_registry")
    def test_registry_error_falls_through_to_send_notification(
        self, mock_execute: mock.MagicMock
    ) -> None:
        mock_execute.side_effect = RuntimeError("handler failed")
        activity = self._make_activity()
        invocation = self._make_invocation(activity)
        with (
            self.feature({"organizations:workflow-engine-evaluate-seer-activities": True}),
            mock.patch.object(activity, "send_notification") as mock_send,
        ):
            execute_via_group_type_registry(invocation)
            mock_send.assert_called_once_with()
