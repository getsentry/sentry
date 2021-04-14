from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.incidents"

    def ready(self):
        from . import action_handlers  # NOQA
        from . import events  # NOQA
        from . import receivers  # NOQA
