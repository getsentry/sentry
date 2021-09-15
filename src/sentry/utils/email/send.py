import logging

from django.core import mail

from sentry import options
from sentry.utils import metrics

from .backend import get_mail_backend

logger = logging.getLogger("sentry.mail")


def send_messages(messages, fail_silently=False):
    connection = get_connection(fail_silently=fail_silently)
    sent = connection.send_messages(messages)
    metrics.incr("email.sent", len(messages), skip_internal=False)
    for message in messages:
        extra = {
            "message_id": message.extra_headers["Message-Id"],
            "size": len(message.message().as_bytes()),
        }
        logger.info("mail.sent", extra=extra)
    return sent


def get_connection(fail_silently=False):
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


def send_mail(subject, message, from_email, recipient_list, fail_silently=False, **kwargs):
    """
    Wrapper that forces sending mail through our connection.
    Uses EmailMessage class which has more options than the simple send_mail
    """
    email = mail.EmailMessage(
        subject,
        message,
        from_email,
        recipient_list,
        connection=get_connection(fail_silently=fail_silently),
        **kwargs,
    )
    return email.send(fail_silently=fail_silently)
