from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.fly"

    def ready(self):
        from sentry import auth

        from .provider import FlyOAuth2Provider

        auth.register("fly", FlyOAuth2Provider)
