from django.core.mail import EmailMultiAlternatives
from django.core.mail.message import make_msgid

from sentry import options
from sentry.notifications.platform.provider import NotificationProvider
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.types import (
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
        email_context = {
            "subject": rendered_template.subject,
            "body": rendered_template.body,
            "actions": [(action.label, action.link) for action in rendered_template.actions],
            "chart_url": rendered_template.chart.url if rendered_template.chart else None,
            "chart_alt_text": rendered_template.chart.alt_text if rendered_template.chart else None,
            "footer": rendered_template.footer,
        }

        html_body = inline_css(
            render_to_string(
                template=(rendered_template.email_html_path or DEFAULT_EMAIL_HTML_PATH),
                context=email_context,
            )
        )
        txt_body = render_to_string(
            template=(rendered_template.email_text_path or DEFAULT_EMAIL_TEXT_PATH),
            context=email_context,
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
