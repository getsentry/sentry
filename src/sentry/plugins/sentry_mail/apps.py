from __future__ import absolute_import

from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.plugins.sentry_mail"

    def ready(self):
        from .models import MailPlugin
        from sentry.plugins.base import register

        register(MailPlugin)
