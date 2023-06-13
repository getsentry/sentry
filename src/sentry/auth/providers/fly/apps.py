from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.fly"

    def ready(self):
        from sentry.auth import options, register

        from .provider import FlyOAuth2Provider

        register("fly", FlyOAuth2Provider)

        options.register(
            "auth-google.client-id", flags=options.FLAG_ALLOW_EMPTY | options.FLAG_PRIORITIZE_DISK
        )
        options.register(
            "auth-google.client-secret",
            flags=options.FLAG_ALLOW_EMPTY | options.FLAG_PRIORITIZE_DISK,
        )
