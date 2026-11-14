import uuid
from unittest.mock import MagicMock, Mock, patch

import pytest
from jsonschema import ValidationError

from sentry.services.eventstore.models import GroupEvent
from sentry.testutils.cases import TestCase
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import (
    ActionHandler,
    ActionInvocation,
    UnsupportedActionEvent,
    WorkflowEventData,
)
from tests.sentry.workflow_engine.test_base import OrganizationEvent


class TestAction(TestCase):
    def setUp(self) -> None:
        mock_group_event = Mock(spec=GroupEvent)
        self.group = self.create_group()
        mock_group_event.project = self.group.project
        mock_group_event.project_id = self.group.project_id
        self.detector = self.create_detector(project=self.group.project)

        self.mock_event = WorkflowEventData(event=mock_group_event, group=self.group)
        self.action = Action(type=Action.Type.SLACK)
        self.workflow = self.create_workflow()
        self.config_schema = {
            "$id": "https://example.com/user-profile.schema.json",
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "description": "A representation of a user profile",
            "type": "object",
            "properties": {
                "foo": {"type": "string"},
            },
            "additionalProperties": False,
        }

        self.valid_params = {
            "type": Action.Type.SLACK,
            "config": {"foo": "bar"},
            "data": {"foo": "bar"},
        }

    def test_default_dedup_key_preserves_target_and_dynamic_fields(self) -> None:
        action = Action(
            type=Action.Type.SLACK,
            integration_id=123,
            config={"target_identifier": "channel", "target_display": "#channel"},
            data={"dynamic_form_fields": {"foo": "bar"}, "metadata": "ignored"},
        )

        assert action.get_dedup_key() == "slack:123:{'target_identifier': 'channel'}:{'foo': 'bar'}"
        assert action.config["target_display"] == "#channel"
        assert action.data["metadata"] == "ignored"

    def test_get_handler_notification_type(self) -> None:
        with patch("sentry.workflow_engine.registry.action_handler_registry.get") as mock_get:
            mock_handler = Mock(spec=ActionHandler)
            mock_get.return_value = mock_handler

            handler = self.action.get_handler()

            mock_get.assert_called_once_with(Action.Type.SLACK)
            assert handler == mock_handler

    def test_get_handler_webhook_type(self) -> None:
        self.action = Action(type=Action.Type.WEBHOOK)

        with patch("sentry.workflow_engine.registry.action_handler_registry.get") as mock_get:
            mock_handler = Mock(spec=ActionHandler)
            mock_get.return_value = mock_handler

            handler = self.action.get_handler()

            mock_get.assert_called_once_with(Action.Type.WEBHOOK)
            assert handler == mock_handler

    def test_get_handler_unregistered_type(self) -> None:
        with patch("sentry.workflow_engine.registry.action_handler_registry.get") as mock_get:
            mock_get.side_effect = NoRegistrationExistsError(
                "No handler registered for notification type"
            )

            with pytest.raises(
                NoRegistrationExistsError, match="No handler registered for notification type"
            ):
                self.action.get_handler()

            # Verify the registry was queried with the correct action type
            mock_get.assert_called_once_with(Action.Type.SLACK)

    @patch("sentry.workflow_engine.processors.detector.get_preferred_detector")
    def test_trigger_calls_handler_execute(self, mock_get_detector: MagicMock) -> None:
        mock_handler = Mock(spec=ActionHandler)
        mock_detector = self.detector
        mock_get_detector.return_value = mock_detector

        notification_uuid = str(uuid.uuid4())
        with patch.object(self.action, "get_handler", return_value=mock_handler):
            self.action.trigger(
                self.mock_event,
                notification_uuid=notification_uuid,
                workflow_id=self.workflow.id,
                detector=mock_detector,
            )

            assert mock_handler.execute.call_count == 1
            invocation = mock_handler.execute.call_args[0][0]
            assert isinstance(invocation, ActionInvocation)
            assert invocation.event_data == self.mock_event
            assert invocation.action == self.action
            assert invocation.detector == mock_detector
            mock_get_detector.assert_not_called()

    def test_trigger_with_failing_handler(self) -> None:
        mock_handler = Mock(spec=ActionHandler)
        mock_handler.execute.side_effect = Exception("Handler failed")
        detector = self.detector

        with patch.object(self.action, "get_handler", return_value=mock_handler):
            with pytest.raises(Exception, match="Handler failed"):
                self.action.trigger(
                    self.mock_event,
                    notification_uuid=str(uuid.uuid4()),
                    workflow_id=self.workflow.id,
                    detector=detector,
                )

    @patch("sentry.utils.metrics.incr")
    def test_trigger_metrics(self, mock_incr: MagicMock) -> None:
        mock_handler = Mock(spec=ActionHandler)
        detector = self.detector

        with patch.object(self.action, "get_handler", return_value=mock_handler):
            self.action.trigger(
                self.mock_event,
                notification_uuid=str(uuid.uuid4()),
                workflow_id=self.workflow.id,
                detector=detector,
            )

            mock_handler.execute.assert_called_once()
            mock_incr.assert_called_once_with(
                "workflow_engine.action.trigger",
                tags={"action_type": self.action.type, "detector_type": "error"},
                sample_rate=1.0,
            )

    def test_config_schema(self) -> None:
        mock_handler = Mock(spec=ActionHandler)
        mock_handler.config_schema = self.config_schema
        mock_handler.data_schema = self.config_schema

        with patch.object(Action, "get_handler", return_value=mock_handler):
            params = self.valid_params.copy()
            params["config"] = {"foo": "bar"}
            result = Action.objects.create(**params)
            assert result is not None

    def test_config_schema__invalid(self) -> None:
        mock_handler = Mock(spec=ActionHandler)
        mock_handler.config_schema = self.config_schema
        mock_handler.data_schema = self.config_schema

        with patch.object(Action, "get_handler", return_value=mock_handler):
            with pytest.raises(ValidationError):
                params = self.valid_params.copy()
                params["config"] = {"baz": 42}
                Action.objects.create(**params)

    def test_data_schema(self) -> None:
        mock_handler = Mock(spec=ActionHandler)
        mock_handler.config_schema = self.config_schema
        mock_handler.data_schema = self.config_schema

        with patch.object(Action, "get_handler", return_value=mock_handler):
            params = self.valid_params.copy()
            params["data"] = {"foo": "bar"}
            result = Action.objects.create(**params)

            assert result is not None

    def test_data_schema__invalid(self) -> None:
        mock_handler = Mock(spec=ActionHandler)
        mock_handler.config_schema = self.config_schema
        mock_handler.data_schema = self.config_schema

        with patch.object(Action, "get_handler", return_value=mock_handler):
            with pytest.raises(ValidationError):
                params = self.valid_params.copy()
                params["data"] = {"baz": 42}
                Action.objects.create(**params)

    def test_group_less_invocation(self) -> None:
        source = OrganizationEvent(organization_id=self.organization.id, event_id=uuid.uuid4())
        event_data = WorkflowEventData(event=source, organization=self.organization)
        detector = self.create_all_projects_detector(self.organization)
        notification_uuid = str(uuid.uuid4())
        with (
            patch.object(ActionHandler, "supports_group_less", True),
            patch.object(self.action.get_handler(), "execute") as execute,
        ):
            self.action.trigger(event_data, notification_uuid, self.workflow.id, detector=detector)
        execute.assert_called_once_with(
            ActionInvocation(event_data, self.action, detector, notification_uuid, self.workflow.id)
        )

    def test_rejects_project_less_detector_for_issue_action(self) -> None:
        detector = self.create_all_projects_detector(self.organization)
        with pytest.raises(UnsupportedActionEvent, match="project-scoped detector"):
            self.action.trigger(
                self.mock_event, str(uuid.uuid4()), self.workflow.id, detector=detector
            )

    def test_rejects_detector_from_another_organization(self) -> None:
        detector = self.create_detector(
            project=self.create_project(organization=self.create_organization())
        )
        with pytest.raises(ValueError, match="same organization"):
            self.action.trigger(
                self.mock_event, str(uuid.uuid4()), self.workflow.id, detector=detector
            )

    def test_group_less_detector_organization_must_match(self) -> None:
        source = OrganizationEvent(organization_id=self.organization.id, event_id=uuid.uuid4())
        event_data = WorkflowEventData(event=source, organization=self.organization)
        detector = self.create_all_projects_detector(self.create_organization())
        with (
            patch.object(ActionHandler, "supports_group_less", True),
            pytest.raises(ValueError, match="same organization"),
        ):
            self.action.trigger(event_data, str(uuid.uuid4()), self.workflow.id, detector=detector)

    def test_issue_handler_rejects_group_less_event(self) -> None:
        event_data = WorkflowEventData(
            event=OrganizationEvent(organization_id=self.organization.id, event_id=uuid.uuid4()),
            organization=self.organization,
        )
        with (
            patch.object(self.action.get_handler(), "execute") as execute,
            pytest.raises(UnsupportedActionEvent, match="issue group"),
        ):
            self.action.trigger(
                event_data, str(uuid.uuid4()), self.workflow.id, detector=self.detector
            )
        execute.assert_not_called()
