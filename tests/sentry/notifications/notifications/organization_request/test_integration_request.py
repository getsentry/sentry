from django.core import mail

from sentry.notifications.notifications.organization_request.integration_request import (
    IntegrationRequestNotification,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class TestIntegrationRequestNotification(TestCase):
    def test_get_context(self) -> None:
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

    def test_determine_recipients(self) -> None:
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

    @with_feature("system:multi-region")
    def test_get_context_customer_domain(self) -> None:
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

    def test_sanitizes_periods_in_requester_name(self) -> None:
        owner = self.create_user("owner@example.com")
        org = self.create_organization(owner=owner)
        requester = self.create_user(name="Visit evil.com now")
        self.create_member(user=requester, organization=org)

        notification = IntegrationRequestNotification(
            org,
            requester,
            provider_type="first_party",
            provider_slug="slack",
            provider_name="Slack",
        )

        with self.tasks():
            notification.send()

        assert len(mail.outbox) == 1
        assert "evil.com" not in mail.outbox[0].body
        assert "evil\u2060.com" in mail.outbox[0].body

    def _send_integration_request_email(self) -> str:
        owner = self.create_user("owner@example.com")
        org = self.create_organization(owner=owner)
        requester = self.create_user()
        self.create_member(user=requester, organization=org)

        notification = IntegrationRequestNotification(
            org,
            requester,
            provider_type="first_party",
            provider_slug="slack",
            provider_name="Slack",
        )
        with self.tasks():
            notification.send()

        assert len(mail.outbox) == 1
        return mail.outbox[0].body

    def test_email_settings_label(self) -> None:
        body = self._send_integration_request_email()
        assert "can be disabled in Organization Settings:" in body

    @with_feature("organizations:settings-v3")
    def test_email_settings_label_settings_v3(self) -> None:
        body = self._send_integration_request_email()
        assert "can be disabled in Org Settings:" in body
