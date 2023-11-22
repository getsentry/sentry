from sentry.notifications.notifications.organization_request.integration_request import (
    IntegrationRequestNotification,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test
class TestIntegrationRequestNotification(TestCase):
    def test_get_context(self):
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
        assert context["requester_name"] == requester.get_display_name()
        assert context["organization_name"] == org.name
        assert context["message"] == message

    def test_determine_recipients(self):
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
        recipients = notification.determine_recipients()
        assert len(recipients) == 1
        assert recipients[0].id == owner.id

    @with_feature("organizations:customer-domains")
    def test_get_context_customer_domain(self):
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
        assert (
            org.absolute_url(f"/settings/{org.slug}/integrations/slack/")
            in context["integration_link"]
        )
