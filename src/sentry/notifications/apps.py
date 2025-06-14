from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.notifications"

    def ready(self):
        pass
