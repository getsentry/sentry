from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth_v2"

    def ready(self):
        pass
