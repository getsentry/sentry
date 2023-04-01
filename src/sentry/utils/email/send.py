import logging
from typing import Any, Sequence

from django.core import mail
from django.core.mail import EmailMultiAlternatives

from sentry import options
from sentry.utils import metrics

from .backend import get_mail_backend

logger = logging.getLogger("sentry.mail")


def send_messages(messages: Sequence[EmailMultiAlternatives], fail_silently: bool = False) -> int:
    connection = get_connection(fail_silently=fail_silently)
    # Explicitly typing to satisfy mypy.
    sent: int = connection.send_messages(messages)
    metrics.incr("email.sent", sent, skip_internal=False, tags={"success": True})
    failed = len(messages) - sent
    if failed > 0:
        metrics.incr("email.sent", failed, skip_internal=False, tags={"success": False})

    for message in messages:
        extra = {
            "message_id": message.extra_headers["Message-Id"],
            "size": len(message.message().as_bytes()),
        }
        logger.info("mail.sent", extra=extra)
    return sent


def get_connection(fail_silently: bool = False) -> Any:
    """Gets an SMTP connection using our OptionsStore."""
    return mail.get_connection(
        backend=get_mail_backend(),
        host=options.get("mail.host"),
        port=options.get("mail.port"),
        username=options.get("mail.username"),
        password=options.get("mail.password"),
        use_tls=options.get("mail.use-tls"),
        use_ssl=options.get("mail.use-ssl"),
        timeout=options.get("mail.timeout"),
        fail_silently=fail_silently,
    )


def send_mail(
    subject: str,
    message: str,
    from_email: str,
    recipient_list: Sequence[str],
    fail_silently: bool = False,
    **kwargs: Any,
) -> int:
    """
    Wrapper that forces sending mail through our connection.
    Uses EmailMessage class which has more options than the simple send_mail
    """
    # Explicitly typing to satisfy mypy.
    sent: int = mail.EmailMessage(
        subject,
        message,
        from_email,
        recipient_list,
        connection=get_connection(fail_silently=fail_silently),
        **kwargs,
    ).send(fail_silently=fail_silently)
    return sent
