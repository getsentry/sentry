from unittest.mock import MagicMock, patch

from rest_framework import status

from sentry.notifications.models.notificationaction import (
    ActionRegistration,
    ActionService,
    ActionTarget,
    NotificationAction,
)
from sentry.testutils.cases import APITestCase


@patch.dict(NotificationAction._registry, {})
class NotificationActionsAvailableEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-notification-available-actions"

    def setUp(self):
        self.user = self.create_user("chrisredfield@re.com")
        self.organization = self.create_organization(name="bsaa", owner=self.user)
        self.login_as(self.user)

    def test_get_success(self):
        self.get_success_response(self.organization.slug)

    @patch("sentry.notifications.models.notificationaction.ActionTrigger")
    def test_get_dynamic_response(self, mock_action_trigger):
        """
        Note: This test assumes the ActionTrigger already contains reference to the trigger. Only
        validates that new action registrations get serialized (as is the case for getsentry)
        """
        trigger = (-1, "t-virus")
        mock_action_trigger.as_choices.return_value = (trigger,)

        trigger_available_response = {
            "action": {
                "triggerType": trigger[1],
                "serviceType": "sentry_notification",
                "targetType": "specific",
            },
            "requires": [{"name": "projects"}],
        }

        class MockActionRegistration(ActionRegistration):
            serialize_available = MagicMock(return_value=[trigger_available_response])

        response = self.get_success_response(
            self.organization.slug,
            status_code=status.HTTP_200_OK,
        )
        assert trigger_available_response not in response.data["actions"]
        assert not MockActionRegistration.serialize_available.called

        NotificationAction.register_action(
            trigger_type=trigger[0],
            service_type=ActionService.SENTRY_NOTIFICATION.value,
            target_type=ActionTarget.SPECIFIC.value,
        )(MockActionRegistration)

        response = self.get_success_response(
            self.organization.slug,
            status_code=status.HTTP_200_OK,
        )
        assert trigger_available_response in response.data["actions"]
        assert MockActionRegistration.serialize_available.called
