from sentry.notifications.notifications.organization_request.integration_request import (
    IntegrationRequestNotification,
)
from sentry.testutils.cases import TestCase


class AssignedNotificationAPITest(TestCase):
    def test_sends_integration_request(self):
        owner = self.create_user("owner@example.com")
        org = self.create_organization(owner=owner)
        requester = self.create_user()
        self.create_member(user=requester, organization=org)

        message = "hello"
        notification = IntegrationRequestNotification(
            org,
            requester,
            provider_type="first_party",
            provider_slug="slack",
            provider_name="Slack",
            message=message,
        )
        context = notification.get_context()
        context["requester_name"] = requester.get_display_name()
        context["organization_name"] = org.name
        context["message"] = message
