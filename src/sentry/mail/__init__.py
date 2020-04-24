from __future__ import absolute_import

from django.conf import settings

from sentry.utils.imports import import_string


def load_mail_adapter():
    return import_string(settings.SENTRY_MAIL_ADAPTER_BACKEND)()


mail_adapter = load_mail_adapter()
