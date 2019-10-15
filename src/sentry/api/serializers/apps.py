from __future__ import absolute_import

from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.api.serializers"

    def ready(self):
        # TODO: hopefully no one relies on these imports, they're just being registered.
        from .models import *  # NOQA
