from django.apps import AppConfig

from sentry.auth.partnership_configs import ChannelName


class Config(AppConfig):
    name = "sentry.auth.providers.fly"

    def ready(self):
        from sentry import auth, options

        from .provider import FlyOAuth2Provider

        auth.register(ChannelName.FLY_IO.value, FlyOAuth2Provider)

        options.register(
            "auth-fly.client-id",
            flags=options.FLAG_ALLOW_EMPTY | options.FLAG_PRIORITIZE_DISK,
        )
        options.register(
            "auth-fly.client-secret",
            flags=options.FLAG_ALLOW_EMPTY | options.FLAG_PRIORITIZE_DISK,
        )
