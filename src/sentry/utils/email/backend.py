import subprocess
import tempfile

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

from sentry import options


def is_smtp_enabled(backend=None):
    """Check if the current backend is SMTP based."""
    if backend is None:
        backend = get_mail_backend()
    return backend not in settings.SENTRY_SMTP_DISABLED_BACKENDS


def get_mail_backend():
    backend = options.get("mail.backend")
    try:
        return settings.SENTRY_EMAIL_BACKEND_ALIASES[backend]
    except KeyError:
        return backend


class PreviewBackend(BaseEmailBackend):
    """
    Email backend that can be used in local development to open messages in the
    local mail client as they are sent.

    Probably only works on OS X.
    """

    def send_messages(self, email_messages):
        for message in email_messages:
            content = bytes(message.message())
            preview = tempfile.NamedTemporaryFile(
                delete=False, prefix="sentry-email-preview-", suffix=".eml"
            )
            try:
                preview.write(content)
                preview.flush()
            finally:
                preview.close()

            subprocess.check_call(("open", preview.name))

        return len(email_messages)
