from unittest import mock

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.test import override_settings

from sentry import options
from sentry.mail.notifications import build_subject_prefix
from sentry.models.activity import Activity
from sentry.models.groupemailthread import GroupEmailThread
from sentry.notifications.models.notificationrecord import NotificationRecord
from sentry.notifications.models.notificationthread import NotificationThread
from sentry.notifications.platform.email.provider import (
    EmailNotificationProvider,
    EmailRenderer,
)
from sentry.notifications.platform.provider import SendSuccessResult
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.templates.activity.assigned import AssignedActivityTemplate
from sentry.notifications.platform.templates.activity.base import (
    AssignedNotificationData,
    build_activity_notification_data,
)
from sentry.notifications.platform.threading import (
    ThreadContext,
    ThreadingConfig,
    ThreadingOptions,
    ThreadingService,
    ThreadKey,
)
from sentry.notifications.platform.tracking import NotificationLinkDecorator
from sentry.notifications.platform.types import (
    BoldTextBlock,
    LinkTextBlock,
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationSectionType,
    NotificationSource,
    NotificationTargetResourceType,
    NotificationTextBlock,
    NotificationTextBlockType,
    ParagraphSection,
    PlainTextBlock,
)
from sentry.organizations.services.organization.serial import serialize_organization_summary
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import MockNotification, MockNotificationTemplate
from sentry.types.activity import ActivityType


def render_email(
    data: NotificationData, rendered_template: NotificationRenderedTemplate
) -> EmailMultiAlternatives:
    return EmailRenderer.render(
        data=data,
        rendered_template=rendered_template,
        link_decorator=NotificationLinkDecorator(data=data, provider=NotificationProviderKey.EMAIL),
    )


def validate_text_block(
    text_block: NotificationTextBlock, text_content: str, html_content: str
) -> None:
    if text_block.type == NotificationTextBlockType.PLAIN_TEXT:
        assert text_block.text in html_content
    elif text_block.type == NotificationTextBlockType.BOLD_TEXT:
        assert "<strong" in html_content
        assert f"{text_block.text}</strong>" in html_content
    elif text_block.type == NotificationTextBlockType.CODE:
        assert "<code" in html_content
        assert f"{text_block.text}</code>" in html_content
    elif text_block.type == NotificationTextBlockType.ITALIC_TEXT:
        assert text_block.text in html_content
    elif text_block.type == NotificationTextBlockType.LINK:
        assert text_block.text in html_content


def validate_formatting_block(
    formatting_block: NotificationSection, text_content: str, html_content: str
) -> None:
    if formatting_block.type == NotificationSectionType.PARAGRAPH:
        assert "\n" in text_content
        assert "<p" in html_content
        assert "</p>" in html_content
    elif formatting_block.type == NotificationSectionType.CODE_BLOCK:
        assert "\n" in text_content
        assert "<pre" in html_content
        assert "</pre>" in html_content
        assert "<code" in html_content
        assert "</code>" in html_content
    elif formatting_block.type == NotificationSectionType.BLOCK_QUOTE:
        assert "<blockquote" in html_content


