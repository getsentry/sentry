from typing import int
from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.monitors"

    def ready(self) -> None:
        pass
