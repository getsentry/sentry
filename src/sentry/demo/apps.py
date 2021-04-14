from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.demo"

    def ready(self):
        from .tasks import delete_initializing_orgs

        # also rebuilds the org buffer
        delete_initializing_orgs.apply_async()
