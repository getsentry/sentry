from django.conf import settings

from sentry.utils.imports import import_string

from .notifications import *  # NOQA Importing this in __init__ so that @register runs.


def load_mail_adapter():
    return import_string(settings.SENTRY_MAIL_ADAPTER_BACKEND)()


mail_adapter = load_mail_adapter()
