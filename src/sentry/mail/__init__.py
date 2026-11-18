from __future__ import annotations

from typing import TYPE_CHECKING

from django.conf import settings

from sentry.utils.imports import import_string

from .analytics import *  # NOQA Importing this in __init__ so that analytics.register runs.
from .notifications import *  # NOQA Importing this in __init__ so that @register runs.

if TYPE_CHECKING:
    from .adapter import MailAdapter


def load_mail_adapter() -> MailAdapter:
    return import_string(settings.SENTRY_MAIL_ADAPTER_BACKEND)()


mail_adapter: MailAdapter = load_mail_adapter()
