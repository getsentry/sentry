from unittest.mock import Mock, patch

import pytest
from django.test import TestCase

from sentry.eventstore.models import GroupEvent
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionHandler


class TestAction(TestCase):
    def setUp(self):
        self.mock_event = Mock(spec=GroupEvent)
        self.mock_detector = Mock(name="detector")
        self.action = Action(type=Action.Type.SLACK)

    def test_get_handler_notification_type(self):
        with patch("sentry.workflow_engine.registry.action_handler_registry.get") as mock_get:
            mock_handler = Mock(spec=ActionHandler)
            mock_get.return_value = mock_handler

            handler = self.action.get_handler()

            mock_get.assert_called_once_with(Action.Type.SLACK)
            assert handler == mock_handler

    def test_get_handler_webhook_type(self):
        self.action = Action(type=Action.Type.WEBHOOK)

        with patch("sentry.workflow_engine.registry.action_handler_registry.get") as mock_get:
            mock_handler = Mock(spec=ActionHandler)
            mock_get.return_value = mock_handler

            handler = self.action.get_handler()

            mock_get.assert_called_once_with(Action.Type.WEBHOOK)
            assert handler == mock_handler

    def test_get_handler_unregistered_type(self):
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

    def test_trigger_calls_handler_execute(self):
        mock_handler = Mock(spec=ActionHandler)

        with patch.object(self.action, "get_handler", return_value=mock_handler):
            self.action.trigger(self.mock_event, self.mock_detector)

            mock_handler.execute.assert_called_once_with(
                self.mock_event, self.action, self.mock_detector
            )

    def test_trigger_with_failing_handler(self):
        mock_handler = Mock(spec=ActionHandler)
        mock_handler.execute.side_effect = Exception("Handler failed")

        with patch.object(self.action, "get_handler", return_value=mock_handler):
            with pytest.raises(Exception, match="Handler failed"):
                self.action.trigger(self.mock_event, self.mock_detector)
