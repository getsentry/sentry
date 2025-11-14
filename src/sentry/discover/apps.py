from typing import int
from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.discover"

    def ready(self) -> None:
        pass