class EmailRendererTest(TestCase):
    def setUp(self) -> None:
        self.data = MockNotification(message="test message")
        self.template = MockNotificationTemplate()
        self.rendered_template = self.template.render(self.data)

    def test_render(self) -> None:
        email = render_email(self.data, self.rendered_template)

        assert isinstance(email, EmailMultiAlternatives)
        assert email.subject == self.rendered_template.subject_text
        assert email.from_email == options.get("mail.from")
        assert len(email.to) == 0
        assert "Message-Id" in email.extra_headers

        [html_alternative] = email.alternatives
        [html_content, content_type] = html_alternative
        assert content_type == "text/html"
        text_content = email.body

        assert self.rendered_template.chart is not None
        assert isinstance(self.rendered_template.subject_blocks, list)
        assert isinstance(self.rendered_template.subject_text, str)
        assert isinstance(self.rendered_template.footer_blocks, list)
        assert isinstance(self.rendered_template.footer_text, str)

        for element in [
            self.rendered_template.subject_text,
            self.rendered_template.actions[0].label,
            self.rendered_template.actions[0].link,
            self.rendered_template.chart.url,
            self.rendered_template.chart.alt_text,
        ]:
            assert element in str(text_content)
            assert element in str(html_content)

        # validate footer blocks individually (footer_text won't match verbatim
        # because the renderer applies formatting like backticks for code blocks)
        for footer_block in self.rendered_template.footer_blocks:
            assert footer_block.text in str(text_content)
            assert footer_block.text in str(html_content)

        # validate body blocks
        for block in self.rendered_template.body:
            validate_formatting_block(block, str(text_content), str(html_content))
            for text_block in block.blocks:
                validate_text_block(text_block, str(text_content), str(html_content))

    def test_xss_protection(self) -> None:
        xss_template = NotificationRenderedTemplate(
            subject="Test XSS",
            body=[
                ParagraphSection(
                    blocks=[
                        PlainTextBlock(text="<script>alert('xss')</script>"),
                        BoldTextBlock(text="<img src=x onerror=alert('xss')>"),
                    ],
                )
            ],
        )

        email = render_email(self.data, xss_template)
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

    def test_xss_protection_link_block(self) -> None:
        xss_template = NotificationRenderedTemplate(
            subject="Test XSS Link",
            body=[
                ParagraphSection(
                    blocks=[
                        LinkTextBlock(
                            text='<script>alert("xss")</script>',
                            url="https://example.com/<script>",
                        ),
                    ],
                )
            ],
        )

        email = render_email(self.data, xss_template)
        [html_content, _] = email.alternatives[0]

        assert "<script>" not in str(html_content)
        assert "&lt;script&gt;" in str(html_content)

    def test_subject_prefix(self) -> None:
        rendered_template = NotificationRenderedTemplate(
            subject="Test subject",
            body=[],
            email_subject_prefix="[Project] ",
        )

        email = render_email(self.data, rendered_template)

        assert email.subject == "[Project] Test subject"

    def test_subject_removes_line_breaks(self) -> None:
        rendered_template = NotificationRenderedTemplate(
            subject="Test subject",
            body=[],
            email_subject_prefix="[Project]\nInjected: ",
        )

        email = render_email(self.data, rendered_template)

        assert email.subject == "[Project] Injected: Test subject"

    def test_subject_removes_control_characters(self) -> None:
        rendered_template = NotificationRenderedTemplate(
            subject="Error: a\x00b\x1bc\x7fd",
            body=[],
        )

        email = render_email(self.data, rendered_template)

        assert email.subject == "Error: abcd"

    def test_subject_prefix_uses_project_option_with_global_fallback(self) -> None:
        with override_settings(EMAIL_SUBJECT_PREFIX="[Global]"):
            assert build_subject_prefix(self.project) == "[Global]"

            self.project.update_option("mail:subject_prefix", "[Project]")

            assert build_subject_prefix(self.project) == "[Project]"


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
        assert (
            EmailNotificationProvider.is_available(
                organization=serialize_organization_summary(self.organization)
            )
            is True
        )

    @mock.patch("sentry.notifications.platform.email.provider.send_messages")
    def test_send(self, mock_send_messages: mock.MagicMock) -> None:
        email = render_email(self.data, self.rendered_template)
        EmailNotificationProvider.send(target=self.target, renderable=email)
        mock_send_messages.assert_called_once()
        [sent_message] = mock_send_messages.call_args[0][0]
        assert sent_message.to == [self.email]

    @mock.patch("sentry.notifications.platform.email.provider.send_messages")
    def test_send_returns_message_id(self, mock_send_messages: mock.MagicMock) -> None:
        email = render_email(self.data, self.rendered_template)
        result = EmailNotificationProvider.send(target=self.target, renderable=email)

        assert result == SendSuccessResult(provider_message_id=email.extra_headers["Message-Id"])

    @mock.patch("sentry.notifications.platform.email.provider.send_messages")
    def test_activity_email_preserves_legacy_headers(
        self, mock_send_messages: mock.MagicMock
    ) -> None:
        group = self.create_group(project=self.project, logger="example.logger", level=30)
        activity = Activity.objects.create_group_activity(
            group,
            ActivityType.ASSIGNED,
            user=self.user,
            data={"assignee": str(self.user.id), "assigneeType": "user"},
        )
        data = build_activity_notification_data(activity=activity, target=self.target)
        assert isinstance(data, AssignedNotificationData)
        rendered_template = AssignedActivityTemplate().render(data)
        email = render_email(data, rendered_template)

        EmailNotificationProvider.send(target=self.target, renderable=email)

        [sent_message] = mock_send_messages.call_args[0][0]
        assert sent_message.extra_headers == {
            "X-SMTPAPI": '{"category":"assigned_activity"}',
            "X-Sentry-Project": self.project.slug,
            "X-Sentry-Logger": "example.logger",
            "X-Sentry-Logger-Level": "warning",
            "X-Sentry-Reply-To": mock.ANY,
            "List-Id": (
                f"<{self.project.slug}.{self.organization.slug}."
                f"{settings.SENTRY_MAIL_LIST_NAMESPACE}>"
            ),
            "Message-Id": mock.ANY,
            "Reply-To": mock.ANY,
        }
        assert (
            sent_message.extra_headers["Reply-To"]
            == sent_message.extra_headers["X-Sentry-Reply-To"]
        )
        assert GroupEmailThread.objects.filter(email=self.email, group=group).exists()

    @mock.patch("sentry.notifications.platform.email.provider.send_messages")
    def test_activity_email_preserves_reply_and_thread_headers(
        self, mock_send_messages: mock.MagicMock
    ) -> None:
        group = self.create_group(project=self.project)
        activity = Activity.objects.create_group_activity(
            group,
            ActivityType.ASSIGNED,
            user=self.user,
            data={"assignee": str(self.user.id), "assigneeType": "user"},
        )
        data = build_activity_notification_data(activity=activity, target=self.target)
        assert isinstance(data, AssignedNotificationData)
        rendered_template = AssignedActivityTemplate().render(data)

        with override_settings(SENTRY_MAIL_ENABLE_REPLIES=True):
            email = render_email(data, rendered_template)
            EmailNotificationProvider.send(target=self.target, renderable=email)
            first_message_id = email.extra_headers["Message-Id"]
            mock_send_messages.reset_mock()

            data = build_activity_notification_data(activity=activity, target=self.target)
            assert isinstance(data, AssignedNotificationData)
            rendered_template = AssignedActivityTemplate().render(data)
            email = render_email(data, rendered_template)
            EmailNotificationProvider.send(target=self.target, renderable=email)

        [sent_message] = mock_send_messages.call_args[0][0]
        assert (
            sent_message.extra_headers["Reply-To"]
            == sent_message.extra_headers["X-Sentry-Reply-To"]
        )
        assert sent_message.extra_headers["In-Reply-To"] == first_message_id
        assert sent_message.extra_headers["References"] == first_message_id


