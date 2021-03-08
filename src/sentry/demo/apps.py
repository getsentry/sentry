from django.apps import AppConfig


from .models import DemoOrganization, DemoUser


class Config(AppConfig):
    name = "sentry.demo"

    def get_models(self):
        return [DemoOrganization, DemoUser]
