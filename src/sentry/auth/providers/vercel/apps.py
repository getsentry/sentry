from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.vercel"

    def ready(self):
        from sentry import auth

        from .provider import VercelOAuth2Provider

        auth.register("vercel", VercelOAuth2Provider)
