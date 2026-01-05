from unittest.mock import MagicMock, Mock, patch

import pytest
from jsonschema import ValidationError

from sentry.services.eventstore.models import GroupEvent
from sentry.testutils.cases import TestCase
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.types import ActionHandler, ActionInvocation, WorkflowEventData


class TestAction(TestCase):
    def setUp(self) -> None:
        mock_group_event = Mock(spec=GroupEvent)
        self.group = self.create_group()

        self.mock_event = WorkflowEventData(event=mock_group_event, group=self.group)
        self.action = Action(type=Action.Type.SLACK)
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

    @patch("sentry.workflow_engine.processors.detector.get_detector_from_event_data")
    def test_trigger_calls_handler_execute(self, mock_get_detector: MagicMock) -> None:
        mock_handler = Mock(spec=ActionHandler)
        mock_detector = Mock(spec=Detector, type="error")
        mock_get_detector.return_value = mock_detector

        with patch.object(self.action, "get_handler", return_value=mock_handler):
            self.action.trigger(self.mock_event)

            assert mock_handler.execute.call_count == 1
            invocation = mock_handler.execute.call_args[0][0]
            assert isinstance(invocation, ActionInvocation)
            assert invocation.event_data == self.mock_event
            assert invocation.action == self.action
            assert invocation.detector == mock_detector

    @patch("sentry.workflow_engine.processors.detector.get_detector_from_event_data")
    def test_trigger_with_failing_handler(self, mock_get_detector: MagicMock) -> None:
        mock_handler = Mock(spec=ActionHandler)
        mock_handler.execute.side_effect = Exception("Handler failed")
        mock_get_detector.return_value = Mock(spec=Detector, type="error")

        with patch.object(self.action, "get_handler", return_value=mock_handler):
            with pytest.raises(Exception, match="Handler failed"):
                self.action.trigger(self.mock_event)

    @patch("sentry.utils.metrics.incr")
    @patch("sentry.workflow_engine.processors.detector.get_detector_from_event_data")
    def test_trigger_metrics(self, mock_get_detector: MagicMock, mock_incr: MagicMock) -> None:
        mock_handler = Mock(spec=ActionHandler)
        mock_get_detector.return_value = Mock(spec=Detector, type="error")

        with patch.object(self.action, "get_handler", return_value=mock_handler):
            self.action.trigger(self.mock_event)

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