class EmailNotificationProviderThreadingTest(TestCase):
    def setUp(self) -> None:
        self.data = MockNotification(message="test message")
        self.rendered_template = MockNotificationTemplate().render(self.data)
        self.email = "test@example.com"
        self.target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,
            resource_type=NotificationTargetResourceType.EMAIL,
            resource_id=self.email,
        )
        self.thread_key = ThreadKey(
            key_type=NotificationSource.ISSUE,
            key_data={"action_id": 123, "group_id": 456},
        )

    def _create_existing_thread(self, thread_identifier: str) -> NotificationThread:
        config: ThreadingConfig = {
            "key_type": self.thread_key.key_type,
            "key_data": self.thread_key.key_data,
            "provider_key": NotificationProviderKey.EMAIL,
            "target_id": self.email,
            "thread_identifier": thread_identifier,
            "provider_data": None,
        }
        thread, _ = ThreadingService.store_new_thread(
            threading_config=config, external_message_id=thread_identifier
        )
        return thread

    @mock.patch("sentry.notifications.platform.email.provider.send_messages")
    def test_send_starts_thread(self, mock_send_messages: mock.MagicMock) -> None:
        email = render_email(self.data, self.rendered_template)
        result = EmailNotificationProvider.send(
            target=self.target,
            renderable=email,
            thread_context=ThreadContext(thread_key=self.thread_key),
        )

        [sent_message] = mock_send_messages.call_args[0][0]
        assert "In-Reply-To" not in sent_message.extra_headers
        assert "References" not in sent_message.extra_headers
        assert result == SendSuccessResult(
            provider_message_id=sent_message.extra_headers["Message-Id"],
            is_threaded=True,
            thread_identifier=None,
        )

    @mock.patch("sentry.notifications.platform.email.provider.send_messages")
    def test_send_replies_to_existing_thread(self, mock_send_messages: mock.MagicMock) -> None:
        root_message_id = "<root@example.com>"
        thread = self._create_existing_thread(thread_identifier=root_message_id)
        email = render_email(self.data, self.rendered_template)

        result = EmailNotificationProvider.send(
            target=self.target,
            renderable=email,
            thread_context=ThreadContext(thread_key=self.thread_key, thread=thread),
        )

        [sent_message] = mock_send_messages.call_args[0][0]
        assert sent_message.extra_headers["In-Reply-To"] == root_message_id
        assert sent_message.extra_headers["References"] == root_message_id
        assert sent_message.extra_headers["Message-Id"] != root_message_id
        assert result == SendSuccessResult(
            provider_message_id=sent_message.extra_headers["Message-Id"],
            is_threaded=True,
            thread_identifier=root_message_id,
        )

    @mock.patch("sentry.notifications.platform.email.provider.send_messages")
    def test_notify_target_threads_emails(self, mock_send_messages: mock.MagicMock) -> None:
        threading_options = ThreadingOptions(thread_key=self.thread_key)
        service = NotificationService(data=self.data)

        service.notify_target(target=self.target, threading_options=threading_options)
        [first_message] = mock_send_messages.call_args[0][0]
        root_message_id = first_message.extra_headers["Message-Id"]

        thread = NotificationThread.objects.get(
            provider_key=NotificationProviderKey.EMAIL, target_id=self.email
        )
        assert thread.thread_identifier == root_message_id

        service.notify_target(target=self.target, threading_options=threading_options)
        [second_message] = mock_send_messages.call_args[0][0]

        assert second_message.extra_headers["In-Reply-To"] == root_message_id
        assert second_message.extra_headers["References"] == root_message_id
        assert list(
            NotificationRecord.objects.filter(thread=thread)
            .order_by("id")
            .values_list("message_id", flat=True)
        ) == [root_message_id, second_message.extra_headers["Message-Id"]]
