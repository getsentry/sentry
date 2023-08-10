from unittest.mock import MagicMock, patch

import pytest

from sentry.models.notificationaction import ActionService, ActionTarget, NotificationAction
from sentry.models.notificationaction import logger as NotificationActionLogger
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
@patch.dict(NotificationAction._registry, {})
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

    @patch.object(NotificationActionLogger, "error")
    def test_register_action_for_fire(self, mock_error_logger):
        mock_handler = MagicMock()
        NotificationAction.register_action(
            trigger_type=self.notif_action.trigger_type,
            service_type=self.notif_action.service_type,
            target_type=self.notif_action.target_type,
        )(mock_handler)

        self.notif_action.fire()
        assert not mock_error_logger.called
        assert mock_handler.called

    def test_register_action_for_overlap(self):
        NotificationAction.register_trigger_type(*self.illegal_trigger)
        mock_handler = MagicMock()
        NotificationAction.register_action(
            trigger_type=self.illegal_trigger[0],
            service_type=ActionService.EMAIL.value,
            target_type=ActionTarget.SPECIFIC.value,
        )(mock_handler)
        with pytest.raises(AttributeError):
            NotificationAction.register_action(
                trigger_type=self.illegal_trigger[0],
                service_type=ActionService.EMAIL.value,
                target_type=ActionTarget.SPECIFIC.value,
            )(mock_handler)

    def test_register_trigger_type(self):
        self.notif_action.trigger_type = self.illegal_trigger[0]
        self.notif_action.save()
        self.notif_action.full_clean()
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
