from __future__ import annotations

import subprocess
import tempfile
from collections.abc import Sequence

from django.conf import settings
from django.core.mail import EmailMessage
from django.core.mail.backends.base import BaseEmailBackend


def is_smtp_enabled(backend: str | None = None) -> bool:
    """Check if the current backend is SMTP based."""
    if backend is None:
        backend = get_mail_backend()
    return backend not in settings.SENTRY_SMTP_DISABLED_BACKENDS


def get_mail_backend() -> str:
    backend = settings.EMAIL_BACKEND
    backend = settings.SENTRY_EMAIL_BACKEND_ALIASES.get(backend, backend)
    if backend == "django.core.mail.backends.console.EmailBackend" and not settings.DEBUG:
        raise RuntimeError("Console email backend is only available in debug mode.")
    return backend


class PreviewBackend(BaseEmailBackend):
    """
    Email backend that can be used in local development to open messages in the
    local mail client as they are sent.

    Probably only works on OS X.
    """

    def send_messages(self, email_messages: Sequence[EmailMessage]) -> int:
        for message in email_messages:
            content = bytes(message.message())
            with tempfile.NamedTemporaryFile(
                delete=False, prefix="sentry-email-preview-", suffix=".eml"
            ) as preview:
                preview.write(content)

            subprocess.check_call(("open", preview.name))

        return len(email_messages)
