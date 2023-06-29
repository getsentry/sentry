from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.fly"

    def ready(self):
        from sentry import auth, options

        from .provider import FlyOAuth2Provider

        auth.register("fly", FlyOAuth2Provider)

        options.register(
            "auth-fly.client-id",
            flags=options.FLAG_ALLOW_EMPTY | options.FLAG_PRIORITIZE_DISK,  # type: ignore
        )
        options.register(
            "auth-fly.client-secret",
            flags=options.FLAG_ALLOW_EMPTY | options.FLAG_PRIORITIZE_DISK,  # type: ignore
        )
