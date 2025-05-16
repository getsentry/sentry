from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.status_pages"

    def ready(self):
        pass
        # Import stuff in the future
