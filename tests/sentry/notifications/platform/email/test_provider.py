from unittest import mock

from django.core.mail import EmailMultiAlternatives

from sentry import options
from sentry.notifications.platform.email.provider import EmailNotificationProvider, EmailRenderer
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.types import (
    NotificationBodyFormattingBlock,
    NotificationBodyFormattingBlockType,
    NotificationBodyTextBlock,
    NotificationBodyTextBlockType,
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import MockNotification, MockNotificationTemplate


def validate_text_block(
    text_block: NotificationBodyTextBlock, text_content: str, html_content: str
) -> None:
    if text_block.type == NotificationBodyTextBlockType.PLAIN_TEXT:
        assert text_block.text in text_content
        assert text_block.text in html_content
    elif text_block.type == NotificationBodyTextBlockType.BOLD_TEXT:
        assert f"<strong>{text_block.text}</strong>" in html_content
    elif text_block.type == NotificationBodyTextBlockType.CODE:
        assert f"<code>{text_block.text}</code>" in html_content


def validate_formatting_block(
    formatting_block: NotificationBodyFormattingBlock, text_content: str, html_content: str
) -> None:
    if formatting_block.type == NotificationBodyFormattingBlockType.PARAGRAPH:
        assert "\n" in text_content
        assert "<p" in html_content
        assert "</p>" in html_content
    elif formatting_block.type == NotificationBodyFormattingBlockType.CODE_BLOCK:
        assert "\n" in text_content
        assert "<pre" in html_content
        assert "</pre>" in html_content
        assert "<code" in html_content
        assert "</code>" in html_content


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

        assert self.rendered_template.chart is not None
        assert self.rendered_template.footer is not None

        for element in [
            self.rendered_template.subject,
            self.rendered_template.actions[0].label,
            self.rendered_template.actions[0].link,
            self.rendered_template.chart.url,
            self.rendered_template.chart.alt_text,
            self.rendered_template.footer,
        ]:
            assert element in str(text_content)
            assert element in str(html_content)

        # validate body blocks
        for block in self.rendered_template.body:
            validate_formatting_block(block, str(text_content), str(html_content))
            for text_block in block.blocks:
                validate_text_block(text_block, str(text_content), str(html_content))

    def test_xss_protection(self) -> None:
        from sentry.notifications.platform.types import (
            BoldTextBlock,
            NotificationBodyFormattingBlockType,
            NotificationBodyTextBlockType,
            NotificationRenderedTemplate,
            ParagraphBlock,
            PlainTextBlock,
        )

        # Create template with XSS attempt in user content
        xss_template = NotificationRenderedTemplate(
            subject="Test XSS",
            body=[
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text="<script>alert('xss')</script>",
                        ),
                        BoldTextBlock(
                            type=NotificationBodyTextBlockType.BOLD_TEXT,
                            text="<img src=x onerror=alert('xss')>",
                        ),
                    ],
                )
            ],
        )

        email = EmailRenderer.render(data=self.data, rendered_template=xss_template)
        [html_content, _] = email.alternatives[0]

        # User content should be escaped (not executable)
        assert "&lt;script&gt;alert('xss')&lt;/script&gt;" in str(html_content)
        assert "&lt;img src=x onerror=alert('xss')&gt;" in str(html_content)

        # Our HTML tags should NOT be escaped (should render)
        assert "<p" in str(html_content)
        assert "</p>" in str(html_content)
        assert "<strong" in str(html_content)
        assert "</strong>" in str(html_content)

        # Malicious tags should NOT be present in unescaped form
        assert "<script>" not in str(html_content)


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
