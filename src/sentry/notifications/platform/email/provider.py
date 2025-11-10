from django.core.mail import EmailMultiAlternatives
from django.core.mail.message import make_msgid
from django.utils.html import escape
from django.utils.safestring import mark_safe

from sentry import options
from sentry.notifications.platform.provider import NotificationProvider
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.types import (
    NotificationBodyFormattingBlock,
    NotificationBodyFormattingBlockType,
    NotificationBodyTextBlock,
    NotificationBodyTextBlockType,
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationTarget,
    NotificationTargetResourceType,
)
from sentry.organizations.services.organization.model import RpcOrganizationSummary
from sentry.utils.email.address import get_from_email_domain
from sentry.utils.email.message_builder import inline_css
from sentry.utils.email.send import send_messages
from sentry.web.helpers import render_to_string

DEFAULT_EMAIL_HTML_PATH = "sentry/emails/platform/default.html"
DEFAULT_EMAIL_TEXT_PATH = "sentry/emails/platform/default.txt"

type EmailRenderable = EmailMultiAlternatives


class EmailRenderer(NotificationRenderer[EmailRenderable]):
    provider_key = NotificationProviderKey.EMAIL

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> EmailRenderable:
        html_body_blocks = cls.render_body_blocks_to_html_string(rendered_template.body)
        txt_body_blocks = cls.render_body_blocks_to_txt_string(rendered_template.body)

        email_context = {
            "subject": rendered_template.subject,
            "actions": [(action.label, action.link) for action in rendered_template.actions],
            "chart_url": rendered_template.chart.url if rendered_template.chart else None,
            "chart_alt_text": rendered_template.chart.alt_text if rendered_template.chart else None,
            "footer": rendered_template.footer,
        }

        html_email_context = {**email_context, "body": html_body_blocks}
        txt_email_context = {**email_context, "body": txt_body_blocks}

        html_body = inline_css(
            render_to_string(
                template=(rendered_template.email_html_path or DEFAULT_EMAIL_HTML_PATH),
                context=html_email_context,
            )
        )
        txt_body = render_to_string(
            template=(rendered_template.email_text_path or DEFAULT_EMAIL_TEXT_PATH),
            context=txt_email_context,
        )
        # Required by RFC 2822 (https://www.rfc-editor.org/rfc/rfc2822.html)
        headers = {"Message-Id": make_msgid(domain=get_from_email_domain())}
        email = EmailMultiAlternatives(
            subject=rendered_template.subject,
            body=txt_body,
            # TODO(ecosystem): Potentially allow templates to configure more attributes of emails
            from_email=options.get("mail.from"),
            to=None,
            cc=None,
            bcc=None,
            reply_to=None,
            # TODO(ecosystem): Ensure we add the List-Unsubscribe header
            headers=headers,
        )
        email.attach_alternative(html_body, "text/html")
        return email

    @classmethod
    def render_body_blocks_to_html_string(cls, body: list[NotificationBodyFormattingBlock]) -> str:
        body_blocks = []
        for block in body:
            if block.type == NotificationBodyFormattingBlockType.PARAGRAPH:
                safe_content = cls.render_text_blocks_to_html_string(block.blocks)
                body_blocks.append(f"<p>{safe_content}</p>")
            elif block.type == NotificationBodyFormattingBlockType.CODE_BLOCK:
                safe_content = cls.render_text_blocks_to_html_string(block.blocks)
                body_blocks.append(f"<pre><code>{safe_content}</code></pre>")

        return mark_safe("".join(body_blocks))

    @classmethod
    def render_text_blocks_to_html_string(cls, blocks: list[NotificationBodyTextBlock]) -> str:
        texts: list[str] = []
        for block in blocks:
            # Escape user content to prevent XSS
            escaped_text = escape(block.text)

            if block.type == NotificationBodyTextBlockType.PLAIN_TEXT:
                texts.append(escaped_text)
            elif block.type == NotificationBodyTextBlockType.BOLD_TEXT:
                # HTML tags are safe, content is escaped
                texts.append(f"<strong>{escaped_text}</strong>")
            elif block.type == NotificationBodyTextBlockType.CODE:
                texts.append(f"<code>{escaped_text}</code>")

        return " ".join(texts)

    @classmethod
    def render_body_blocks_to_txt_string(cls, blocks: list[NotificationBodyFormattingBlock]) -> str:
        body_blocks = []
        for block in blocks:
            if block.type == NotificationBodyFormattingBlockType.PARAGRAPH:
                body_blocks.append(f"\n{cls.render_text_blocks_to_txt_string(block.blocks)}")
            elif block.type == NotificationBodyFormattingBlockType.CODE_BLOCK:
                body_blocks.append(f"\n```{cls.render_text_blocks_to_txt_string(block.blocks)}```")
        return " ".join(body_blocks)

    @classmethod
    def render_text_blocks_to_txt_string(cls, blocks: list[NotificationBodyTextBlock]) -> str:
        texts = []
        for block in blocks:
            if block.type == NotificationBodyTextBlockType.PLAIN_TEXT:
                texts.append(block.text)
            elif block.type == NotificationBodyTextBlockType.BOLD_TEXT:
                texts.append(f"**{block.text}**")
            elif block.type == NotificationBodyTextBlockType.CODE:
                texts.append(f"`{block.text}`")
        return " ".join(texts)


@provider_registry.register(NotificationProviderKey.EMAIL)
class EmailNotificationProvider(NotificationProvider[EmailRenderable]):
    key = NotificationProviderKey.EMAIL
    default_renderer = EmailRenderer
    target_class = GenericNotificationTarget
    target_resource_types = [NotificationTargetResourceType.EMAIL]

    @classmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        return True

    @classmethod
    def send(cls, *, target: NotificationTarget, renderable: EmailRenderable) -> None:
        email = renderable
        email.to = [target.resource_id]
        send_messages([email])
