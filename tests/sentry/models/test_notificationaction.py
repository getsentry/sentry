from collections import defaultdict
from unittest.mock import MagicMock, patch

import pytest
from django.forms import ValidationError

from sentry.models.notificationaction import NotificationAction
from sentry.models.notificationaction import logger as NotificationActionLogger
from sentry.testutils import TestCase


@patch.dict(NotificationAction._handlers, defaultdict(dict))
class NotificationActionTest(TestCase):
    def setUp(self):
        self.organization = self.create_organization(name="night city")
        self.projects = [
            self.create_project(name="netrunner", organization=self.organization),
            self.create_project(name="edgerunner", organization=self.organization),
        ]
        self.notif_action = self.create_notification_action(
            organization=self.organization, projects=self.projects
        )
        self.illegal_trigger = (-1, "sandevistan")
        self.illegal_service = (-1, "braindance")
        # Reset registers for tests

    @patch.object(NotificationActionLogger, "error")
    def test_register_handler_for_fire(self, mock_error_logger):
        self.notif_action.type = self.illegal_service[0]
        self.notif_action.trigger_type = self.illegal_trigger[0]
        self.notif_action.save()
        mock_handler = MagicMock()
        NotificationAction.register_handler(
            trigger_type=self.illegal_trigger[0],
            service_type=self.illegal_service[0],
        )(mock_handler)

        self.notif_action.fire()
        assert not mock_error_logger.called
        assert mock_handler.called

    def test_register_handler_for_overlap(self):
        mock_handler = MagicMock()
        NotificationAction.register_handler(
            trigger_type=self.illegal_trigger[0],
            service_type=self.illegal_service[0],
        )(mock_handler)
        with pytest.raises(AttributeError):
            NotificationAction.register_handler(
                trigger_type=self.illegal_trigger[0],
                service_type=self.illegal_service[0],
            )(mock_handler)

    def test_register_trigger_type(self):
        self.notif_action.trigger_type = self.illegal_trigger[0]
        self.notif_action.save()
        try:
            self.notif_action.full_clean()
        except ValidationError as err:
            assert dict(err)["trigger_type"]
        NotificationAction.register_trigger_type(*self.illegal_trigger)
        self.notif_action.full_clean()

    @patch.object(NotificationActionLogger, "error")
    def test_fire_fails_silently(self, mock_error_logger):
        self.notif_action.trigger_type = self.illegal_trigger[0]
        self.notif_action.save()
        # Misconfigured/missing handlers shouldn't raise errors, but should log errors
        self.notif_action.fire()
        assert mock_error_logger.called
        mock_error_logger.reset_mock()
