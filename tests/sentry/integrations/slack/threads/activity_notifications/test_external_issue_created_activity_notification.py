from sentry.integrations.slack.threads.activity_notifications import (
    ExternalIssueCreatedActivityNotification,
)
from tests.sentry.integrations.slack.threads.activity_notifications import BaseTestCase


class TestGetDescription(BaseTestCase):
    def test_basic_case(self) -> None:
        provider = "Github"
        label = "ABC-123"
        location = "www.example.com"
        self.activity.data = {"provider": provider, "label": label, "location": location}

        notification = ExternalIssueCreatedActivityNotification(self.activity)
        template, _, metadata = notification.get_description()

        assert template == "{author} created <{link}|a {provider} issue {ticket}>"
        assert metadata["provider"] == "GitHub"  # This is how Github is officially spelled
        assert metadata["ticket"] == label
        assert metadata["link"] == location

    def test_with_default_provider(self) -> None:
        provider = ""
        label = "ABC-123"
        location = "www.example.com"
        self.activity.data = {"provider": provider, "label": label, "location": location}

        notification = ExternalIssueCreatedActivityNotification(self.activity)
        template, _, metadata = notification.get_description()

        assert template == "{author} created <{link}|an {provider} issue {ticket}>"
        assert metadata["provider"] == "external provider"
        assert metadata["ticket"] == label
        assert metadata["link"] == location

    def test_without_ticket_number(self) -> None:
        provider = "Jira"
        label = ""
        location = "www.example.com"
        self.activity.data = {"provider": provider, "label": label, "location": location}

        notification = ExternalIssueCreatedActivityNotification(self.activity)
        template, _, metadata = notification.get_description()

        assert template == "{author} created <{link}|a {provider} issue>"
        assert metadata["provider"] == provider
        assert metadata["ticket"] == label
        assert metadata["link"] == location

    def test_without_link(self) -> None:
        provider = "Jira"
        label = "ABC-123"
        location = ""
        self.activity.data = {"provider": provider, "label": label, "location": location}

        notification = ExternalIssueCreatedActivityNotification(self.activity)
        template, _, metadata = notification.get_description()

        assert template == "{author} created a {provider} issue {ticket}"
        assert metadata["provider"] == provider
        assert metadata["ticket"] == label
        assert metadata["link"] == location

    def test_linked_issue(self) -> None:
        provider = "Github"
        label = "ABC-123"
        location = "www.example.com"
        self.activity.data = {
            "provider": provider,
            "label": label,
            "location": location,
            "new": False,
        }

        notification = ExternalIssueCreatedActivityNotification(self.activity)
        template, _, metadata = notification.get_description()

        assert template == "{author} linked <{link}|a {provider} issue {ticket}>"
        assert metadata["provider"] == "GitHub"  # This is how Github is officially spelled
        assert metadata["ticket"] == label
        assert metadata["link"] == location
