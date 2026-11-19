from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.google"

    def ready(self) -> None:
        from sentry import auth

        from .provider import GoogleOAuth2Provider

        auth.register(GoogleOAuth2Provider)
