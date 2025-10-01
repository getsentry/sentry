from unittest import mock

from django.core.mail import EmailMultiAlternatives

from sentry import options
from sentry.notifications.platform.email.provider import EmailNotificationProvider, EmailRenderer
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import MockNotification, MockNotificationTemplate


class EmailRendererTest(TestCase):
    def setUp(self) -> None:
        self.data = MockNotification(message="test message")
        self.template = MockNotificationTemplate()
        self.rendered_template = self.template.render(self.data)

    def test_render(self) -> None:
        email = EmailRenderer.render(data=self.data, rendered_template=self.rendered_template)

        assert isinstance(email, EmailMultiAlternatives)
        assert email.subject == self.rendered_template.subject
        assert email.from_email == options.get("mail.from")
        assert len(email.to) == 0
        assert "Message-Id" in email.extra_headers

        [html_alternative] = email.alternatives
        [html_content, content_type] = html_alternative
        assert content_type == "text/html"
        text_content = email.body

        # Helping the type checker
        assert self.rendered_template.chart is not None
        assert self.rendered_template.footer is not None

        for element in [
            self.rendered_template.subject,
            self.rendered_template.body,
            self.rendered_template.actions[0].label,
            self.rendered_template.actions[0].link,
            self.rendered_template.chart.url,
            self.rendered_template.chart.alt_text,
            self.rendered_template.footer,
        ]:
            assert element in str(text_content)
            assert element in str(html_content)


class EmailNotificationProviderTest(TestCase):
    def setUp(self) -> None:
        self.provider = EmailNotificationProvider()
        self.data = MockNotification(message="test message")
        self.rendered_template = MockNotificationTemplate().render(self.data)
        self.email = "test@example.com"
        self.target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,
            resource_type=NotificationTargetResourceType.EMAIL,
            resource_id=self.email,
        )

    def test_provider_configuration(self) -> None:
        assert self.provider.key == NotificationProviderKey.EMAIL
        assert self.provider.target_class == GenericNotificationTarget
        assert self.provider.target_resource_types == [NotificationTargetResourceType.EMAIL]
        assert EmailNotificationProvider.is_available() is True
        assert EmailNotificationProvider.is_available(organization=self.organization) is True

    @mock.patch("sentry.notifications.platform.email.provider.send_messages")
    def test_send(self, mock_send_messages: mock.MagicMock) -> None:
        email = EmailRenderer.render(data=self.data, rendered_template=self.rendered_template)
        EmailNotificationProvider.send(target=self.target, renderable=email)
        mock_send_messages.assert_called_once()
        [sent_message] = mock_send_messages.call_args[0][0]
        assert sent_message.to == [self.email]
