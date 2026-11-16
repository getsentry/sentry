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

    def test_get_context_links_to_provider(self) -> None:
        owner = self.create_user("owner@example.com")
        org = self.create_organization(owner=owner)
        requester = self.create_user()
        self.create_member(user=requester, organization=org)

        notification = IntegrationRequestNotification(
            org,
            requester,
            provider_type="first_party",
            provider_slug="github",
            provider_name="GitHub",
        )
        context = notification.get_context()
        assert context["requested"] == "the installation of GitHub"
        assert context["install_label"] == "Install GitHub"
        assert context["integration_link"] == org.absolute_url(
            f"/settings/{org.slug}/integrations/github/", query="referrer=request_email"
        )

    def test_get_context_links_to_category(self) -> None:
        owner = self.create_user("owner@example.com")
        org = self.create_organization(owner=owner)
        requester = self.create_user()
        self.create_member(user=requester, organization=org)

        notification = IntegrationRequestNotification(
            org,
            requester,
            provider_type="category",
            provider_slug="source code management",
            provider_name="source code management",
        )
        context = notification.get_context()
        assert context["requested"] == "a source code management integration"
        assert context["install_label"] == "Install integration"
        assert context["integration_link"] == org.absolute_url(
            f"/settings/{org.slug}/integrations/",
            query="category=source%20code%20management&referrer=request_email",
        )

    def test_get_context_without_provider(self) -> None:
        owner = self.create_user("owner@example.com")
        org = self.create_organization(owner=owner)
        requester = self.create_user()
        self.create_member(user=requester, organization=org)

        notification = IntegrationRequestNotification(
            org,
            requester,
            provider_type=None,
            provider_slug=None,
            provider_name=None,
        )
        context = notification.get_context()
        assert context["requested"] == "an integration"
        assert context["install_label"] == "Install integration"
        assert context["integration_link"] == org.absolute_url(
            f"/settings/{org.slug}/integrations/", query="referrer=request_email"
        )
        assert notification.get_subject() == "Your team member requested an integration on Sentry"

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
