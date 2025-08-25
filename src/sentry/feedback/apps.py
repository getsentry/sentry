from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.feedback"

    def ready(self):
        pass
