from unittest.mock import MagicMock, patch

from rest_framework import status

from sentry.models.notificationaction import (
    ActionRegistration,
    ActionService,
    ActionTarget,
    NotificationAction,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
@patch.dict(NotificationAction._registry, {})
class NotificationActionsAvailableEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-notification-available-actions"

    def setUp(self):
        self.user = self.create_user("chrisredfield@re.com")
        self.organization = self.create_organization(name="bsaa", owner=self.user)
        self.login_as(self.user)

    def test_get_success(self):
        self.get_success_response(self.organization.slug)

    def test_get_dynamic_response(self):
        trigger = (-1, "t-virus")
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

        registration = MockActionRegistration
        NotificationAction.register_trigger_type(*trigger)
        NotificationAction.register_action(
            trigger_type=trigger[0],
            service_type=ActionService.SENTRY_NOTIFICATION.value,
            target_type=ActionTarget.SPECIFIC.value,
        )(registration)
        assert not registration.serialize_available.called

        response = self.get_success_response(
            self.organization.slug,
            status_code=status.HTTP_200_OK,
        )
        assert trigger_available_response in response.data["actions"]
        assert registration.serialize_available.called
