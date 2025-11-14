from typing import int
from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.remote_subscriptions"

    def ready(self) -> None:
        pass
