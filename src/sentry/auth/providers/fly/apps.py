from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.fly"

    def ready(self) -> None:
        from sentry import auth

        from .provider import FlyOAuth2Provider, NonPartnerFlyOAuth2Provider

        auth.register(FlyOAuth2Provider)
        auth.register(NonPartnerFlyOAuth2Provider)
