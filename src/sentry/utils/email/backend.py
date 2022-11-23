from __future__ import annotations

import subprocess
import tempfile
from typing import Any, Sequence

from django.conf import settings
from django.core.mail import EmailMessage
from django.core.mail.backends.base import BaseEmailBackend

from sentry import options

Backend = Any


def is_smtp_enabled(backend: Backend | None = None) -> bool:
    """Check if the current backend is SMTP based."""
    if backend is None:
        backend = get_mail_backend()
    return backend not in settings.SENTRY_SMTP_DISABLED_BACKENDS


def get_mail_backend() -> Backend:
    backend = options.get("mail.backend")
    try:
        return settings.SENTRY_EMAIL_BACKEND_ALIASES[backend]
    except KeyError:
        return backend


class PreviewBackend(BaseEmailBackend):  # type: ignore
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
