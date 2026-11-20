from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.oidc"

    def ready(self) -> None:
        from sentry import auth

        from .provider import OIDCProvider

        auth.register(OIDCProvider)
