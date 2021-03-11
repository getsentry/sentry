from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.demo"

    def ready(self):
        from .tasks import build_up_org_buffer

        build_up_org_buffer.apply_async()
