from typing import int
from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.uptime"

    def ready(self) -> None:
        from sentry.uptime.endpoints import serializers  # NOQA
